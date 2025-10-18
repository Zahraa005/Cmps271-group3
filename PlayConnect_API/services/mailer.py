import os
import smtplib
import asyncio
from email.message import EmailMessage
from typing import Optional

MAIL_FROM = os.getenv("MAIL_FROM")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

class MailerError(Exception):
    pass

def _build_message(to: str, subject: str, html: str, text: Optional[str] = None) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = MAIL_FROM or SMTP_USERNAME
    msg["To"] = to
    msg["Subject"] = subject
    # BCC yourself in non-production so you can see outbound mail even if the recipient's domain blocks it
    if (os.getenv("ENV", "dev") or "dev").lower() != "production":
        if SMTP_USERNAME:
            msg["Bcc"] = SMTP_USERNAME
    if text:
        msg.set_content(text)
    else:
        msg.set_content("This message contains HTML content.")
    msg.add_alternative(html, subtype="html")
    return msg

def _send_sync(msg: EmailMessage) -> None:
    if not (SMTP_USERNAME and SMTP_PASSWORD):
        raise MailerError("SMTP credentials missing (SMTP_USERNAME/SMTP_PASSWORD).")
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
        # Optional wire debug logging (set SMTP_DEBUG=1 in .env to enable)
        if os.getenv("SMTP_DEBUG") == "1":
            server.set_debuglevel(1)
        server.ehlo()
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)

async def send_email(to: str, subject: str, html: str, text: Optional[str] = None) -> bool:
    """Async API used by the app."""
    msg = _build_message(to, subject, html, text)
    await asyncio.to_thread(_send_sync, msg)
    return True

def render_template(template_path: str, context: dict) -> str:
    """Render an HTML email template with {{placeholders}} replaced by context values.
    Also, if a template still has a hardcoded 'Someone' greeting, replace it with the provided first_name.
    """
    with open(template_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Replace {{key}} placeholders
    for key, value in context.items():
        placeholder = "{{" + key + "}}"
        content = content.replace(placeholder, str(value))

    # Fallback greeting fix: swap out hardcoded 'Someone' if present and first_name is provided
    if "first_name" in context:
        content = content.replace("Hi <strong>Someone</strong>,", f"Hi <strong>{context['first_name']}</strong>,")

    # Ensure we don't leave a raw {{first_name}} if not supplied
    if "{{first_name}}" in content and "first_name" not in context:
        content = content.replace("{{first_name}}", "Player")

    return content
