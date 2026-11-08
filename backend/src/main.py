from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.database import init_db
from src.exceptions import register_exception_handlers
from src.models import OkResponse
from src.paycheques.router import export_router as paycheques_export_router
from src.paycheques.router import router as paycheques_router
from src.settings.router import router as settings_router
from src.sources.router import router as sources_router

SHOW_DOCS_IN = {"local", "staging"}


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    await init_db()
    yield


app_kwargs: dict[str, Any] = {
    "title": "Payday API",
    "version": "0.2.0",
    "lifespan": lifespan,
}
if settings.ENVIRONMENT not in SHOW_DOCS_IN:
    app_kwargs["openapi_url"] = None

# ponytail: no auth for local single-user Docker; put behind Caddy basic_auth before WAN exposure
app = FastAPI(**app_kwargs)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def add_no_store_header(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    response = await call_next(request)
    response.headers.setdefault("Cache-Control", "no-store")
    return response


register_exception_handlers(app)

app.include_router(sources_router)
app.include_router(paycheques_router)
app.include_router(paycheques_export_router)
app.include_router(settings_router)


@app.get(
    "/api/health",
    tags=["health"],
    status_code=status.HTTP_200_OK,
    summary="Health check",
    description="Returns service health status.",
)
async def health_check() -> OkResponse:
    return OkResponse()
