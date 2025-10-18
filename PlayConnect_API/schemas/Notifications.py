from typing import Optional, Literal, Dict, Any
from pydantic import BaseModel
from datetime import datetime

# Define allowed notification types
NotificationType = Literal[
    "waitlist",
    "game_update",
    "game_full",
    "game_cancelled",
    "reminder",
    "system"
]

# Used when creating a new notification
class NotificationCreate(BaseModel):
    user_id: int
    message: str
    type: NotificationType = "system"
    metadata: Optional[Dict[str, Any]] = None   # e.g. {"game_id": 29}
    is_read: bool = False

# Used when reading notifications (response)
class NotificationRead(BaseModel):
    notification_id: int
    user_id: int
    message: str
    type: NotificationType
    metadata: Optional[Dict[str, Any]] = None
    is_read: bool
    created_at: datetime

# Used to mark a notification as read
class NotificationMarkRead(BaseModel):
    is_read: bool = True
