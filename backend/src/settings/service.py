from datetime import date
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.allocations import AllocationRuleResponse, list_allocations
from src.forecast import compute_schedule_forecast
from src.paycheques import service as paycheques_service
from src.paycheques.schemas import PaychequeResponse
from src.settings.models import Setting
from src.settings.schemas import GoalUpdate, StateResponse
from src.sources import service as sources_service
from src.sources.schemas import SourceResponse

GOAL_KEY = "goal_cents"


async def get_settings_dict(db: AsyncSession) -> dict[str, str]:
    stmt = select(Setting)
    result = await db.execute(stmt)
    return {row.key: row.value for row in result.scalars().all()}


async def update_goal(db: AsyncSession, payload: GoalUpdate) -> None:
    if payload.goal is None:
        await db.execute(delete(Setting).where(Setting.key == GOAL_KEY))
    else:
        existing = await db.get(Setting, GOAL_KEY)
        if existing is None:
            db.add(Setting(key=GOAL_KEY, value=str(payload.goal)))
        else:
            existing.value = str(payload.goal)
    await db.commit()


async def get_forecast_payload(
    db: AsyncSession, reference_date: date | None = None
) -> dict[str, Any]:
    sources = await sources_service.list_sources(db)
    paycheques = await paycheques_service.list_paycheques(db)
    settings_map = await get_settings_dict(db)
    goal_cents = int(settings_map[GOAL_KEY]) if GOAL_KEY in settings_map else None
    src_dicts = [SourceResponse.model_validate(s).model_dump() for s in sources]
    pay_dicts = [PaychequeResponse.model_validate(p).model_dump() for p in paycheques]
    return compute_schedule_forecast(src_dicts, pay_dicts, goal_cents, reference_date)


async def get_full_state(db: AsyncSession) -> StateResponse:
    # ponytail: full-state payload; paginate /api/paycheques if >10k rows
    sources = await sources_service.list_sources(db)
    paycheques = await paycheques_service.list_paycheques(db)
    settings_map = await get_settings_dict(db)
    allocations = await list_allocations(db)
    src_resp = [SourceResponse.model_validate(s) for s in sources]
    pay_resp = [PaychequeResponse.model_validate(p) for p in paycheques]
    goal_cents = int(settings_map[GOAL_KEY]) if GOAL_KEY in settings_map else None
    forecast = compute_schedule_forecast(
        [s.model_dump() for s in src_resp],
        [p.model_dump() for p in pay_resp],
        goal_cents,
    )
    return StateResponse(
        sources=src_resp,
        paycheques=pay_resp,
        settings=settings_map,
        allocations=[AllocationRuleResponse.model_validate(a) for a in allocations],
        forecast=forecast,
    )

