from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

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


async def get_full_state(db: AsyncSession) -> StateResponse:
    # ponytail: full-state payload; paginate /api/paycheques if >10k rows
    sources = await sources_service.list_sources(db)
    paycheques = await paycheques_service.list_paycheques(db)
    settings_map = await get_settings_dict(db)
    return StateResponse(
        sources=[SourceResponse.model_validate(s) for s in sources],
        paycheques=[PaychequeResponse.model_validate(p) for p in paycheques],
        settings=settings_map,
    )

