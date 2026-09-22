import asyncio
import logging
import re
import smtplib
from email.message import EmailMessage

import httpx

from app.config import settings
from app.core.exceptions import AppError

logger = logging.getLogger(__name__)


def _normalize_resend_from_email(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        return cleaned
    match = re.search(r"<([^<>]+)>$", cleaned)
    if match:
        return match.group(1).strip()
    return cleaned


def _deliver_smtp(recipient: str, code: str) -> None:
    message = EmailMessage()
    message["Subject"] = "Mã xác thực StudyHubAI"
    message["From"] = settings.smtp_from_email
    message["To"] = recipient
    message.set_content(
        "Mã xác thực StudyHubAI của bạn là: "
        f"{code}\n\nMã có hiệu lực trong {settings.registration_otp_expire_minutes} phút. "
        "Không chia sẻ mã này với bất kỳ ai."
    )
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as client:
        if settings.smtp_starttls:
            client.starttls()
        if settings.smtp_username:
            client.login(settings.smtp_username, settings.smtp_password)
        client.send_message(message)


def _deliver_resend(recipient: str, code: str) -> None:
    from_email = _normalize_resend_from_email(settings.resend_from_email)
    if not settings.resend_api_key or not from_email:
        raise AppError(
            "EMAIL_NOT_CONFIGURED",
            "Dịch vụ email Resend chưa được cấu hình đầy đủ.",
            503,
        )

    url = "https://api.resend.com/emails"
    payload = {
        "from": from_email,
        "to": [recipient],
        "subject": "Mã xác thực StudyHubAI",
        "html": (
            "<p>Xin chào,</p>"
            f"<p>Mã xác thực StudyHubAI của bạn là <strong>{code}</strong>.</p>"
            f"<p>Mã có hiệu lực trong {settings.registration_otp_expire_minutes} phút.</p>"
            "<p>Không chia sẻ mã này với bất kỳ ai.</p>"
        ),
    }
    response = httpx.post(
        url,
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=20,
    )
    if response.status_code >= 400:
        try:
            detail = response.json()
        except ValueError:
            detail = {"message": response.text}
        raise AppError(
            "EMAIL_DELIVERY_FAILED",
            detail.get("message") or "Không thể gửi email xác thực qua Resend.",
            response.status_code,
        )


async def send_registration_otp(recipient: str, code: str) -> None:
    if settings.email_provider == "console":
        if settings.app_env == "production":
            raise AppError(
                "EMAIL_NOT_CONFIGURED",
                "Dịch vụ email xác thực chưa được cấu hình.",
                503,
            )
        logger.warning("Development OTP for %s: %s", recipient, code)
        return

    if settings.email_provider == "resend":
        try:
            await asyncio.to_thread(_deliver_resend, recipient, code)
        except AppError:
            raise
        except (OSError, httpx.HTTPError) as exc:
            logger.exception("OTP email delivery failed for %s via Resend", recipient)
            raise AppError(
                "EMAIL_DELIVERY_FAILED",
                "Không thể gửi email xác thực lúc này. Hãy thử lại sau.",
                503,
            ) from exc
        return

    if not settings.smtp_host or not settings.smtp_from_email:
        raise AppError(
            "EMAIL_NOT_CONFIGURED",
            "Dịch vụ email xác thực chưa được cấu hình đầy đủ.",
            503,
        )
    try:
        await asyncio.to_thread(_deliver_smtp, recipient, code)
    except (OSError, smtplib.SMTPException) as exc:
        logger.exception("OTP email delivery failed for %s", recipient)
        raise AppError(
            "EMAIL_DELIVERY_FAILED",
            "Không thể gửi email xác thực lúc này. Hãy thử lại sau.",
            503,
        ) from exc
