from enum import StrEnum

HEX_COLOR_PATTERN = r"^#[0-9a-fA-F]{6}$"
DEFAULT_SOURCE_COLOR = "#0d7480"
MAX_SOURCE_NAME_LENGTH = 60


class SourceKind(StrEnum):
    JOB = "job"
    GOVERNMENT = "government"
    OTHER = "other"


class ErrorCode(StrEnum):
    SOURCE_NOT_FOUND = "Not found"
    DUPLICATE_SOURCE_NAME = "A source with that name already exists."
    SOURCE_HAS_PAYCHEQUES = "This source has paycheques. Archive it instead."
    NAME_REQUIRED = "Name is required"
    NAME_TOO_LONG = f"Name must be {MAX_SOURCE_NAME_LENGTH} characters or fewer"
    INVALID_KIND = "Kind must be job, government or other"
    INVALID_COLOR = "Colour must look like #0d7480"

