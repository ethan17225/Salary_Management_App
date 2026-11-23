"""Async integration tests for Payday FastAPI backend."""

import io
import sys
from collections.abc import AsyncIterator
from datetime import date
from pathlib import Path

import openpyxl
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.allocations import allocate_cents_largest_remainder
from src.database import ensure_schema_migrations, get_db, seed_database
from src.main import app
from src.models import Base
from src.paycheques import extractors
from src.paycheques.constants import MAX_UPLOAD_BYTES
from src.paycheques.parsers import detect_mime
from src.paycheques.utils import parse_cents


@pytest.fixture
async def db_session_factory() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    test_engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = async_sessionmaker(test_engine, expire_on_commit=False)

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as session:
        await seed_database(session)
        await seed_database(session)  # second run must be idempotent

    async def _override_get_db() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        yield session_factory
    finally:
        app.dependency_overrides.clear()
        await test_engine.dispose()


@pytest.fixture
async def client(
    db_session_factory: async_sessionmaker[AsyncSession],
) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def test_parse_cents() -> None:
    assert parse_cents("12.345", "x") == 1235
    assert parse_cents("$1,533.69", "x") == 153369
    assert parse_cents(0.1, "x") == 10
    assert parse_cents("", "x", required=False) is None
    assert parse_cents(None, "x", required=False) is None

    for bad in ("0", "-1", "abc", "nan", "inf", ""):
        with pytest.raises(ValueError):
            parse_cents(bad, "x")


@pytest.mark.asyncio
async def test_seed_totals_and_state(client: AsyncClient) -> None:
    resp = await client.get("/api/state")
    assert resp.status_code == 200
    assert resp.headers.get("cache-control") == "no-store"

    data = resp.json()
    sources_by_id = {s["id"]: s for s in data["sources"]}
    paycheques = data["paycheques"]
    assert len(paycheques) == 63

    def total_for(
        source_name: str | None = None,
        year_prefix: str | None = None,
        kind: str | None = None,
    ) -> int:
        total = 0
        for p in paycheques:
            src = sources_by_id[p["source_id"]]
            if source_name and src["name"] != source_name:
                continue
            if year_prefix and not p["paid_on"].startswith(year_prefix):
                continue
            if kind and src["kind"] != kind:
                continue
            total += p["amount_cents"]
        return total

    assert total_for(source_name="Kung Fu Tea", year_prefix="2025") == 1080975
    assert total_for(source_name="Kung Fu Tea", year_prefix="2026") == 1204466
    assert total_for(source_name="Softchoice", year_prefix="2025") == 1125962
    assert total_for(source_name="Softchoice", year_prefix="2026") == 1205166
    assert total_for(kind="government") == 397355


@pytest.mark.asyncio
async def test_paycheques_crud_and_validation(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/paycheques",
        json={"source_id": 1, "paid_on": "2026-11-20", "amount": "500.10", "hours": ""},
    )
    assert resp.status_code == 201
    created_id = resp.json()["id"]

    state = (await client.get("/api/state")).json()
    created = next(p for p in state["paycheques"] if p["id"] == created_id)
    assert created["amount_cents"] == 50010
    assert created["hours"] is None

    for bad in (
        {"source_id": 1, "paid_on": "2026-13-01", "amount": 1},
        {"source_id": 1, "paid_on": "2026-11-01", "amount": -5},
        {"source_id": 1, "paid_on": "2026-11-01", "amount": 5, "hours": "nan"},
        {"source_id": "x", "paid_on": "2026-11-01", "amount": 5},
    ):
        bad_resp = await client.post("/api/paycheques", json=bad)
        assert bad_resp.status_code == 400
        assert "error" in bad_resp.json()

    missing_src = await client.post(
        "/api/paycheques",
        json={"source_id": 999, "paid_on": "2026-11-20", "amount": "100.00"},
    )
    assert missing_src.status_code == 409
    assert missing_src.json()["error"] == "That source does not exist."

    upd = await client.put(
        f"/api/paycheques/{created_id}",
        json={
            "source_id": 1,
            "paid_on": "2026-11-21",
            "amount": "600.00",
            "hours": 8,
            "note": "Updated",
        },
    )
    assert upd.status_code == 200
    assert upd.json() == {"ok": True}

    del_resp = await client.delete(f"/api/paycheques/{created_id}")
    assert del_resp.status_code == 200
    assert del_resp.json() == {"ok": True}


@pytest.mark.asyncio
async def test_sources_Settings_and_export(client: AsyncClient) -> None:
    # Cannot delete a source that has paycheques
    del_seeded = await client.delete("/api/sources/1")
    assert del_seeded.status_code == 409
    assert del_seeded.json()["error"] == "This source has paycheques. Archive it instead."

    # Duplicate source name rejected (case-insensitive)
    dup = await client.post(
        "/api/sources",
        json={"name": "kung fu tea", "kind": "job", "color": "#0d7480"},
    )
    assert dup.status_code == 409
    assert dup.json()["error"] == "A source with that name already exists."

    # Create, update, list, and delete a fresh source
    new_src = await client.post(
        "/api/sources",
        json={"name": "Freelance", "kind": "other", "color": "#123456"},
    )
    assert new_src.status_code == 201
    new_id = new_src.json()["id"]

    upd_src = await client.put(
        f"/api/sources/{new_id}",
        json={"name": "Freelance Pro", "kind": "other", "color": "#123456", "archived": 1},
    )
    assert upd_src.status_code == 200
    sources_list = await client.get("/api/sources")
    assert sources_list.status_code == 200
    assert any(s["name"] == "Freelance Pro" and s["archived"] == 1 for s in sources_list.json())

    del_new = await client.delete(f"/api/sources/{new_id}")
    assert del_new.status_code == 200

    # 404 Not Found checks
    for missing_url in ("/api/sources/99999", "/api/paycheques/99999", "/api/allocations/99999"):
        assert (await client.delete(missing_url)).status_code == 404
    assert (await client.get("/api/does-not-exist")).status_code == 404
    assert (await client.get("/api/health")).json() == {"ok": True}
    assert len((await client.get("/api/paycheques")).json()) == 63

    # Goal settings update and clear
    set_goal = await client.put("/api/settings", json={"goal": "50,000"})
    assert set_goal.status_code == 200
    state = (await client.get("/api/state")).json()
    assert state["settings"]["goal_cents"] == "5000000"

    clear_goal = await client.put("/api/settings", json={"goal": ""})
    assert clear_goal.status_code == 200
    state = (await client.get("/api/state")).json()
    assert "goal_cents" not in state["settings"]

    # CSV export
    csv_resp = await client.get("/api/export.csv")
    assert csv_resp.status_code == 200
    assert "text/csv" in csv_resp.headers["content-type"]
    assert "attachment; filename=" in csv_resp.headers["content-disposition"]
    assert len(csv_resp.text.strip().splitlines()) == 64


def test_idempotent_schema_migration() -> None:
    import sqlite3

    conn = sqlite3.connect(":memory:")
    conn.execute(
        "CREATE TABLE sources ("
        "id INTEGER PRIMARY KEY, name TEXT, kind TEXT, color TEXT, archived INTEGER)"
    )
    conn.execute(
        "CREATE TABLE paycheques ("
        "id INTEGER PRIMARY KEY, source_id INTEGER, paid_on TEXT, "
        "amount_cents INTEGER, hours REAL, note TEXT)"
    )
    ensure_schema_migrations(conn)
    ensure_schema_migrations(conn)

    src_cols = {r[1] for r in conn.execute("PRAGMA table_info(sources)").fetchall()}
    pay_cols = {r[1] for r in conn.execute("PRAGMA table_info(paycheques)").fetchall()}
    alias_cols = {r[1] for r in conn.execute("PRAGMA table_info(source_aliases)").fetchall()}
    assert {"is_tax_withheld", "tax_reserve_bps", "pay_schedule"} <= src_cols
    assert {"gross_cents", "tax_cents", "deductions_cents", "import_hash"} <= pay_cols
    assert {"id", "raw_name", "source_id"} <= alias_cols


