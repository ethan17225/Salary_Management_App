from typing import Annotated

from fastapi import Depends, Path

from src.database import DBDep
from src.paycheques import service
from src.paycheques.exceptions import PaychequeNotFound
from src.paycheques.models import Paycheque


async def valid_paycheque_id(
    paycheque_id: Annotated[int, Path(ge=1, description="The paycheque ID")],
    db: DBDep,
) -> Paycheque:
    paycheque = await service.get_by_id(db, paycheque_id)
    if not paycheque:
        raise PaychequeNotFound()
    return paycheque


ValidPaychequeDep = Annotated[Paycheque, Depends(valid_paycheque_id)]

