import re
import time
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from redis.asyncio import Redis
from sqlalchemy import text

from app.api.router import api_router
from app.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.core.rate_limit import RateLimitMiddleware
from app.core.storage import MEDIA_ROOT, blob_storage
from app.core.upload_limits import UploadLimitsMiddleware
from app.database import SessionFactory

logger = configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.logger = logger
    app.state.redis = Redis.from_url(settings.redis_url, decode_responses=True)
    yield
    await app.state.redis.aclose()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Secure learning platform API with RAG tutor and quiz generation.",
    lifespan=lifespan,
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url="/redoc" if settings.app_env != "production" else None,
)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(UploadLimitsMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)
register_exception_handlers(app)
app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/media/{path:path}", include_in_schema=False)
async def public_media(path: str) -> Response:
    # Only avatar/post images are public. Course/message paths, including old
    # links, must never go through a StaticFiles mount or public Blob redirect.
    identity = r"[0-9a-f-]{36}"
    if re.fullmatch(
        rf"(?:users/{identity}/avatar|social/{identity})/{identity}\.(?:png|jpe?g|webp|gif)", path,
    ) is None:
        return Response(status_code=404, headers={"Cache-Control": "private, no-store"})
    if settings.storage_provider == "blob":
        try:
            return RedirectResponse(await blob_storage.public_url(path))
        except FileNotFoundError:
            return Response(status_code=404)
    target = (MEDIA_ROOT / path).resolve()
    if MEDIA_ROOT.resolve() not in target.parents or not target.is_file():
        return Response(status_code=404)
    return FileResponse(target)

FRONTEND_ROOT = Path(__file__).resolve().parents[1] / "frontend"
if settings.app_env == "development" and not FRONTEND_ROOT.is_dir():
    local_build = Path(__file__).resolve().parents[2] / "dist"
    if (local_build / "index.html").is_file():
        FRONTEND_ROOT = local_build
if FRONTEND_ROOT.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_ROOT / "assets"), name="frontend-assets")


@app.middleware("http")
async def request_context(request: Request, call_next: object) -> Response:
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    started = time.perf_counter()
    response = await call_next(request)  # type: ignore[operator]
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Frame-Options"] = "DENY"
    logger.info(
        "request",
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        latency_ms=round((time.perf_counter() - started) * 1000),
    )
    return response  # type: ignore[no-any-return]


@app.get("/health/live", tags=["Health"])
async def live() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready", tags=["Health"])
async def ready(request: Request) -> JSONResponse:
    try:
        async with SessionFactory() as session:
            await session.execute(text("SELECT 1"))
        await request.app.state.redis.ping()
        return JSONResponse({"status": "ready"})
    except Exception:
        return JSONResponse({"status": "not_ready"}, status_code=503)


if FRONTEND_ROOT.is_dir():

    @app.get("/{path:path}", include_in_schema=False)
    async def frontend(path: str) -> FileResponse:
        candidate = (FRONTEND_ROOT / path).resolve()
        if FRONTEND_ROOT.resolve() in candidate.parents and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_ROOT / "index.html")
