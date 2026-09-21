import asyncio
import logging
import smtplib
from email.message import EmailMessage

from app.config import settings
from app.core.exceptions import AppError

logger = logging.getLogger(__name__)


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
