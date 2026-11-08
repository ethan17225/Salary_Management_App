from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    status_code: int = status.HTTP_400_BAD_REQUEST
    detail: str = "Bad request"

    def __init__(self, detail: str | None = None) -> None:
        if detail is not None:
            self.detail = detail
        super().__init__(self.detail)


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "Not found"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    detail = "That value is not allowed."


class BadRequestError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    detail = "Invalid request"


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.detail},
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors = exc.errors()
        if errors:
            first = errors[0]
            msg = str(first.get("msg", "Invalid input"))
            if msg.startswith("Value error, "):
                msg = msg.removeprefix("Value error, ")
        else:
            msg = "Invalid input"
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": msg},
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
        if exc.status_code == status.HTTP_404_NOT_FOUND:
            detail = "Not found"
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": detail},
        )
