# AI Agent Implementation Spec: Feature 4 — Idempotent Bulk CSV / Paystub Importer (`paystub-import`)

> **Target System**: Payday — Salary & Income Management App
>
> **Architecture**: Next.js 14+ (App Router, TypeScript, Zod, Chart.js, Vanilla CSS) + Python Backend (`backend/app.py` & `backend/src/` FastAPI extension) + SQLite (`salary.db` in WAL mode)
>
> **Prerequisite Compatibility**: Integrates directly with Feature 1 (`paystub-breakdown` optional gross/tax/deductions columns) and guarantees deduplication across batch imports.
>
> **Execution Mode**: Autonomous End-to-End Implementation & Verification

## 0. Mission & Non-Negotiable Architectural Guardrails

You are tasked with implementing **Feature 4: Idempotent Bulk CSV / Paystub Importer (`paystub-import`)**. Before modifying any files, inspect the repository and strictly enforce these rules:

1. **Integer Cents Only**: All parsed monetary amounts (`amount_cents`, `gross_cents`, `tax_cents`, `deductions_cents`) MUST be converted and stored as exact integer cents. Never use floating-point numbers for currency storage.

2. **Idempotent Deduplication via SHA-256 Fingerprint**: To prevent duplicate imports when users upload the same CSV or paystub export multiple times, every imported paycheque MUST generate a deterministic SHA-256 import fingerprint:
   

   $$
   H = \text{SHA-256}(\text{source\_id} : \text{paid\_on} : \text{amount\_cents})
   $$

   
   The database schema must enforce a unique partial index on `import_hash`. Duplicate hashes encountered during batch import must be gracefully skipped or reported as duplicates without failing the atomic transaction.

3. **Client-Side CSV Staging & Source Mapping**: The Next.js frontend must provide a drag-and-drop CSV parser that auto-detects common column headers (`date`, `paid_on`, `source`, `employer`, `amount`, `net`, `gross`, `tax`, `hours`, `note`) and lets users map unverified source names to existing income sources (or auto-create new sources on the fly).

4. **Atomic Batch Transactions**: Batch inserts on the Python backend must execute within a single SQLite transaction (`with conn:`) so that either all valid rows are committed or the batch fails safely with a clear row-level error log.

## 1. Database Schema Evolution & Deduplication Fingerprint

### 1.1. Unique Import Hash Index (`paycheques`)

If not already added in Feature 1, add `import_hash` to `paycheques` with a unique index:

```sql
ALTER TABLE paycheques ADD COLUMN import_hash TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_paycheques_import_hash
    ON paycheques(import_hash) WHERE import_hash IS NOT NULL;
```

### 1.2. Fingerprint Generation Function (Python & TypeScript)

* **Python**:
  ```python
  import hashlib

  def compute_paycheque_import_hash(source_id: int, paid_on: str, amount_cents: int) -> str:
      payload = f"{source_id}:{str(paid_on).strip()}:{int(amount_cents)}".encode("utf-8")
      return hashlib.sha256(payload).hexdigest()
  ```

* **TypeScript**:
  ```typescript
  export async function computePaychequeImportHash(
    sourceId: number,
    paidOn: string,
    amountCents: number
  ): Promise<string> {
    const payload = `${sourceId}:${paidOn.trim()}:${amountCents}`;
    const msgBuffer = new TextEncoder().encode(payload);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  ```

## 2. Step-by-Step Backend Implementation (`backend/app.py`)

### Step 2.1: Schema Migration & Import Fingerprint Column

In `backend/app.py`, add `import_hash` to the `paycheques` table definition and ensure migration safety:

```python
def ensure_import_schema(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    cols = {row[1] for row in cur.execute("PRAGMA table_info(paycheques)").fetchall()}
    if "import_hash" not in cols:
        cur.execute("ALTER TABLE paycheques ADD COLUMN import_hash TEXT NULL")
    cur.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_paycheques_import_hash ON paycheques(import_hash) WHERE import_hash IS NOT NULL"
    )
    conn.commit()
```

### Step 2.2: Batch Import API Endpoint (`POST /api/paycheques/import`)

Implement the batch import endpoint in `backend/app.py`:

