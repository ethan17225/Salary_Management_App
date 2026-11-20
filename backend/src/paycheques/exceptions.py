from fastapi import status

from src.exceptions import AppError, ConflictError, NotFoundError
from src.paycheques.constants import MAX_UPLOAD_BYTES, ErrorCode


class UnsupportedFileType(AppError):
    status_code = status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
    detail = "Unsupported file. Upload a CSV, TSV, XLSX, PDF, PNG, JPG, or WEBP file."


class FileTooLarge(AppError):
    status_code = status.HTTP_413_CONTENT_TOO_LARGE
    detail = f"Files must be {MAX_UPLOAD_BYTES // (1024 * 1024)} MB or smaller."


class PaychequeNotFound(NotFoundError):
    detail = ErrorCode.PAYCHEQUE_NOT_FOUND


class InvalidSourceReference(ConflictError):
    detail = ErrorCode.SOURCE_DOES_NOT_EXIST

