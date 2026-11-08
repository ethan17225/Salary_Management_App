"""Payday API backend: Python stdlib only (http.server + sqlite3)."""
import csv
import io
import json
import os
import re
import sqlite3
from contextlib import closing
from datetime import date
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DB_PATH = os.environ.get("DB_PATH", "data/salary.db")

SCHEMA = """
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS sources (
  id       INTEGER PRIMARY KEY,
  name     TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  kind     TEXT    NOT NULL DEFAULT 'job' CHECK (kind IN ('job', 'government', 'other')),
  color    TEXT    NOT NULL DEFAULT '#0d7480',
  archived INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS paycheques (
  id           INTEGER PRIMARY KEY,
  source_id    INTEGER NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  paid_on      TEXT    NOT NULL CHECK (date(paid_on) = paid_on),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  hours        REAL    CHECK (hours IS NULL OR hours > 0),
  note         TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS paycheques_paid_on ON paycheques(paid_on);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
"""

# ponytail: pre-extracted from Salary.pdf; add a pypdf upload endpoint only if importing arbitrary PDFs.
SEED = {
    ("Kung Fu Tea", "job", "#0d7480"): """
        2025-04-11 545.25
        2025-04-25 450.19
        2025-05-09 425.39
        2025-05-23 636.15
        2025-06-06 570.04
        2025-06-20 712.06
        2025-06-30 112.00
        2025-07-04 508.05
        2025-07-18 698.74
        2025-08-01 691.63
        2025-08-15 586.57
        2025-08-29 495.66
        2025-09-12 724.34
        2025-09-26 388.20
        2025-10-10 458.47
        2025-10-24 498.54
        2025-11-07 504.17
        2025-11-21 591.57
        2025-12-05 578.88
        2025-12-19 633.85
        2026-01-02 464.75
        2026-01-16 608.55
        2026-01-30 329.43
        2026-02-13 481.67
        2026-02-15 230.00
        2026-02-27 456.30
        2026-03-13 692.76
        2026-03-27 460.53
        2026-04-10 443.62
        2026-04-24 337.88
        2026-05-13 667.75
        2026-05-24 456.30
        2026-06-07 621.23
        2026-06-19 456.30
        2026-07-02 604.32
        2026-07-17 724.78
        2026-08-04 700.04
        2026-08-17 710.94
        2026-09-02 604.32
        2026-09-14 405.55
        2026-10-15 554.36
        2026-10-28 619.82
        2026-11-09 413.46""",
    ("Softchoice", "job", "#c2410c"): """
        2025-09-15 1402.99 Co-op term
        2025-09-29 1533.69 Co-op term
        2025-10-15 1533.69 Co-op term
        2025-10-31 1533.69 Co-op term
        2025-11-14 1533.69 Co-op term
        2025-11-28 1533.69 Co-op term
        2025-12-15 1533.69 Co-op term
        2025-12-31 654.49 Co-op term
        2026-05-15 1427.43 Co-op term
        2026-05-29 1536.42 Co-op term
        2026-06-13 1536.42 Co-op term
        2026-06-30 1536.42 Co-op term
        2026-07-15 1536.42 Co-op term
        2026-07-30 1536.42 Co-op term
        2026-08-15 1536.42 Co-op term
        2026-08-31 1405.71 Co-op term""",
    ("CRA / Government", "government", "#2563eb"): """
        2025-04-08 1262.09 Income tax refund
        2025-05-08 920.71 Ontario Trillium Benefit
        2025-06-05 944.75 GST/HST credit
        2025-06-10 846.00 Ontario Trillium Benefit""",
}


def connect(path=DB_PATH):
    c = sqlite3.connect(path, timeout=10)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys = ON")
    return c


def init(c):
    c.executescript(SCHEMA)
    if not c.execute("SELECT 1 FROM sources").fetchone():
        for (name, kind, color), rows in SEED.items():
            sid = c.execute("INSERT INTO sources (name, kind, color) VALUES (?, ?, ?)", (name, kind, color)).lastrowid
            for line in rows.strip().splitlines():
                day, amount, *note = line.split(maxsplit=2)
                c.execute(
                    "INSERT INTO paycheques (source_id, paid_on, amount_cents, note) VALUES (?, ?, ?, ?)",
                    (sid, day, cents(amount, "Amount"), note[0] if note else ""),
                )
    c.commit()


# --- validation at the trust boundary -------------------------------------------------

def cents(value, field, required=True):
    if value is None or str(value).strip() == "":
        if required:
            raise ValueError(f"{field} is required")
        return None
    try:
        d = Decimal(str(value).replace(",", "").replace("$", "").strip())
    except InvalidOperation:
        raise ValueError(f"{field} must be a number") from None
    if not d.is_finite() or d <= 0 or d >= 10_000_000:
        raise ValueError(f"{field} must be between 0 and 10,000,000")
    return int((d * 100).quantize(Decimal(1), ROUND_HALF_UP))


def text(value, field, limit, required=False):
    s = str(value or "").strip()
    if required and not s:
        raise ValueError(f"{field} is required")
    if len(s) > limit:
        raise ValueError(f"{field} must be {limit} characters or fewer")
    return s


def clean_paycheque(b):
    try:
        source_id = int(b.get("source_id"))
    except (TypeError, ValueError):
        raise ValueError("Pick a source") from None
    try:
        paid_on = date.fromisoformat(str(b.get("paid_on"))).isoformat()
    except ValueError:
        raise ValueError("Date must look like 2026-11-08") from None
    hours = b.get("hours")
    if hours in (None, ""):
        hours = None
    else:
        try:
            hours = float(hours)
        except (TypeError, ValueError):
            raise ValueError("Hours must be a number") from None
        if not 0 < hours < 1000:
            raise ValueError("Hours must be between 0 and 1000")
    return {
        "source_id": source_id,
        "paid_on": paid_on,
        "amount_cents": cents(b.get("amount"), "Amount"),
        "hours": hours,
        "note": text(b.get("note"), "Note", 200),
    }


