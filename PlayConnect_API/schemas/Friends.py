from pydantic import BaseModel
from typing import Optional
from datetime import datetime

__all__ = ["FriendCreate", "FriendRead", "FriendUpdate"]

class FriendCreate(BaseModel):
    user_id: int
    friend_id: int
    status: Optional[str] = "pending"  # 'pending', 'accepted', or 'rejected'


class FriendRead(BaseModel):
    user_id: int
    friend_id: int
    status: str
    created_at: Optional[datetime] = None


class FriendUpdate(BaseModel):
    """
    Schema for updating friend status (accept/reject)
    """
    status: str  # expected values: 'accepted' or 'rejected'
