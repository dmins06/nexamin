"""Fair daily Gemini request limit for a shared free-tier API key."""

import uuid
from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

from redis.exceptions import RedisError
from starlette.requests import Request

from app.config import settings
from app.core.exceptions import AppError

PACIFIC = ZoneInfo("America/Los_Angeles")


def quota_window(now: datetime) -> tuple[str, int]:
    local = now.astimezone(PACIFIC)
    tomorrow = datetime.combine(local.date() + timedelta(days=1), time.min, tzinfo=PACIFIC)
    seconds = int((tomorrow.astimezone(UTC) - now.astimezone(UTC)).total_seconds())
    return local.date().isoformat(), max(seconds + 60, 60)


async def enforce_gemini_quota(request: Request, user_id: uuid.UUID) -> None:
    limit = settings.gemini_daily_user_limit
    if settings.llm_provider != "gemini" or limit == 0:
        return
    day, ttl = quota_window(datetime.now(UTC))
    key = f"gemini:daily:{day}:{user_id}"
    try:
        async with request.app.state.redis.pipeline(transaction=True) as pipe:
            pipe.incr(key)
            pipe.expire(key, ttl, nx=True)
            count, _ = await pipe.execute()
    except RedisError as exc:
        if settings.app_env != "production":
            return
        raise AppError("AI_QUOTA_UNAVAILABLE", "Emin AI tạm thời chưa sẵn sàng.", 503) from exc
    if int(count) > limit:
        raise AppError(
            "AI_DAILY_LIMIT",
            f"Bạn đã dùng hết {limit} lượt Emin AI hôm nay. Hãy thử lại vào ngày mai.",
            429,
        )
