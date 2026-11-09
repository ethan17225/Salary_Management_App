from datetime import date, timedelta
from statistics import median
from typing import Any


def parse_expected_cadence_days(val: object) -> int | None:
    if val is None or val == "":
        return None
    if isinstance(val, bool):
        raise ValueError("expected_cadence_days must be an integer between 1 and 366")
    try:
        days = int(val)  # type: ignore[call-overload]
    except (ValueError, TypeError) as exc:
        raise ValueError("expected_cadence_days must be an integer between 1 and 366") from exc
    if not (1 <= days <= 366):
        raise ValueError("expected_cadence_days must be between 1 and 366")
    return days


def parse_active_until(val: object) -> str | None:
    if val is None:
        return None
    cleaned = str(val).strip()
    if cleaned == "":
        return None
    try:
        parsed = date.fromisoformat(cleaned)
    except ValueError as exc:
        raise ValueError("active_until must be a valid YYYY-MM-DD date") from exc
    return parsed.isoformat()


def compute_schedule_forecast(
    sources: list[dict[str, Any]],
    paycheques: list[dict[str, Any]],
    goal_cents: int | None,
    reference_date: date | None = None,
) -> dict[str, Any]:
    """
    Computes deterministic schedule-aware year-end income projections,
    upcoming payday timeline, and goal crossover date.
    """
    today = reference_date or date.today()
    year = today.year
    year_prefix = f"{year}-"
    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)

    days_in_year = (year_end - year_start).days + 1
    days_elapsed = max(1, (today - year_start).days + 1)

    ytd_cents = sum(
        int(p["amount_cents"])
        for p in paycheques
        if str(p["paid_on"]).startswith(year_prefix) and str(p["paid_on"]) <= today.isoformat()
    )

    linear_projected_year_end_cents = (ytd_cents * days_in_year) // days_elapsed

    stream_forecasts: list[dict[str, Any]] = []
    chronological_upcoming: list[dict[str, Any]] = []
    schedule_remaining_cents = 0
    total_remaining_cheques = 0

    for src in sources:
        if bool(src.get("archived")):
            continue

        src_id = int(src["id"])
        src_cheques = sorted(
            [p for p in paycheques if int(p["source_id"]) == src_id],
            key=lambda x: str(x["paid_on"]),
        )

        override_cadence = src.get("expected_cadence_days")
        cadence_days: int | None = int(override_cadence) if override_cadence is not None else None

        if cadence_days is None and len(src_cheques) >= 2:
            recent_for_gap = src_cheques[-6:]
            dates = [date.fromisoformat(str(p["paid_on"])) for p in recent_for_gap]
            gaps = [(dates[i] - dates[i - 1]).days for i in range(1, len(dates))]
            detected = round(median(gaps))
            last_paid_date = dates[-1]
            max_stale_days = max(int(detected * 2.5), 45)
            if 7 <= detected <= 95 and (today - last_paid_date).days <= max_stale_days:
                cadence_days = detected

        if cadence_days is None or cadence_days <= 0:
            continue

        # Determine cutoff date (min of Dec 31 and active_until)
        cutoff_date = year_end
        active_until_str = src.get("active_until")
        if active_until_str:
            cutoff_date = min(year_end, date.fromisoformat(str(active_until_str)))

        if cutoff_date <= today:
            continue

        # Estimate expected per-cheque cents and hours from up to last 3 deposits
        recent_sample = src_cheques[-3:]
        if recent_sample:
            m_len = len(recent_sample)
            avg_cheque_cents = (
                sum(int(p["amount_cents"]) for p in recent_sample) + (m_len // 2)
            ) // m_len
            timed = [p for p in recent_sample if p.get("hours") and float(p["hours"]) > 0]
            avg_hours = (
                round(sum(float(p["hours"]) for p in timed) / len(timed), 2)
                if timed
                else None
            )
            anchor_date = date.fromisoformat(str(src_cheques[-1]["paid_on"]))
        else:
            # Brand new source with expected_cadence_days and target_hourly_cents
            target_hr = int(src["target_hourly_cents"]) if src.get("target_hourly_cents") else 0
            avg_hours = 80.0 if cadence_days == 14 else (40.0 if cadence_days == 7 else None)
            avg_cheque_cents = int(round(target_hr * (avg_hours or 0)))
            anchor_date = today

        if avg_cheque_cents <= 0:
            continue

        # Step forward from anchor_date through cutoff_date
        cursor = anchor_date + timedelta(days=cadence_days)
        while cursor <= today:
            cursor += timedelta(days=cadence_days)

        upcoming_dates: list[str] = []
        while cursor <= cutoff_date:
            iso_d = cursor.isoformat()
            upcoming_dates.append(iso_d)
            chronological_upcoming.append({
                "date": iso_d,
                "source_id": src_id,
                "source_name": src["name"],
                "color": src["color"],
                "estimated_cents": avg_cheque_cents,
            })
            cursor += timedelta(days=cadence_days)

        rem_count = len(upcoming_dates)
        stream_rem_cents = rem_count * avg_cheque_cents
        schedule_remaining_cents += stream_rem_cents
        total_remaining_cheques += rem_count

        effective_hourly_cents = (
            int(round(avg_cheque_cents / avg_hours))
            if avg_hours and avg_hours > 0
            else (int(src["target_hourly_cents"]) if src.get("target_hourly_cents") else None)
        )

        stream_forecasts.append({
            "source_id": src_id,
            "source_name": src["name"],
            "kind": src["kind"],
            "color": src["color"],
            "cadence_days": cadence_days,
            "is_manual_cadence": override_cadence is not None,
            "active_until": active_until_str,
            "remaining_paycheques": rem_count,
            "expected_per_cheque_cents": avg_cheque_cents,
            "average_hours_per_cheque": avg_hours,
            "effective_net_hourly_cents": effective_hourly_cents,
            "projected_remaining_cents": stream_rem_cents,
            "next_pay_date": upcoming_dates[0] if upcoming_dates else None,
            "upcoming_dates": upcoming_dates,
        })

    chronological_upcoming.sort(key=lambda x: (str(x["date"]), int(x["source_id"])))
    schedule_year_end_cents = ytd_cents + schedule_remaining_cents

    # Compute exact goal crossover date
    goal_achieved = False
    predicted_goal_date: str | None = None
    goal_shortfall_cents = 0
    extra_per_cheque_needed_cents = 0

    if goal_cents and goal_cents > 0:
        if ytd_cents >= goal_cents:
            goal_achieved = True
            predicted_goal_date = today.isoformat()
        else:
            running = ytd_cents
            for item in chronological_upcoming:
                running += int(item["estimated_cents"])
                if running >= goal_cents:
                    goal_achieved = True
                    predicted_goal_date = str(item["date"])
                    break
            if not goal_achieved:
                goal_shortfall_cents = max(0, goal_cents - schedule_year_end_cents)
                if total_remaining_cheques > 0:
                    extra_per_cheque_needed_cents = (
                        goal_shortfall_cents + total_remaining_cheques - 1
                    ) // total_remaining_cheques

    return {
        "year": year,
        "reference_date": today.isoformat(),
        "ytd_cents": ytd_cents,
        "linear_projected_year_end_cents": linear_projected_year_end_cents,
        "schedule_projected_remaining_cents": schedule_remaining_cents,
        "schedule_projected_year_end_cents": schedule_year_end_cents,
        "schedule_vs_linear_delta_cents": schedule_year_end_cents - linear_projected_year_end_cents,
        "total_remaining_paycheques": total_remaining_cheques,
        "goal_cents": goal_cents,
        "goal_achieved_or_on_track": goal_achieved,
        "predicted_goal_date": predicted_goal_date,
        "goal_shortfall_cents": goal_shortfall_cents,
        "extra_per_cheque_needed_cents": extra_per_cheque_needed_cents,
        "streams": stream_forecasts,
        "upcoming_timeline": chronological_upcoming,
    }

