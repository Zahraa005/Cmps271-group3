from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

__all__ = ["ForgotPasswordRequestCreate", "ForgotPasswordRequestRead"]

class ForgotPasswordRequestCreate(BaseModel):
    email: EmailStr

class ForgotPasswordRequestRead(BaseModel):
    request_id: int
    email: EmailStr
    created_at: datetime
    expires_at: Optional[datetime] = None
    is_used: bool
