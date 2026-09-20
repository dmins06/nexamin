import hashlib
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Redis-backed fixed-window limits for abuse-sensitive endpoints."""

    limits: dict[str, tuple[int, int]] = {
        "/api/v1/auth/login": (10, 60),
        "/api/v1/auth/register": (5, 60),
        "/api/v1/auth/refresh": (30, 60),
        "/api/v1/ai/chat": (20, 60),
        "/api/v1/quizzes/generate": (10, 60),
        "/api/v1/documents/upload": (20, 60),
    }

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if not settings.rate_limit_enabled and settings.app_env != "production":
            return await call_next(request)
        rule = self.limits.get(request.url.path)
        if rule is None:
            return await call_next(request)
        limit, window = rule
        identity = request.client.host if request.client else "unknown"
        digest = hashlib.sha256(identity.encode()).hexdigest()[:20]
        key = f"rate:{request.url.path}:{digest}"
        try:
            async with request.app.state.redis.pipeline(transaction=True) as pipe:
                pipe.incr(key)
                pipe.expire(key, window, nx=True)
                count, _ = await pipe.execute()
        except Exception:
            request.app.state.logger.exception("rate_limit_backend_unavailable")
            if settings.app_env != "production":
                return await call_next(request)
            return JSONResponse(
                {"error": {"code": "SERVICE_UNAVAILABLE", "message": "Please try again shortly"}},
                status_code=503,
            )
        if int(count) > limit:
            return JSONResponse(
                {"error": {"code": "RATE_LIMITED", "message": "Too many requests"}},
                status_code=429,
                headers={"Retry-After": str(window)},
            )
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, limit - int(count)))
        return response
