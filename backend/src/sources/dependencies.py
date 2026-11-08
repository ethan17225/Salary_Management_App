from typing import Annotated

from fastapi import Depends, Path

from src.database import DBDep
from src.sources import service
from src.sources.exceptions import SourceNotFound
from src.sources.models import Source


async def valid_source_id(
    source_id: Annotated[int, Path(ge=1, description="The income source ID")],
    db: DBDep,
) -> Source:
    source = await service.get_by_id(db, source_id)
    if not source:
        raise SourceNotFound()
    return source


ValidSourceDep = Annotated[Source, Depends(valid_source_id)]