@pytest.mark.asyncio
async def test_create_paycheque_with_paystub_breakdown(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/paycheques",
        json={
            "source_id": 1,
            "paid_on": "2026-03-15",
            "amount": "1500.00",
            "gross": "2000.00",
            "tax": "350.00",
            "deductions": "150.00",
            "hours": 80,
        },
    )
    assert resp.status_code in (200, 201)
    cid = resp.json()["id"]

    state = (await client.get("/api/state")).json()
    p = next(x for x in state["paycheques"] if x["id"] == cid)
    assert p["amount_cents"] == 150000
    assert p["gross_cents"] == 200000
    assert p["tax_cents"] == 35000
    assert p["deductions_cents"] == 15000

    # Auto-derive gross_cents when only tax and deductions are supplied
    auto_resp = await client.post(
        "/api/paycheques",
        json={
            "source_id": 1,
            "paid_on": "2026-03-20",
            "amount": "1000.00",
            "tax": "200.00",
            "deductions": "50.00",
            "note": "=SUM(A1:A2)",
        },
    )
    assert auto_resp.status_code == 201
    auto_id = auto_resp.json()["id"]
    state2 = (await client.get("/api/state")).json()
    p2 = next(x for x in state2["paycheques"] if x["id"] == auto_id)
    assert p2["gross_cents"] == 125000

    # Verify CSV formula injection protection prefixes leading '=' with "'"
    csv_text = (await client.get("/api/export.csv")).text
    assert "'=SUM(A1:A2)" in csv_text


@pytest.mark.asyncio
async def test_reject_invalid_gross_to_net_invariants(client: AsyncClient) -> None:
    r1 = await client.post(
        "/api/paycheques",
        json={
            "source_id": 1,
            "paid_on": "2026-03-15",
            "amount": "1500.00",
            "gross": "1200.00",
        },
    )
    assert r1.status_code == 400

    r2 = await client.post(
        "/api/paycheques",
        json={
            "source_id": 1,
            "paid_on": "2026-03-15",
            "amount": "1500.00",
            "gross": "2000.00",
            "tax": "400.00",
            "deductions": "200.00",
        },
    )
    assert r2.status_code == 400


@pytest.mark.asyncio
async def test_untaxed_source_and_csv_export(client: AsyncClient) -> None:
    src_resp = await client.post(
        "/api/sources",
        json={
            "name": "Freelance Design",
            "kind": "other",
            "color": "#8b5cf6",
            "is_tax_withheld": 0,
            "tax_reserve_bps": 2500,
        },
    )
    assert src_resp.status_code == 201
    sid = src_resp.json()["id"]

    pay_resp = await client.post(
        "/api/paycheques",
        json={"source_id": sid, "paid_on": "2026-04-01", "amount": "1000.00"},
    )
    assert pay_resp.status_code == 201

    csv_resp = await client.get("/api/export.csv")
    assert csv_resp.status_code == 200
    lines = csv_resp.text.strip().splitlines()
    assert lines[0] == "date,source,amount,gross,tax,deductions,tax_reserve,hours,note"
    row = next(line for line in lines if "Freelance Design" in line)
    assert "250.00" in row.split(",")


def test_largest_remainder_exact_cent_invariant() -> None:
    rules_100 = [
        {"id": 1, "name": "A", "category": "essentials", "color": "#3b82f6", "weight_bps": 3334},
        {"id": 2, "name": "B", "category": "investments", "color": "#10b981", "weight_bps": 3333},
        {"id": 3, "name": "C", "category": "lifestyle", "color": "#8b5cf6", "weight_bps": 3333},
    ]
    res1 = allocate_cents_largest_remainder(100000, rules_100)
    allocs1 = [b["allocated_cents"] for b in res1["buckets"]]
    assert allocs1 == [33340, 33330, 33330]
    assert sum(allocs1) + res1["unallocated_cents"] == 100000

    rules_9999 = [
        {"id": 1, "name": "A", "category": "essentials", "color": "#3b82f6", "weight_bps": 3333},
        {"id": 2, "name": "B", "category": "investments", "color": "#10b981", "weight_bps": 3333},
        {"id": 3, "name": "C", "category": "lifestyle", "color": "#8b5cf6", "weight_bps": 3333},
    ]
    res2 = allocate_cents_largest_remainder(100, rules_9999)
    allocs2 = [b["allocated_cents"] for b in res2["buckets"]]
    assert allocs2 == [33, 33, 33]
    assert res2["unallocated_cents"] == 1
    assert sum(allocs2) + res2["unallocated_cents"] == 100

    rules_50_30_20 = [
        {"id": 1, "name": "A", "category": "essentials", "color": "#3b82f6", "weight_bps": 5000},
        {"id": 2, "name": "B", "category": "lifestyle", "color": "#8b5cf6", "weight_bps": 3000},
        {"id": 3, "name": "C", "category": "investments", "color": "#10b981", "weight_bps": 2000},
    ]
    res3 = allocate_cents_largest_remainder(1337, rules_50_30_20)
    allocs3 = [b["allocated_cents"] for b in res3["buckets"]]
    assert sum(allocs3) + res3["unallocated_cents"] == 1337
    assert res3["unallocated_cents"] == 0


@pytest.mark.asyncio
async def test_allocation_crud_and_100_percent_cap(client: AsyncClient) -> None:
    r1 = await client.post(
        "/api/allocations",
        json={
            "name": "Essentials",
            "category": "essentials",
            "weight_bps": 6000,
            "color": "#3b82f6",
        },
    )
    assert r1.status_code in (200, 201)
    id1 = r1.json()["id"]

    r2 = await client.post(
        "/api/allocations",
        json={
            "name": "Investments",
            "category": "investments",
            "weight_bps": 5000,
            "color": "#10b981",
        },
    )
    assert r2.status_code == 400
    assert "100%" in r2.json()["error"]

    r3 = await client.post(
        "/api/allocations",
        json={
            "name": "Paused Bucket",
            "category": "lifestyle",
            "percentage": "50",
            "color": "#0e7490",
            "active": 0,
        },
    )
    assert r3.status_code in (200, 201)
    id3 = r3.json()["id"]

    # Duplicate bucket name returns 409
    dup_alloc = await client.post(
        "/api/allocations",
        json={
            "name": "essentials",
            "category": "essentials",
            "percentage": 10,
            "color": "#2563eb",
        },
    )
    assert dup_alloc.status_code == 409

    upd = await client.put(
        f"/api/allocations/{id1}",
        json={
            "name": "Essentials Updated",
            "category": "essentials",
            "weight_bps": 5500,
            "color": "#3b82f6",
            "active": 1,
        },
    )
    assert upd.status_code == 200

    del_resp = await client.delete(f"/api/allocations/{id3}")
    assert del_resp.status_code == 200


@pytest.mark.asyncio
async def test_allocation_presets_endpoint(client: AsyncClient) -> None:
    resp = await client.post("/api/allocations/presets", json={"preset": "student-coop"})
    assert resp.status_code == 200
    assert resp.json()["count"] == 4

    list_resp = await client.get("/api/allocations")
    assert list_resp.status_code == 200
    payload = list_resp.json()
    assert len(payload["allocations"]) == 4
    assert sum(r["weight_bps"] for r in payload["allocations"]) == 10000
    assert payload["total_active_bps"] == 10000
    assert payload["unallocated_bps"] == 0