```python
@app.route("/api/paycheques/import", methods=["POST"])
def api_import_paycheques_batch():
    """
    Accepts a batch of paycheque rows, resolves source names to source IDs,
    computes SHA-256 import hashes, skips duplicates idempotently, and commits atomically.
    """
    try:
        body = request.get_json(force=True)
        rows = body.get("rows", [])
        if not isinstance(rows, list):
            return jsonify({"error": "Expected 'rows' array in payload"}), 400

        conn = get_db_connection()
        cur = conn.cursor()

        # Cache existing sources by case-insensitive name
        sources_res = cur.execute("SELECT id, name FROM sources").fetchall()
        source_map = {row["name"].strip().lower(): row["id"] for row in sources_res}

        imported_count = 0
        skipped_duplicates = 0
        errors: list[dict[str, object]] = []

        with conn:
            for idx, r in enumerate(rows):
                try:
                    source_name = str(r.get("source_name", "")).strip()
                    if not source_name:
                        raise ValueError("Source name is required")

                    source_id = source_map.get(source_name.lower())
                    if not source_id and r.get("auto_create_source"):
                        # Auto-create missing source
                        kind = str(r.get("source_kind", "job")).lower()
                        if kind not in {"job", "government", "other"}:
                            kind = "job"
                        color = str(r.get("source_color", "#3b82f6"))
                        cur.execute(
                            "INSERT INTO sources (name, kind, color, archived) VALUES (?, ?, ?, 0)",
                            (source_name, kind, color),
                        )
                        source_id = cur.lastrowid
                        source_map[source_name.lower()] = source_id

                    if not source_id:
                        raise ValueError(f"Unknown source '{source_name}'. Create source first or enable auto-create.")

                    paid_on = parse_date_string(r.get("paid_on"))
                    amount_cents = parse_optional_cents(r.get("amount"), "amount", allow_zero=False)
                    if amount_cents is None:
                        raise ValueError("Valid net amount is required")

                    gross_cents = parse_optional_cents(r.get("gross"), "gross")
                    tax_cents = parse_optional_cents(r.get("tax"), "tax")
                    deductions_cents = parse_optional_cents(r.get("deductions"), "deductions")
                    gross_cents, tax_cents, deductions_cents = validate_paystub_breakdown(
                        amount_cents, gross_cents, tax_cents, deductions_cents
                    )

                    hours_val = r.get("hours")
                    hours = float(hours_val) if hours_val is not None and str(hours_val).strip() != "" else None
                    if hours is not None and hours <= 0:
                        raise ValueError("Hours must be greater than zero")

                    note = str(r.get("note", "")).strip() or None

                    # Compute import fingerprint
                    import_hash = compute_paycheque_import_hash(source_id, paid_on, amount_cents)

                    # Check duplicate
                    dup = cur.execute("SELECT id FROM paycheques WHERE import_hash = ?", (import_hash,)).fetchone()
                    if dup:
                        skipped_duplicates += 1
                        continue

                    cur.execute(
                        """
                        INSERT INTO paycheques (source_id, paid_on, amount_cents, gross_cents, tax_cents, deductions_cents, hours, note, import_hash)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (source_id, paid_on, amount_cents, gross_cents, tax_cents, deductions_cents, hours, note, import_hash),
                    )
                    imported_count += 1

                except Exception as row_exc:
                    errors.append({"index": idx, "row": r, "error": str(row_exc)})

        return jsonify({
            "ok": True,
            "imported_count": imported_count,
            "skipped_duplicates": skipped_duplicates,
            "error_count": len(errors),
            "errors": errors,
        })

    except Exception as exc:
        return jsonify({"error": str(exc)}), 500
```

## 3. Step-by-Step Frontend Implementation (`frontend/src/features/paystub-import/`)

### Step 3.1: Dedicated Import Page (`frontend/src/app/(dashboard)/import/page.tsx`)

Build a dedicated import workspace route at `/import` with a sleek 3-step wizard:

1. **Step 1: File Dropzone (`CSV` or `JSON`)**:
   * Drag-and-drop file upload area supporting `.csv`, `.txt`, and `.json`.
   * Real-time client-side CSV parser using standard string splitting (handling quoted commas and multiline notes).

2. **Step 2: Column Mapping & Staging Table**:
   * Auto-detects header columns and lets users map CSV columns to Payday fields (`Date`, `Source / Employer`, `Net Amount`, `Gross Pay`, `Tax`, `Deductions`, `Hours Worked`, `Note`).
   * Staging table displays parsed rows with validation highlights (e.g., green for valid rows, red for missing amounts or unknown sources).

3. **Step 3: Source Reconciliation & Import Execution**:
   * Unmatched source names are flagged with a dropdown: `[ Map to existing source ▼ ]` or `[ + Auto-create as Job / Other ]`.
   * **`Import Valid Rows` Button**: Submits the batch via Server Action / API route and displays a success summary: `"Successfully imported 14 paycheques (2 duplicates skipped idempotently)."`.

### Step 3.2: Navigation Bar & Quick Access Upgrade

1. Add an **`Import`** link (or icon) to `navbar.tsx` next to `Allocations` and `Paycheques`.

## 4. Automated Testing Specification (`backend/test_app.py`)

Add the following unit and integration test to `backend/test_app.py`:

1. **`test_idempotent_batch_import_and_deduplication`**:
   * POST to `/api/paycheques/import` with a batch of 3 rows (2 new, 1 duplicate of an existing record).
   * Assert response returns `imported_count == 2` and `skipped_duplicates == 1`.
   * Re-submit the exact same batch and assert `imported_count == 0` and `skipped_duplicates == 3` (idempotent deduplication).

## 5. Agent Execution Checklist

Execute these steps sequentially and verify each before advancing:

* [ ] **Step 1**: Inspect `backend/app.py` to locate table schemas and route handlers.
* [ ] **Step 2**: Implement `ensure_import_schema`, `compute_paycheque_import_hash`, and `POST /api/paycheques/import` in `backend/app.py`.
* [ ] **Step 3**: Add `test_idempotent_batch_import_and_deduplication` to `backend/test_app.py` and run `python backend/test_app.py`.
* [ ] **Step 4**: Create `frontend/src/app/(dashboard)/import/page.tsx` with the 3-step CSV dropzone, column mapper, and source reconciliation staging table.
* [ ] **Step 5**: Add the `Import` link to `navbar.tsx`.
* [ ] **Step 6**: Run `npm run build` (or `npx tsc --noEmit`) inside `frontend/` to confirm zero TypeScript build errors.