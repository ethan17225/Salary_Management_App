"""Async integration tests for Payday FastAPI backend."""

import sys
from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parent))

from datetime import date

from src.allocations import allocate_cents_largest_remainder
from src.database import ensure_forecast_schema, ensure_schema_migrations, get_db, seed_database
from src.forecast import compute_schedule_forecast
from src.main import app
from src.models import Base
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

    # Create and delete a fresh source
    new_src = await client.post(
        "/api/sources",
        json={"name": "Freelance", "kind": "other", "color": "#123456"},
    )
    assert new_src.status_code == 201
    new_id = new_src.json()["id"]

    del_new = await client.delete(f"/api/sources/{new_id}")
    assert del_new.status_code == 200

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
        "CREATE TABLE sources (id INTEGER PRIMARY KEY, name TEXT, kind TEXT, color TEXT, archived INTEGER)"
    )
    conn.execute(
        "CREATE TABLE paycheques (id INTEGER PRIMARY KEY, source_id INTEGER, paid_on TEXT, amount_cents INTEGER, hours REAL, note TEXT)"
    )
    ensure_schema_migrations(conn)
    ensure_schema_migrations(conn)

    src_cols = {r[1] for r in conn.execute("PRAGMA table_info(sources)").fetchall()}
    pay_cols = {r[1] for r in conn.execute("PRAGMA table_info(paycheques)").fetchall()}
    assert {
        "is_tax_withheld",
        "tax_reserve_bps",
        "expected_cadence_days",
        "active_until",
        "target_hourly_cents",
    } <= src_cols
    assert {"gross_cents", "tax_cents", "deductions_cents"} <= pay_cols


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
            "weight_bps": 5000,
            "color": "#8b5cf6",
            "active": 0,
        },
    )
    assert r3.status_code in (200, 201)
    id3 = r3.json()["id"]

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


def test_schedule_forecast_biweekly_cadence_and_goal_crossover() -> None:
    sources = [
        {
            "id": 1,
            "name": "Softchoice Co-op",
            "kind": "job",
            "color": "#c2410c",
            "archived": 0,
            "expected_cadence_days": None,
            "active_until": None,
            "target_hourly_cents": None,
        }
    ]
    paycheques = [
        {"id": 1, "source_id": 1, "paid_on": "2026-09-04", "amount_cents": 150000, "hours": 80.0},
        {"id": 2, "source_id": 1, "paid_on": "2026-09-18", "amount_cents": 150000, "hours": 80.0},
        {"id": 3, "source_id": 1, "paid_on": "2026-10-02", "amount_cents": 150000, "hours": 80.0},
    ]
    report = compute_schedule_forecast(
        sources, paycheques, goal_cents=900000, reference_date=date(2026, 10, 5)
    )
    assert len(report["streams"]) == 1
    stream = report["streams"][0]
    assert stream["cadence_days"] == 14
    assert stream["remaining_paycheques"] == 6
    assert stream["upcoming_dates"] == [
        "2026-10-16",
        "2026-10-30",
        "2026-11-13",
        "2026-11-27",
        "2026-12-11",
        "2026-12-25",
    ]
    assert report["schedule_projected_remaining_cents"] == 900000
    assert report["schedule_projected_year_end_cents"] == 1350000
    assert report["predicted_goal_date"] == "2026-11-13"


def test_schedule_forecast_respects_active_until_contract_end_date() -> None:
    sources = [
        {
            "id": 1,
            "name": "Softchoice Co-op",
            "kind": "job",
            "color": "#c2410c",
            "archived": 0,
            "expected_cadence_days": None,
            "active_until": "2026-10-31",
            "target_hourly_cents": None,
        }
    ]
    paycheques = [
        {"id": 1, "source_id": 1, "paid_on": "2026-09-04", "amount_cents": 150000, "hours": 80.0},
        {"id": 2, "source_id": 1, "paid_on": "2026-09-18", "amount_cents": 150000, "hours": 80.0},
        {"id": 3, "source_id": 1, "paid_on": "2026-10-02", "amount_cents": 150000, "hours": 80.0},
    ]
    report = compute_schedule_forecast(
        sources, paycheques, goal_cents=900000, reference_date=date(2026, 10, 5)
    )
    stream = report["streams"][0]
    assert stream["remaining_paycheques"] == 2
    assert stream["upcoming_dates"] == ["2026-10-16", "2026-10-30"]


def test_archived_and_stale_sources_excluded_from_forecast() -> None:
    sources = [
        {
            "id": 1,
            "name": "Archived Job",
            "kind": "job",
            "color": "#0d7480",
            "archived": 1,
            "expected_cadence_days": None,
            "active_until": None,
            "target_hourly_cents": None,
        },
        {
            "id": 2,
            "name": "Stale Summer Job",
            "kind": "job",
            "color": "#2563eb",
            "archived": 0,
            "expected_cadence_days": None,
            "active_until": None,
            "target_hourly_cents": None,
        },
    ]
    paycheques = [
        {"id": 1, "source_id": 1, "paid_on": "2026-09-18", "amount_cents": 100000, "hours": None},
        {"id": 2, "source_id": 1, "paid_on": "2026-10-02", "amount_cents": 100000, "hours": None},
        {"id": 3, "source_id": 2, "paid_on": "2026-07-01", "amount_cents": 100000, "hours": None},
        {"id": 4, "source_id": 2, "paid_on": "2026-07-15", "amount_cents": 100000, "hours": None},
    ]
    report = compute_schedule_forecast(
        sources, paycheques, goal_cents=500000, reference_date=date(2026, 10, 5)
    )
    assert report["total_remaining_paycheques"] == 0
    assert report["streams"] == []


@pytest.mark.asyncio
async def test_forecast_api_endpoint_and_source_schedule_fields(client: AsyncClient) -> None:
    upd = await client.put(
        "/api/sources/1",
        json={
            "name": "Kung Fu Tea",
            "kind": "job",
            "color": "#0d7480",
            "expected_cadence_days": 14,
            "active_until": "2026-12-15",
            "target_hourly": "28.50",
        },
    )
    assert upd.status_code == 200

    fc_resp = await client.get("/api/forecast?date=2026-10-05")
    assert fc_resp.status_code == 200
    fc = fc_resp.json()
    assert fc["reference_date"] == "2026-10-05"
    kft_stream = next(s for s in fc["streams"] if s["source_id"] == 1)
    assert kft_stream["cadence_days"] == 14
    assert kft_stream["is_manual_cadence"] is True
    assert kft_stream["active_until"] == "2026-12-15"

    state_resp = await client.get("/api/state")
    assert state_resp.status_code == 200
    state = state_resp.json()
    src1 = next(s for s in state["sources"] if s["id"] == 1)
    assert src1["expected_cadence_days"] == 14
    assert src1["active_until"] == "2026-12-15"
    assert src1["target_hourly_cents"] == 2850
    assert "forecast" in state
    assert isinstance(state["forecast"]["streams"], list)


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
