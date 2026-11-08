from src.exceptions import ConflictError, NotFoundError
from src.paycheques.constants import ErrorCode


class PaychequeNotFound(NotFoundError):
    detail = ErrorCode.PAYCHEQUE_NOT_FOUND


class InvalidSourceReference(ConflictError):
    detail = ErrorCode.SOURCE_DOES_NOT_EXIST