def clean_source(b):
    kind = b.get("kind") or "job"
    if kind not in ("job", "government", "other"):
        raise ValueError("Kind must be job, government or other")
    color = str(b.get("color") or "#0d7480")
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", color):
        raise ValueError("Colour must look like #0d7480")
    return {"name": text(b.get("name"), "Name", 60, True), "kind": kind, "color": color, "archived": int(bool(b.get("archived")))}


TABLES = {"paycheques": clean_paycheque, "sources": clean_source}


def state(c):  # ponytail: full-state payload; paginate /api/paycheques if >10k rows
    rows = lambda sql: [dict(r) for r in c.execute(sql)]
    return {
        "sources": rows("SELECT * FROM sources ORDER BY archived, name"),
        "paycheques": rows("SELECT * FROM paycheques ORDER BY paid_on DESC, id DESC"),
        "settings": {r["key"]: r["value"] for r in c.execute("SELECT key, value FROM settings")},
    }


def write(c, method, table, id_, body):
    """Apply one write. Returns (status, payload). Raises ValueError / LookupError / IntegrityError."""
    if table == "settings":
        if method != "PUT":
            raise LookupError
        goal = cents(body.get("goal"), "Goal", required=False)
        if goal is None:
            c.execute("DELETE FROM settings WHERE key = 'goal_cents'")
        else:
            c.execute(
                "INSERT INTO settings VALUES ('goal_cents', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (str(goal),),
            )
        return 200, {"ok": True}
    if method == "POST" and id_ is None:
        row = TABLES[table](body)  # column names come from our own cleaners, never the client
        cur = c.execute(f"INSERT INTO {table} ({', '.join(row)}) VALUES ({', '.join('?' * len(row))})", tuple(row.values()))
        return 201, {"id": cur.lastrowid}
    if id_ is None or method == "POST":
        raise LookupError
    if method == "PUT":
        row = TABLES[table](body)
        cur = c.execute(f"UPDATE {table} SET {', '.join(k + ' = ?' for k in row)} WHERE id = ?", (*row.values(), id_))
    else:
        cur = c.execute(f"DELETE FROM {table} WHERE id = ?", (id_,))
    if not cur.rowcount:
        raise LookupError
    return 200, {"ok": True}


class Handler(BaseHTTPRequestHandler):
    def send(self, status, body=b"", ctype="application/json", extra=()):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        for k, v in extra:
            self.send_header(k, v)
        self.end_headers()
        if data:
            self.wfile.write(data)

    def do_OPTIONS(self):
        self.send(204, extra=[("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"), ("Access-Control-Allow-Headers", "Content-Type")])

    def do_GET(self):
        if self.path == "/api/health":
            return self.send(200, {"ok": True})
        if self.path == "/api/state":
            with closing(connect()) as c:
                return self.send(200, state(c))
        if self.path == "/api/export.csv":
            buf = io.StringIO()
            w = csv.writer(buf)
            w.writerow(["date", "source", "amount", "hours", "note"])
            with closing(connect()) as c:
                for r in c.execute(
                    "SELECT p.paid_on, s.name, p.amount_cents, p.hours, p.note FROM paycheques p "
                    "JOIN sources s ON s.id = p.source_id ORDER BY p.paid_on, p.id"
                ):
                    w.writerow([r[0], r[1], f"{r[2] // 100}.{r[2] % 100:02d}", "" if r[3] is None else r[3], r[4]])
            name = f"paycheques-{date.today().isoformat()}.csv"
            return self.send(200, buf.getvalue().encode(), "text/csv; charset=utf-8", [("Content-Disposition", f'attachment; filename="{name}"')])
        self.send(404, {"error": "Not found"})

    def do_POST(self):
        self.handle_write("POST")

    def do_PUT(self):
        self.handle_write("PUT")

    def do_DELETE(self):
        self.handle_write("DELETE")

    def handle_write(self, method):
        m = re.fullmatch(r"/api/(paycheques|sources|settings)(?:/(\d+))?", self.path)
        if not m:
            return self.send(404, {"error": "Not found"})
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if n > 10_000:
                raise ValueError("Request too large")
            body = json.loads(self.rfile.read(n)) if n else {}
            if not isinstance(body, dict):
                raise ValueError("Expected a JSON object")
            with closing(connect()) as c, c:  # inner `c` commits, or rolls back on error
                status, payload = write(c, method, m[1], m[2] and int(m[2]), body)
            self.send(status, payload)
        except LookupError:
            self.send(404, {"error": "Not found"})
        except sqlite3.IntegrityError as e:
            err = str(e)
            if "FOREIGN KEY" in err:
                msg = "That source does not exist." if m[1] == "paycheques" else "This source has paycheques. Archive it instead."
            elif "UNIQUE" in err:
                msg = "A source with that name already exists."
            else:
                msg = "That value is not allowed."
            self.send(409, {"error": msg})
        except ValueError as e:
            self.send(400, {"error": str(e)})


if __name__ == "__main__":
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with closing(connect()) as c:
        init(c)
    port = int(os.environ.get("PORT", 8000))
    print(f"Payday API running on http://localhost:{port}", flush=True)
    # ponytail: no auth for local single-user Docker run; put behind Caddy basic_auth before exposing to WAN
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()

