from pydantic import BaseModel
from datetime import datetime
from typing import Optional

__all__ = ["PasswordResetTokenCreate", "PasswordResetTokenRead", "PasswordResetTokenUpdate"]

class PasswordResetTokenCreate(BaseModel):
    user_id: int
    token_hash: str
    expires_at: datetime

class PasswordResetTokenRead(BaseModel):
    id: int
    user_id: int
    token_hash: str
    expires_at: datetime
    used_at: Optional[datetime] = None
    created_at: datetime

class PasswordResetTokenUpdate(BaseModel):
    used_at: Optional[datetime] = None
