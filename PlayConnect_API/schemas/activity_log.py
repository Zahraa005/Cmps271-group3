from datetime import datetime
from typing import Optional
from pydantic import BaseModel

__all__ = ["ActivityLogCreate", "ActivityLogRead", "ActivityLogUpdate"]

class ActivityLogCreate(BaseModel):
    user_id: int
    action: str
    created_at: Optional[datetime] = datetime.utcnow()

    class Config:
        from_attributes = True


class ActivityLogRead(BaseModel):
    id: int
    user_id: int
    action: str
    created_at: datetime

    class Config:
        from_attributes = True


class ActivityLogUpdate(BaseModel):
    action: Optional[str] = None
    created_at: Optional[datetime] = None