@pytest.mark.asyncio
async def test_state_endpoint_includes_allocations(client: AsyncClient) -> None:
    await client.post("/api/allocations/presets", json={"preset": "50-30-20"})
    resp = await client.get("/api/state")
    assert resp.status_code == 200
    data = resp.json()
    assert "allocations" in data
    assert isinstance(data["allocations"], list)
    assert len(data["allocations"]) == 3


@pytest.mark.asyncio
async def test_source_pay_schedule_persistence_and_validation(client: AsyncClient) -> None:
    bad = await client.post(
        "/api/sources",
        json={"name": "Bad Sched", "kind": "job", "pay_schedule": "daily"},
    )
    assert bad.status_code == 400

    created = await client.post(
        "/api/sources",
        json={"name": "Biweekly Co", "kind": "job", "pay_schedule": "biweekly"},
    )
    assert created.status_code == 201
    sid = created.json()["id"]

    sources = (await client.get("/api/sources")).json()
    match = next(s for s in sources if s["id"] == sid)
    assert match["pay_schedule"] == "biweekly"

    upd = await client.put(
        f"/api/sources/{sid}",
        json={"name": "Biweekly Co", "kind": "job", "pay_schedule": "irregular"},
    )
    assert upd.status_code == 200
    sources_after = (await client.get("/api/sources")).json()
    assert next(s for s in sources_after if s["id"] == sid)["pay_schedule"] == "irregular"


@pytest.mark.asyncio
async def test_filtered_csv_export(client: AsyncClient) -> None:
    bad_year = await client.get("/api/export.csv?year=abc")
    assert bad_year.status_code == 400

    await client.post(
        "/api/paycheques",
        json={
            "source_id": 1,
            "paid_on": "2025-12-30",
            "amount": "123.45",
            "note": '=HYPERLINK("http://evil")',
        },
    )

    resp = await client.get("/api/export.csv?year=2025&source_id=1&q=HYPERLINK")
    assert resp.status_code == 200
    assert "paycheques-2025-" in resp.headers["content-disposition"]
    lines = resp.text.strip().splitlines()
    assert len(lines) == 2
    assert "'=HYPERLINK" in lines[1]


@pytest.mark.asyncio
async def test_idempotent_csv_import(client: AsyncClient) -> None:
    # Re-importing the exported database skips 100% of existing seeded paycheques
    exported = (await client.get("/api/export.csv")).text
    reimport = await client.post(
        "/api/paycheques/import",
        json={"csv_text": exported, "auto_create_sources": True},
    )
    assert reimport.status_code == 200
    reimport_data = reimport.json()
    assert reimport_data["imported_count"] == 0
    assert reimport_data["skipped_duplicates"] == 63

    # Importing new rows with auto_create_sources=True creates source + imports rows
    new_csv = (
        "date,source,amount,gross,tax,deductions,hours,note\n"
        "2026-10-01,Acme Consulting,1200.00,1500.00,250.00,50.00,30,Sprint 1\n"
        "2026-10-15,Kung Fu Tea,500.00,,,,20,Shift\n"
        "bad-date,Kung Fu Tea,100.00,,,,,\n"
    )
    first = await client.post(
        "/api/paycheques/import",
        json={"csv_text": new_csv, "auto_create_sources": True},
    )
    assert first.status_code == 200
    d1 = first.json()
    assert d1["imported_count"] == 2
    assert d1["created_sources"] == 1
    assert d1["error_count"] == 1

    # Re-submitting valid rows skips duplicates idempotently
    second = await client.post(
        "/api/paycheques/import",
        json={"csv_text": new_csv, "auto_create_sources": False},
    )
    assert second.status_code == 200
    d2 = second.json()
    assert d2["imported_count"] == 0
    assert d2["skipped_duplicates"] == 2
    assert d2["error_count"] == 1


async def _upload(client: AsyncClient, name: str, content: bytes):
    return await client.post("/api/paycheques/parse", files={"file": (name, content)})


@pytest.mark.asyncio
async def test_parse_upload_guards_and_fuzzy_spreadsheets(client: AsyncClient) -> None:
    # Magic bytes beat extensions; binaries can't pose as CSV
    assert detect_mime(b"%PDF-1.7", "stub.csv") == "application/pdf"
    assert detect_mime(b"\x89PNG\r\n\x1a\n", "photo.jpg") == "image/png"
    assert (await _upload(client, "evil.pdf", b"MZ\x90\x00")).status_code == 415
    assert (await _upload(client, "evil.csv", b"MZ\x00\x00")).status_code == 415
    assert (await _upload(client, "empty.csv", b"")).status_code == 400
    assert (await _upload(client, "big.csv", b"a" * (MAX_UPLOAD_BYTES + 1))).status_code == 413

    csv_text = (
        "Pay Date,Take-Home,Gross Pay,Income Tax,Employer,Bonus\n"
        '2026-11-14,"$1,842.50",2500,400,Acme,x\n'
        "11/28/2026,900,800,,Acme,\n"
    )
    data = (await _upload(client, "bank.csv", csv_text.encode())).json()
    assert data["parser_used"] == "tabular" and data["unmapped_columns"] == ["Bonus"]
    first, second = data["rows"]
    assert (first["paid_on"], first["amount"]) == ("2026-11-14", "1842.50")
    assert first["warnings"] == ["Gross minus tax and deductions doesn't equal take-home"]
    assert second["paid_on"] == "2026-11-28"
    assert second["warnings"] == ["Gross pay must be greater than or equal to net pay."]

    wb = openpyxl.Workbook()
    wb.active.append(["Payment Date", "Net Pay", "Gross", "Taxes", "Deductions"])
    wb.active.append([date(2026, 12, 1), 1500, 2000.004, 350, 150])
    buf = io.BytesIO()
    wb.save(buf)
    [row] = (await _upload(client, "stubs.xlsx", buf.getvalue())).json()["rows"]
    assert (row["paid_on"], row["amount"], row["gross"]) == ("2026-12-01", "1500.00", "2000.00")
    assert row["warnings"] == [] and row["confidence"] == 1.0

    # Stage 2: reviewed rows commit through the unchanged import endpoint
    imp = await client.post(
        "/api/paycheques/import",
        json={"rows": [{**row, "source_name": "Acme Parse Co"}], "auto_create_sources": True},
    )
    assert imp.json()["imported_count"] == 1 and imp.json()["created_sources"] == 1


