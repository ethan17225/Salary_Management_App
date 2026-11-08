from src.exceptions import ConflictError, NotFoundError
from src.sources.constants import ErrorCode


class SourceNotFound(NotFoundError):
    detail = ErrorCode.SOURCE_NOT_FOUND


class DuplicateSourceName(ConflictError):
    detail = ErrorCode.DUPLICATE_SOURCE_NAME


class SourceHasPaycheques(ConflictError):
    detail = ErrorCode.SOURCE_HAS_PAYCHEQUES

