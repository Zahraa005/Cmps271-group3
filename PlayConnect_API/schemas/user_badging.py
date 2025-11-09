from datetime import datetime
from typing import Optional
from pydantic import BaseModel

__all__ = ["UserBadgeCreate", "UserBadgeRead", "UserBadgeUpdate"]

class UserBadgeCreate(BaseModel):
    user_id: int
    badge_name: str
    earned_on: Optional[datetime] = datetime.utcnow()
    seen: bool = False

    class Config:
        from_attributes = True


class UserBadgeRead(BaseModel):
    id: int
    user_id: int
    badge_name: str
    earned_on: datetime
    seen: bool

    class Config:
        from_attributes = True


class UserBadgeUpdate(BaseModel):
    badge_name: Optional[str] = None
    earned_on: Optional[datetime] = None
    seen: Optional[bool] = None
