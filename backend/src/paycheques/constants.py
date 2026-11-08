from enum import StrEnum

MAX_NOTE_LENGTH = 200
MAX_HOURS = 1000
MAX_DOLLARS = 10_000_000


class ErrorCode(StrEnum):
    PAYCHEQUE_NOT_FOUND = "Not found"
    SOURCE_DOES_NOT_EXIST = "That source does not exist."
    PICK_SOURCE = "Pick a source"
    INVALID_DATE = "Date must look like 2026-11-08"
    HOURS_NOT_NUMBER = "Hours must be a number"
    HOURS_OUT_OF_RANGE = "Hours must be between 0 and 1000"
    NOTE_TOO_LONG = f"Note must be {MAX_NOTE_LENGTH} characters or fewer"

