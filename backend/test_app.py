"""Run: python backend/test_app.py — seed matches Salary.pdf totals, money parsing is exact, writes validate."""
import sqlite3

import app

c = app.connect(":memory:")
app.init(c)
app.init(c)  # second start must not seed twice

total = lambda where: c.execute(
    f"SELECT SUM(amount_cents) FROM paycheques p JOIN sources s ON s.id = p.source_id WHERE {where}"
).fetchone()[0]
assert c.execute("SELECT COUNT(*) FROM paycheques").fetchone()[0] == 63
assert total("s.name = 'Kung Fu Tea' AND paid_on LIKE '2025%'") == 1080975   # PDF: 10809.75
assert total("s.name = 'Kung Fu Tea' AND paid_on LIKE '2026%'") == 1204466   # PDF: 12044.66
assert total("s.name = 'Softchoice' AND paid_on LIKE '2025%'") == 1125962    # PDF: 11,259.62
assert total("s.name = 'Softchoice' AND paid_on LIKE '2026%'") == 1205166    # PDF: 12,051.66
assert total("s.kind = 'government'") == 397355                              # PDF: 3,973.55

assert app.cents("12.345", "x") == 1235 and app.cents("$1,533.69", "x") == 153369 and app.cents(0.1, "x") == 10
for bad in ("0", "-1", "abc", "nan", "inf", ""):
    try:
        app.cents(bad, "x")
        raise AssertionError(bad)
    except ValueError:
        pass

status, out = app.write(c, "POST", "paycheques", None, {"source_id": 1, "paid_on": "2026-11-20", "amount": "500.10", "hours": ""})
assert status == 201 and c.execute("SELECT amount_cents FROM paycheques WHERE id = ?", (out["id"],)).fetchone()[0] == 50010
for bad in ({"source_id": 1, "paid_on": "2026-13-01", "amount": 1}, {"source_id": 1, "paid_on": "2026-11-01", "amount": -5},
            {"source_id": 1, "paid_on": "2026-11-01", "amount": 5, "hours": "nan"}, {"source_id": "x", "paid_on": "2026-11-01", "amount": 5}):
    try:
        app.write(c, "POST", "paycheques", None, bad)
        raise AssertionError(bad)
    except ValueError:
        pass
try:  # a source with paycheques cannot be deleted
    app.write(c, "DELETE", "sources", 1, {})
    raise AssertionError("deleted source with paycheques")
except sqlite3.IntegrityError:
    pass
print("ok")

