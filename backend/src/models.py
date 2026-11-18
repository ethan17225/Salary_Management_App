from pydantic import BaseModel, ConfigDict
from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

POSTGRES_INDEXES_NAMING_CONVENTION = {
    "ix": "%(column_0_label)s_idx",
    "uq": "%(table_name)s_%(column_0_name)s_key",
    "ck": "%(table_name)s_%(constraint_name)s_check",
    "fk": "%(table_name)s_%(column_0_name)s_fkey",
    "pk": "%(table_name)s_pkey",
}

metadata = MetaData(naming_convention=POSTGRES_INDEXES_NAMING_CONVENTION)


class Base(DeclarativeBase):
    metadata = metadata


class CustomModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class OkResponse(CustomModel):
    ok: bool = True


class CreatedResponse(CustomModel):
    id: int


class ErrorResponse(CustomModel):
    error: str