@pytest.mark.asyncio
async def test_parse_pdf_ocr_escalation_and_llm_fallback(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    stub = (
        "ACME CORP\nPay Date: Nov 14, 2026\nGross Pay 2,500.00 30,000.00\n"
        "Total Taxes 400.00\nTotal Deductions 257.50\nNet Pay $1,842.50 22,110.00"
    )
    monkeypatch.setattr(extractors, "pdf_extract", lambda _c: (stub, []))
    data = (await _upload(client, "stub.pdf", b"%PDF-1.7 fake")).json()
    [row] = data["rows"]
    assert data["parser_used"] == "pdf_text" and not data["used_llm_fallback"]
    assert (row["paid_on"], row["amount"], row["gross"], row["tax"], row["deductions"]) == (
        "2026-11-14",
        "1842.50",
        "2500.00",
        "400.00",
        "257.50",
    )  # Current column, not YTD
    assert row["warnings"] == []

    # No text layer -> OCR tier; regex misses the date -> local LLM fallback wins
    monkeypatch.setattr(extractors, "pdf_extract", lambda _c: ("", []))
    monkeypatch.setattr(extractors, "ocr_text", lambda _c, _m, **_kw: ("Net Pay 1,842.50", 0.93))
    monkeypatch.setattr(extractors, "llm_available", lambda: True)
    monkeypatch.setattr(
        extractors,
        "llm_extract",
        lambda _t, **_kw: {"paid_on": "2026-11-14", "amount": 1842.5, "source_name": "Acme"},
    )
    data = (await _upload(client, "scan.pdf", b"%PDF-1.7 fake")).json()
    [row] = data["rows"]
    assert data["parser_used"] == "ocr" and data["used_llm_fallback"]
    assert (row["paid_on"], row["amount"], row["source_name"]) == ("2026-11-14", "1842.50", "Acme")
    assert row["confidence"] == 0.75 and row["warnings"] == []

    # OCR boxes regroup into visual lines, left-to-right
    box = lambda x, y: [[x, y], [x + 80, y], [x + 80, y + 20], [x, y + 20]]  # noqa: E731
    boxes = [box(300, 10), box(10, 12), box(10, 60)]
    lines = extractors._visual_lines(boxes, ["1,842.50", "Net Pay", "Gross"])
    assert lines == ["Net Pay  1,842.50", "Gross"]


@pytest.mark.asyncio
async def test_peoplesoft_paystub_tables_known_sources_and_llm_guard(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    sheridan_ocr = (
        "Sheridan College   Pay Group: NFT\n"
        "Pay Begin Date: 08/23/2026\n"
        "Pay End Date: 09/05/2026\n"
        "Advice Date: 09/18/2026\n"
        "TOTAL GROSS CIT TAXABLE GROSS TOTAL TAXES TOTAL DEDUCTIONS NET PAY\n"
        "Current: 142.78 139.03 2.82 3.75 136.21\n"
        "YTD: 142.78 139.03 2.82 3.75 136.21\n"
    )
    monkeypatch.setattr(extractors, "pdf_extract", lambda _c: (sheridan_ocr, []))
    res = (await _upload(client, "sheridan.pdf", b"%PDF-1.7 fake")).json()
    [row] = res["rows"]
    assert res["parser_used"] == "pdf_text" and not res["used_llm_fallback"]
    assert (
        row["source_name"],
        row["paid_on"],
        row["gross"],
        row["tax"],
        row["deductions"],
        row["amount"],
    ) == ("Sheridan College", "2026-09-18", "142.78", "2.82", "3.75", "136.21")
    assert row["warnings"] == []

    # Ruled pdfplumber table with packed Current/YTD cells + known DB source match
    tables = [
        [
            ["", "TOTAL GROSS", "CIT TAXABLE GROSS", "TOTAL TAXES", "TOTAL DEDUCTIONS", "NET PAY"],
            [
                "Current:\nYTD:",
                "142.78\n142.78",
                "139.03\n139.03",
                "2.82\n2.82",
                "3.75\n3.75",
                "136.21\n136.21",
            ],
        ]
    ]
    monkeypatch.setattr(
        extractors,
        "pdf_extract",
        lambda _c: ("PAY ADVICE\nKung Fu Tea\nAdvice Date: 09/18/2026\n", tables),
    )
    res2 = (await _upload(client, "ruled.pdf", b"%PDF-1.7 fake")).json()
    [row2] = res2["rows"]
    assert not res2["used_llm_fallback"] and row2["warnings"] == []
    assert (row2["source_name"], row2["paid_on"], row2["amount"], row2["gross"]) == (
        "Kung Fu Tea",
        "2026-09-18",
        "136.21",
        "142.78",
    )

    # LLM math-collapse guard clears copied net pay out of tax/deductions
    monkeypatch.setattr(extractors, "pdf_extract", lambda _c: ("Unlabeled stub text 2026", []))
    monkeypatch.setattr(extractors, "llm_available", lambda: True)
    monkeypatch.setattr(
        extractors,
        "llm_extract",
        lambda _t, **_kw: {
            "source_name": "Sheridan College",
            "paid_on": "2026-09-18",
            "gross": "142.78",
            "tax": "136.21",
            "deductions": "136.21",
            "amount": "136.21",
        },
    )
    res3 = (await _upload(client, "weird.pdf", b"%PDF-1.7 fake")).json()
    [row3] = res3["rows"]
    assert res3["used_llm_fallback"] and row3["warnings"] == []
    assert (row3["gross"], row3["amount"], row3["tax"], row3["deductions"]) == (
        "142.78",
        "136.21",
        None,
        None,
    )


def test_cheque_preprocessing_dates_written_amount_and_sanity_guards() -> None:
    from PIL import Image

    from src.paycheques.parsers import check_row, clean_date, parse_written_amount
    from src.paycheques.schemas import ParsedPaychequeRow

    # Dark countertop background auto-crops; clean white scan stays uncropped
    dark = Image.new("RGB", (400, 300), (30, 30, 30))
    dark.paste(Image.new("RGB", (260, 170), (245, 245, 240)), (70, 65))
    cropped = extractors.preprocess_document_image(dark)
    assert cropped.mode == "RGB" and cropped.size[0] < 340 and cropped.size[1] < 240

    white = Image.new("RGB", (400, 300), (255, 255, 255))
    assert extractors.preprocess_document_image(white).size == (400, 300)

    assert clean_date("Nov 20 / 26") == "2026-11-20"
    assert clean_date("Nov 20/26") == "2026-11-20"
    assert parse_written_amount("Six hundred eleven 86/100 DOLLARS") == "611.86"
    assert parse_written_amount("One thousand two hundred fifty and 00/100") == "1250.00"

    # Guard 1: reject numbered-corp ID & zero out gross/tax/deductions/hours in cheque mode
    corp_row = check_row(
        ParsedPaychequeRow(
            source_name="Kung Fu Tea",
            paid_on="2026-11-20",
            amount="5024721.00",
            gross="5024721.00",
            tax="10.00",
            deductions="5.00",
            hours=40.0,
            document_type="cheque",
        ),
        raw_text="5024721 ONTARIO LIMITED\nKUNG FU TEA\nPAY TO THE ORDER OF",
    )
    assert corp_row.amount is None and corp_row.gross is None and corp_row.tax is None
    assert corp_row.deductions is None and corp_row.hours is None and corp_row.confidence <= 0.3
    assert "Ignored company registration number; enter cheque amount manually" in corp_row.warnings

    # Guard 2: reject cheque number collision
    chq_row = check_row(
        ParsedPaychequeRow(
            source_name="Acme", paid_on="2026-11-20", amount="730.00", document_type="cheque"
        ),
        cheque_number="0730",
    )
    assert chq_row.amount is None
    assert "Ignored cheque number; enter cheque amount manually" in chq_row.warnings

    # Guard 3: outlier threshold > $25,000
    big_row = check_row(
        ParsedPaychequeRow(source_name="Acme", paid_on="2026-11-20", amount="26000.00")
    )
    assert big_row.amount == "26000.00" and big_row.confidence <= 0.35
    assert "Unusually large amount — verify against source document" in big_row.warnings


@pytest.mark.asyncio
async def test_vision_ocr_cheque_cross_check_and_rapidocr_fallback(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import httpx
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (200, 100), "white").save(buf, format="PNG")
    png_bytes = buf.getvalue()

    monkeypatch.setattr(extractors, "vision_available", lambda: True)

    async def _vision_match(_images: list, **_kw: object) -> dict:
        return {
            "document_type": "cheque",
            "source_name": "Kung Fu Tea",
            "paid_on": "2026-11-20",
            "numeric_amount": "611.86",
            "written_amount": "Six hundred eleven 86/100",
            "cheque_number": "0730",
        }

    monkeypatch.setattr(extractors, "vision_extract", _vision_match)
    res1 = (await _upload(client, "cheque.png", png_bytes)).json()
    [r1] = res1["rows"]
    assert res1["parser_used"] == "vision" and r1["document_type"] == "cheque"
    assert (r1["source_name"], r1["paid_on"], r1["amount"], r1["confidence"]) == (
        "Kung Fu Tea",
        "2026-11-20",
        "611.86",
        0.95,
    )
    assert r1["warnings"] == []

    async def _vision_mismatch(_images: list, **_kw: object) -> dict:
        return {
            "document_type": "cheque",
            "source_name": "Kung Fu Tea",
            "paid_on": "2026-11-20",
            "numeric_amount": "611.86",
            "written_amount": "618.86",
        }

    monkeypatch.setattr(extractors, "vision_extract", _vision_mismatch)
    [r2] = (await _upload(client, "cheque.png", png_bytes)).json()["rows"]
    assert r2["confidence"] == 0.4 and "disagree" in r2["warnings"][0]

    async def _vision_offline(_images: list, **_kw: object) -> dict:
        raise httpx.ConnectError("vision server offline")

    monkeypatch.setattr(extractors, "vision_extract", _vision_offline)
    cheque_ocr = (
        "5024721 ONTARIO LIMITED\nKUNG FU TEA\n"
        "PAY TO THE ORDER OF   DATE Nov 20 / 26\n"
        "Six hundred eleven 86/100 DOLLARS\n"
    )
    monkeypatch.setattr(extractors, "ocr_text", lambda _c, _m, **_kw: (cheque_ocr, 0.91))
    res3 = (await _upload(client, "cheque.png", png_bytes)).json()
    [r3] = res3["rows"]
    assert res3["parser_used"] == "ocr" and r3["document_type"] == "cheque"
    assert (r3["source_name"], r3["paid_on"], r3["amount"]) == (
        "Kung Fu Tea",
        "2026-11-20",
        "611.86",
    )
    assert r3["warnings"] == []


def test_ocr_runtime_switch() -> None:
    from src.config import AppConfig

    assert (
        AppConfig(
            OCR_RUNTIME="docker", VISION_API_BASE_URL="http://host.docker.internal:11434/v1"
        ).effective_vision_base_url
        is None
    )
    assert (
        AppConfig(OCR_RUNTIME="LOCAL").effective_vision_base_url
        == "http://host.docker.internal:11434/v1"
    )
    assert (
        AppConfig(
            OCR_RUNTIME="local", VISION_API_BASE_URL="http://localhost:1234/v1"
        ).effective_vision_base_url
        == "http://localhost:1234/v1"
    )


@pytest.mark.asyncio
async def test_corrupted_adp_pdf_escalates_to_vision_and_reconciles_withholdings(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from PIL import Image

    from src.paycheques.parsers import _reconcile_vision_withholdings

    corrupted_adp = (
        "(cid:0)(cid:0)(cid:0) Earnings Statement\n"
        "Period Beginning: 08/16/2026\nPeriod Ending: 08/31/2026\nPay Date: 08/31/2026\n"
        "Gross Pay $1 718 09\nNet Pay $1 405 71\n"
    )
    monkeypatch.setattr(extractors, "pdf_extract", lambda _c: (corrupted_adp, []))

    # Case 1 (local Vision): broken pdf_text escalates to Vision & reconciles statutory lines
    monkeypatch.setattr(extractors, "vision_available", lambda: True)
    monkeypatch.setattr(
        extractors, "prepare_images", lambda _c, _m: [Image.new("RGB", (50, 50), "white")]
    )

    async def _adp_vision(_images: list, **_kw: object) -> dict:
        return {
            "document_type": "paystub",
            "source_name": "Softchoice",
            "paid_on": "2026-08-31",
            "numeric_amount": "1405.71",
            "gross": "1718.09",
            "tax": "190.83",
            "deductions": "405.71",
            "withholdings": [
                {"label": "Federal Tax", "amount": "190.83"},
                {"label": "EI", "amount": "28.00"},
                {"label": "CPP", "amount": "93.55"},
            ],
            "hours": 78.67,
        }

    monkeypatch.setattr(extractors, "vision_extract", _adp_vision)
    res1 = (await _upload(client, "adp.pdf", b"%PDF-1.7 fake")).json()
    [r1] = res1["rows"]
    assert res1["parser_used"] == "vision" and not res1["used_llm_fallback"]
    assert (
        r1["source_name"],
        r1["paid_on"],
        r1["amount"],
        r1["gross"],
        r1["tax"],
        r1["deductions"],
        r1["hours"],
    ) == ("Softchoice", "2026-08-31", "1405.71", "1718.09", "312.38", "0.00", 78.67)
    assert r1["warnings"] == []

    # Case 2 (Docker mode): CID-corrupted pdf_text escalates to RapidOCR
    monkeypatch.setattr(extractors, "vision_available", lambda: False)
    clean_ocr = "Softchoice\nPay Date: 08/31/2026\nGross Pay $1,718.09\nNet Pay $1,405.71\n"
    monkeypatch.setattr(extractors, "ocr_text", lambda _c, _m, **_kw: (clean_ocr, 0.98))
    res2 = (await _upload(client, "adp.pdf", b"%PDF-1.7 fake")).json()
    [r2] = res2["rows"]
    assert res2["parser_used"] == "ocr"
    assert (r2["source_name"], r2["paid_on"], r2["amount"], r2["gross"]) == (
        "Softchoice",
        "2026-08-31",
        "1405.71",
        "1718.09",
    )
    assert r2["warnings"] == []

    # Case 3: Preserve already-reconciled totals & clear impossible deductions without withholdings
    assert _reconcile_vision_withholdings({}, "142.78", "136.21", "2.82", "3.75") == (
        "2.82",
        "3.75",
    )
    assert _reconcile_vision_withholdings({}, "1718.09", "1405.71", "190.83", "405.71") == (
        "190.83",
        None,
    )


@pytest.mark.asyncio
async def test_import_pipeline_logs_capture_parse_steps_errors_and_linked_imports(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import sqlite3

    from PIL import Image

    corrupted_adp = (
        "(cid:0)(cid:0) Earnings Statement\n"
        "Period Beginning: 08/16/2026\nPeriod Ending: 08/31/2026\nPay Date: 08/31/2026\n"
        "Gross Pay $1 718 09\nNet Pay $1 405 71\n"
    )
    monkeypatch.setattr(extractors, "pdf_extract", lambda _c: (corrupted_adp, []))
    monkeypatch.setattr(extractors, "vision_available", lambda: True)
    monkeypatch.setattr(
        extractors, "prepare_images", lambda _c, _m: [Image.new("RGB", (80, 100), "white")]
    )
    raw_vision_payload = {
        "document_type": "paystub",
        "source_name": "Softchoice",
        "paid_on": "2026-08-31",
        "numeric_amount": "1405.71",
        "gross": "1718.09",
        "tax": "190.83",
        "deductions": "405.71",
        "withholdings": [
            {"label": "Federal Tax", "amount": "190.83"},
            {"label": "EI", "amount": "28.00"},
            {"label": "CPP", "amount": "93.55"},
        ],
        "hours": 78.67,
    }

    async def _mock_vision(_images: list, **_kw: object) -> dict:
        return raw_vision_payload

    monkeypatch.setattr(extractors, "vision_extract", _mock_vision)
    parse_res = (await _upload(client, "softchoice_adp.pdf", b"%PDF-1.7 fake adp")).json()
    parse_log_id = parse_res["parse_log_id"]
    assert isinstance(parse_log_id, int) and parse_log_id > 0

    logs = (await client.get("/api/paycheques/import-logs")).json()
    assert any(item["id"] == parse_log_id for item in logs)

    detail = (await client.get(f"/api/paycheques/import-logs/{parse_log_id}")).json()
    assert detail["stage"] == "parse" and detail["status"] == "ok"
    assert detail["parser_used"] == "vision" and detail["warning_count"] == 0
    assert detail["step_names"] == [
        "detect_mime",
        "pdf_extract",
        "deterministic_text",
        "prepare_images",
        "vision_extract",
        "reconcile_withholdings",
        "vision_row",
    ]
    steps_by_name = {s["step"]: s for s in detail["steps"]}
    assert steps_by_name["prepare_images"]["output"]["sizes"] == [[80, 100]]
    assert steps_by_name["vision_extract"]["output"]["raw_output"] == raw_vision_payload
    assert steps_by_name["reconcile_withholdings"]["output"]["after"] == {
        "tax": "312.38",
        "deductions": "0.00",
    }
    assert detail["response"]["rows"][0]["amount"] == "1405.71"

    # Stage 2: submit reviewed row linked to Stage 1 parse_log_id
    imp = await client.post(
        "/api/paycheques/import",
        json={
            "parse_log_id": parse_log_id,
            "auto_create_sources": True,
            "rows": [
                {
                    "source_name": "Softchoice",
                    "paid_on": "2026-09-15",
                    "amount": "1405.71",
                    "gross": "1718.09",
                    "tax": "312.38",
                    "deductions": "0.00",
                    "hours": 78.67,
                    "note": "Verified from ADP",
                }
            ],
        },
    )
    assert imp.status_code == 200 and imp.json()["imported_count"] == 1

    import_logs = (await client.get("/api/paycheques/import-logs?stage=import")).json()
    assert len(import_logs) == 1
    import_log_id = import_logs[0]["id"]
    assert import_logs[0]["parse_log_id"] == parse_log_id

    import_detail = (await client.get(f"/api/paycheques/import-logs/{import_log_id}")).json()
    assert import_detail["steps"][0]["output"]["submitted_rows"]["rows"][0]["note"] == (
        "Verified from ADP"
    )
    refreshed_parse = (await client.get(f"/api/paycheques/import-logs/{parse_log_id}")).json()
    assert import_log_id in refreshed_parse["linked_import_ids"]

    # Warning filter: upload CSV with warning row + unsupported 415 error
    bad_csv = b"date,source,amount,gross\n2026-11-28,Acme,900,800\n"
    warn_res = (await _upload(client, "warn.csv", bad_csv)).json()
    warn_logs = (await client.get("/api/paycheques/import-logs?has_warnings=true")).json()
    assert any(item["id"] == warn_res["parse_log_id"] for item in warn_logs)

    bad_upload = await _upload(client, "bad.exe", b"MZ\x90\x00")
    assert bad_upload.status_code == 415
    err_logs = (await client.get("/api/paycheques/import-logs?status=error")).json()
    assert len(err_logs) == 1 and err_logs[0]["filename"] == "bad.exe"

    assert (await client.get("/api/paycheques/import-logs/999999")).status_code == 404

    # ensure_schema_migrations creates import_pipeline_logs on older SQLite schemas idempotently
    conn = sqlite3.connect(":memory:")
    conn.execute(
        "CREATE TABLE sources ("
        "id INTEGER PRIMARY KEY, name TEXT, kind TEXT, color TEXT, archived INTEGER)"
    )
    conn.execute(
        "CREATE TABLE paycheques ("
        "id INTEGER PRIMARY KEY, source_id INTEGER, paid_on TEXT, "
        "amount_cents INTEGER, hours REAL, note TEXT)"
    )
    ensure_schema_migrations(conn)
    ensure_schema_migrations(conn)
    log_cols = {r[1] for r in conn.execute("PRAGMA table_info(import_pipeline_logs)").fetchall()}
    assert {
        "id",
        "created_at",
        "stage",
        "status",
        "parse_log_id",
        "steps_json",
        "response_json",
    } <= log_cols


@pytest.mark.asyncio
async def test_multi_row_summary_and_multipage_pdfs(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from PIL import Image

    # 1. Ruled tabular summary PDF (multi-row)
    summary_tables = [
        [
            ["Pay Date", "Source", "Gross", "Taxes", "Deductions", "Net Pay"],
            ["2026-11-01", "Softchoice", "2000.00", "350.00", "150.00", "1500.00"],
            ["2026-11-15", "Softchoice", "2100.00", "370.00", "160.00", "1570.00"],
        ]
    ]
    monkeypatch.setattr(
        extractors, "pdf_extract", lambda _c: ("Annual Payroll Summary", summary_tables)
    )
    res_tbl = (await _upload(client, "summary_table.pdf", b"%PDF-1.7 fake")).json()
    assert res_tbl["parser_used"] == "pdf_text" and len(res_tbl["rows"]) == 2
    assert (res_tbl["rows"][0]["paid_on"], res_tbl["rows"][0]["amount"]) == (
        "2026-11-01",
        "1500.00",
    )
    assert (res_tbl["rows"][1]["paid_on"], res_tbl["rows"][1]["amount"]) == (
        "2026-11-15",
        "1570.00",
    )

    # 2. Text-aligned summary PDF (Salary.pdf style with section headers)
    salary_pdf_text = (
        "Annual Income Summary\n"
        "Kung Fu Tea\n"
        "2026-10-15 554.36 Biweekly shift\n"
        "2026-10-28 619.82 Biweekly shift\n"
        "Softchoice\n"
        "2026-11-15 1405.71 Co-op term\n"
    )
    monkeypatch.setattr(extractors, "pdf_extract", lambda _c: (salary_pdf_text, []))
    res_list = (await _upload(client, "Salary.pdf", b"%PDF-1.7 fake")).json()
    assert res_list["parser_used"] == "pdf_text" and len(res_list["rows"]) == 3
    assert (
        res_list["rows"][0]["source_name"],
        res_list["rows"][0]["paid_on"],
        res_list["rows"][0]["amount"],
        res_list["rows"][0]["note"],
    ) == ("Kung Fu Tea", "2026-10-15", "554.36", "Biweekly shift")
    assert (
        res_list["rows"][2]["source_name"],
        res_list["rows"][2]["paid_on"],
        res_list["rows"][2]["amount"],
        res_list["rows"][2]["note"],
    ) == ("Softchoice", "2026-11-15", "1405.71", "Co-op term")

    # 3. Multi-page paystub PDF in Tier 2 (pdf_text)
    two_page_stubs = (
        "Softchoice\nAdvice Date: 2026-08-15\nGross Pay $1,700.00\nTotal Taxes $250.00\n"
        "Total Deductions $50.00\nNet Pay $1,400.00\n"
        "\f\n"
        "Softchoice\nAdvice Date: 2026-08-31\nGross Pay $1,800.00\nTotal Taxes $270.00\n"
        "Total Deductions $60.00\nNet Pay $1,470.00\n"
    )
    monkeypatch.setattr(extractors, "pdf_extract", lambda _c: (two_page_stubs, []))
    res_pages = (await _upload(client, "stubs_bundle.pdf", b"%PDF-1.7 fake")).json()
    assert res_pages["parser_used"] == "pdf_text" and len(res_pages["rows"]) == 2
    assert [r["paid_on"] for r in res_pages["rows"]] == ["2026-08-15", "2026-08-31"]
    assert [r["amount"] for r in res_pages["rows"]] == ["1400.00", "1470.00"]

    # 4. Tier 3 Vision entries[] and multi-page PDF Vision extraction
    monkeypatch.setattr(extractors, "vision_available", lambda: True)
    monkeypatch.setattr(extractors, "pdf_extract", lambda _c: ("", []))
    monkeypatch.setattr(
        extractors,
        "prepare_images",
        lambda _c, _m: [Image.new("RGB", (60, 60), "white"), Image.new("RGB", (60, 60), "white")],
    )
    page_payloads = iter(
        [
            {
                "document_type": "paystub",
                "source_name": "Softchoice",
                "entries": [
                    {
                        "paid_on": "2026-09-15",
                        "numeric_amount": "1405.71",
                        "gross": "1718.09",
                        "tax": "312.38",
                    }
                ],
            },
            {
                "document_type": "deposit",
                "source_name": "CRA / Government",
                "paid_on": "2026-10-05",
                "numeric_amount": "245.50",
            },
        ]
    )

    async def _multi_page_vision(_images: list, **_kw: object) -> dict:
        return next(page_payloads)

    monkeypatch.setattr(extractors, "vision_extract", _multi_page_vision)
    res_vis = (await _upload(client, "scanned_bundle.pdf", b"%PDF-1.7 fake")).json()
    assert res_vis["parser_used"] == "vision" and len(res_vis["rows"]) == 2
    assert (res_vis["rows"][0]["source_name"], res_vis["rows"][0]["amount"]) == (
        "Softchoice",
        "1405.71",
    )
    assert (
        res_vis["rows"][1]["document_type"],
        res_vis["rows"][1]["source_name"],
        res_vis["rows"][1]["amount"],
    ) == ("deposit", "CRA / Government", "245.50")


@pytest.mark.asyncio
async def test_source_aliases_persist_on_commit_and_resolve_on_reparse(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (120, 80), "white").save(buf, format="PNG")
    png_bytes = buf.getvalue()

    monkeypatch.setattr(extractors, "vision_available", lambda: True)

    async def _corp_cheque(_images: list, **_kw: object) -> dict:
        return {
            "document_type": "cheque",
            "source_name": "5024721 ONTARIO LIMITED",
            "paid_on": "2026-11-22",
            "numeric_amount": "611.86",
            "written_amount": "Six hundred eleven 86/100",
        }

    monkeypatch.setattr(extractors, "vision_extract", _corp_cheque)

    # First parse sees raw corporate name
    p1 = (await _upload(client, "cheque1.png", png_bytes)).json()
    assert p1["rows"][0]["source_name"] == "5024721 ONTARIO LIMITED"
    assert p1["rows"][0]["raw_source_name"] == "5024721 ONTARIO LIMITED"

    # User renames source_name -> "Kung Fu Tea" during import review and commits
    imp = await client.post(
        "/api/paycheques/import",
        json={
            "parse_log_id": p1["parse_log_id"],
            "auto_create_sources": True,
            "rows": [
                {
                    **p1["rows"][0],
                    "source_name": "Kung Fu Tea",
                }
            ],
        },
    )
    assert imp.status_code == 200 and imp.json()["imported_count"] == 1
    assert imp.json()["created_sources"] == 0

    # Subsequent parse of the same numbered corp automatically resolves to "Kung Fu Tea"
    p2 = (await _upload(client, "cheque2.png", png_bytes)).json()
    assert p2["rows"][0]["source_name"] == "Kung Fu Tea"
    assert p2["rows"][0]["raw_source_name"] == "5024721 ONTARIO LIMITED"

    # Even direct /import with raw alias resolves to existing Kung Fu Tea without creating a source
    imp2 = await client.post(
        "/api/paycheques/import",
        json={
            "auto_create_sources": True,
            "rows": [
                {
                    "source_name": "5024721 ONTARIO LIMITED",
                    "paid_on": "2026-11-29",
                    "amount": "520.00",
                }
            ],
        },
    )
    assert imp2.status_code == 200 and imp2.json()["imported_count"] == 1
    assert imp2.json()["created_sources"] == 0


@pytest.mark.asyncio
async def test_deposit_mode_etransfer_cra_and_vision(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (120, 80), "white").save(buf, format="PNG")
    png_bytes = buf.getvalue()

    # 1. Interac e-Transfer screenshot via OCR text
    monkeypatch.setattr(extractors, "vision_available", lambda: False)
    etransfer_ocr = (
        "Interac e-Transfer\n"
        "Money Received\n"
        "Sent From: Acme Client\n"
        "Date: Nov 20, 2026\n"
        "Amount: $425.00\n"
    )
    monkeypatch.setattr(extractors, "ocr_text", lambda _c, _m, **_kw: (etransfer_ocr, 0.94))
    res_et = (await _upload(client, "etransfer.png", png_bytes)).json()
    [r_et] = res_et["rows"]
    assert r_et["document_type"] == "deposit"
    assert (r_et["source_name"], r_et["paid_on"], r_et["amount"]) == (
        "Acme Client",
        "2026-11-20",
        "425.00",
    )
    assert r_et["gross"] is None and r_et["tax"] is None and r_et["deductions"] is None
    assert r_et["hours"] is None and r_et["warnings"] == []

    # 2. CRA benefit notice via PDF text
    cra_text = (
        "Canada Revenue Agency\n"
        "GST/HST credit notice\n"
        "Issued: 2026-10-05\n"
        "Benefit Amount: $245.50\n"
    )
    monkeypatch.setattr(extractors, "pdf_extract", lambda _c: (cra_text, []))
    res_cra = (await _upload(client, "cra_notice.pdf", b"%PDF-1.7 fake")).json()
    [r_cra] = res_cra["rows"]
    assert res_cra["parser_used"] == "pdf_text" and r_cra["document_type"] == "deposit"
    assert (r_cra["source_name"], r_cra["paid_on"], r_cra["amount"]) == (
        "CRA / Government",
        "2026-10-05",
        "245.50",
    )
    assert r_cra["warnings"] == []

    # 3. Vision AI deposit mode forces net-only even if spurious fields returned
    monkeypatch.setattr(extractors, "vision_available", lambda: True)

    async def _deposit_vision(_images: list, **_kw: object) -> dict:
        return {
            "document_type": "deposit",
            "source_name": "Acme Client",
            "paid_on": "2026-11-21",
            "numeric_amount": "310.00",
            "gross": "999.00",
            "tax": "100.00",
            "hours": 10,
        }

    monkeypatch.setattr(extractors, "vision_extract", _deposit_vision)
    res_vis = (await _upload(client, "bank_deposit.png", png_bytes)).json()
    [r_vis] = res_vis["rows"]
    assert r_vis["document_type"] == "deposit" and r_vis["amount"] == "310.00"
    assert r_vis["gross"] is None and r_vis["tax"] is None and r_vis["hours"] is None


@pytest.mark.asyncio
async def test_excel_multisheet_banners_totals_multicolumn_and_serial_dates(
    client: AsyncClient,
) -> None:
    # 1. Multi-sheet .xlsx: banner row, multi-column tax/deductions, Total footer,
    #    zero gross cell, worksheet-tab fallback, and Excel serial dates
    wb = openpyxl.Workbook()
    ws1 = wb.active
    ws1.title = "Overview"
    ws1.append(["2026 Pay Tracker"])
    ws1.append([])
    ws1.append(
        [
            "Pay Date *",
            "Employer",
            "Gross (CAD)",
            "Federal Tax",
            "Provincial Tax",
            "CPP",
            "EI",
            "Net Pay ($)",
            "Memo",
        ]
    )
    ws1.append(["2026-11-01", "Softchoice", 2000, 220, 130, 100, 50, 1500, "Regular"])
    ws1.append(["2026-11-15", "Softchoice", 0, 0, 0, 0, 0, 500, "Bonus"])
    ws1.append(["Total", "", 2000, 220, 130, 100, 50, 2000, ""])

    ws2 = wb.create_sheet("Kung Fu Tea")
    ws2.append(["Date", "Take-Home", "Notes"])
    ws2.append([46340, 611.86, "Shift"])  # 46340 -> 2026-11-14 in Excel 1900 date system

    ws3 = wb.create_sheet("Notes")
    ws3.append(["Just personal notes"])

    buf = io.BytesIO()
    wb.save(buf)
    xlsx_res = (await _upload(client, "pay_tracker.xlsx", buf.getvalue())).json()
    assert xlsx_res["parser_used"] == "tabular"
    assert len(xlsx_res["rows"]) == 3
    r1, r2, r3 = xlsx_res["rows"]
    assert (
        r1["source_name"],
        r1["paid_on"],
        r1["gross"],
        r1["tax"],
        r1["deductions"],
        r1["amount"],
    ) == (
        "Softchoice",
        "2026-11-01",
        "2000.00",
        "350.00",
        "150.00",
        "1500.00",
    )
    assert r1["warnings"] == []
    assert (r2["source_name"], r2["amount"], r2["gross"], r2["warnings"]) == (
        "Softchoice",
        "500.00",
        None,
        [],
    )
    assert (r3["source_name"], r3["paid_on"], r3["amount"], r3["note"], r3["warnings"]) == (
        "Kung Fu Tea",
        "2026-11-14",
        "611.86",
        "Shift",
        [],
    )

    # 2. Headerless Excel sheet + mid-sheet section banner
    wb2 = openpyxl.Workbook()
    ws_hl = wb2.active
    ws_hl.title = "Data"
    ws_hl.append(["2026-10-01", 450.25, "Kung Fu Tea", "First shift"])
    ws_hl.append(["2026-10-15", 480.00, "Kung Fu Tea", "Second shift"])
    buf2 = io.BytesIO()
    wb2.save(buf2)
    hl_res = (await _upload(client, "headerless.xlsx", buf2.getvalue())).json()
    assert len(hl_res["rows"]) == 2
    assert (
        hl_res["rows"][0]["paid_on"],
        hl_res["rows"][0]["amount"],
        hl_res["rows"][0]["source_name"],
    ) == (
        "2026-10-01",
        "450.25",
        "Kung Fu Tea",
    )

    # 3. Semicolon CSV, UTF-16 BOM Excel CSV, and HTML-table .xls bank export
    semi_csv = "Pay Date;Net Pay;Source\n2026-11-05;700.00;Kung Fu Tea\n"
    semi_res = (await _upload(client, "semi.csv", semi_csv.encode("utf-8"))).json()
    assert semi_res["rows"][0]["amount"] == "700.00"

    utf16_tsv = "Date\tAmount\tEmployer\n2026-11-06\t800.00\tSoftchoice\n".encode("utf-16")
    u16_res = (await _upload(client, "excel_unicode.csv", utf16_tsv)).json()
    assert (u16_res["rows"][0]["paid_on"], u16_res["rows"][0]["source_name"]) == (
        "2026-11-06",
        "Softchoice",
    )

    html_xls = (
        "<html><body><table>"
        "<tr><th>Posting Date</th><th>Credit</th><th>Description</th></tr>"
        "<tr><td>2026-11-07</td><td>$925.50</td><td>Direct deposit</td></tr>"
        "</table></body></html>"
    )
    xls_res = (await _upload(client, "bank_export.xls", html_xls.encode("utf-8"))).json()
    assert (
        xls_res["rows"][0]["paid_on"],
        xls_res["rows"][0]["amount"],
        xls_res["rows"][0]["note"],
    ) == (
        "2026-11-07",
        "925.50",
        "Direct deposit",
    )


@pytest.mark.asyncio
async def test_user_salary_split_month_date_forward_fill_and_sections(
    client: AsyncClient,
) -> None:
    from src.paycheques.utils import parse_cents

    salary_csv = "\n".join(
        [
            "Kung Fu Tea Salary 2025,,,",
            "Month,Date,Salary,Monthly Total",
            "4,11,545.25,995.44",
            ",25,450.19,",
            "5,09,425.39,1061.54",
            ",23,636.15,",
            "6,06,570.04,1394.1",
            ",20,712.06,",
            ",30,112,",
            "7,04,508.05,1206.79",
            ",18,698.74,",
            "8,01,691.63,1773.8600000000001",
            ",15,586.57,",
            ",29,495.66,",
            "9,12,724.34,1112.54",
            ",26,388.2,",
            "10,10,458.47,957.01",
            ",24,498.54,",
            "11,07,504.17,1095.74",
            ",21,591.57,",
            "12,05,578.88,1212.73",
            ",19,633.85,",
            "Total,,,10809.75",
            "Kung Fu Tea Salary 2026,,,",
            "Month,Date,Salary,Monthly Total",
            "1,02,464.75,1402.73",
            ",16,608.55,",
            ",30,329.43,",
            "2,13,481.67,1167.97",
            ",15,230,",
            ",27,456.3,",
            "3,13,692.76,1153.29",
            ",27,460.53,",
            "4,10,443.62,781.5",
            ",24,337.88,",
            "5,13,667.75,1124.05",
            ",24,456.3,",
            "6,07,621.23,1077.53",
            ",19,456.3,",
            "7,02,604.32,1329.1",
            ",17,724.78,",
            "8,4,700.04,1410.98",
            ",17,710.94,",
            "9,2,604.32,1009.8700000000001",
            ",14,405.55,",
            "10,15,554.36,1174.18",
            ",28,619.82,",
            "11,9,413.46,413.46",
            ",,,",
            ",,,0",
            ",,,",
            "Total,,,12044.66",
            "Softchoice Winter 2025 Co-op Term,,,",
            "Month,Date,Salary,Monthly Total",
            "9,15,1402.99,2936.6800000000003",
            ",29,1533.69,",
            "10,15,1533.69,3067.38",
            ",31,1533.69,",
            "11,14,1533.69,3067.38",
            ",28,1533.69,",
            "12,15,1533.69,2188.1800000000003",
            ",31,654.49,",
            "Total,,,11259.620000000003",
            "Softchoice Winter 2025 Co-op Term,,,",
            "Month,Date,Salary,Monthly Total",
            "5,15,1427.43,2963.8500000000004",
            ",29,1536.42,",
            "6,13,1536.42,3072.84",
            ",30,1536.42,",
            "7,15,1536.42,3072.84",
            ",30,1536.42,",
            "8,15,1536.42,2942.13",
            ",31,1405.71,",
            "Total,,,12051.66",
            "Tax Turn 2025,,,,",
            "Month,Date,Type,Amount,Sum",
            "4,8,Income Tax,1262.09,1262.09",
            "5,8,Ontario trillium benefit,920.71,920.71",
            "6,5,GST/HST credit,944.75,1790.75",
            ",10,Ontario trillium benefit,846,",
            "Total,,,,3973.55",
        ]
    )

    res = (await _upload(client, "salary.csv", salary_csv.encode("utf-8"))).json()
    assert res["parser_used"] == "tabular"
    rows = res["rows"]
    assert len(rows) == 63
    assert all(r["warnings"] == [] for r in rows)
    assert len(res["sheets"]) == 5
    assert res["sheets"][0]["inferred_mapping"]["month"] == 0
    assert res["sheets"][0]["inferred_mapping"]["day"] == 1
    assert res["sheets"][0]["inferred_mapping"]["amount"] == 2
    assert res["sheets"][4]["default_source"] == "CRA / Government"

    def sum_cents(source: str, year: str) -> int:
        return sum(
            parse_cents(r["amount"], "Amount")
            for r in rows
            if r["source_name"] == source and r["paid_on"].startswith(year)
        )

    assert sum_cents("Kung Fu Tea", "2025") == 1080975
    assert sum_cents("Kung Fu Tea", "2026") == 1204466
    assert sum_cents("Softchoice", "2025") == 1125962
    assert sum_cents("Softchoice", "2026") == 1205166
    assert sum_cents("CRA / Government", "2025") == 397355


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
