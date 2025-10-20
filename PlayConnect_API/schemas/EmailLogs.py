from pydantic import BaseModel
from datetime import datetime
from typing import Optional

__all__ = ["EmailLogCreate", "EmailLogRead", "EmailLogUpdate"]

class EmailLogCreate(BaseModel):
    user_id: int
    recipient_email: Optional[str] = None
    subject: str
    body: str
    type: Optional[str] = "system"
    status: Optional[str] = "sent"
    error_message: Optional[str] = None

class EmailLogRead(BaseModel):
    email_id: int
    user_id: int
    recipient_email: Optional[str] = None
    subject: str
    body: str
    type: Optional[str] = None
    status: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    sent_at: Optional[datetime] = None

class EmailLogUpdate(BaseModel):
    status: Optional[str] = None
    error_message: Optional[str] = None
    sent_at: Optional[datetime] = None
