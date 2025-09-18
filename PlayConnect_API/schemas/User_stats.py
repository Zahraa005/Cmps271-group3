from pydantic import BaseModel
from typing import Optional
from decimal import Decimal

__all__ = ["UserStatCreate", "UserStatRead"]

class UserStatCreate(BaseModel):
    user_id: int
    games_played: Optional[int] = 0
    games_hosted: Optional[int] = 0
    attendance_rate: Optional[Decimal] = None
    sport_id: int

class UserStatRead(BaseModel):
    user_id: int
    games_played: Optional[int] = 0
    games_hosted: Optional[int] = 0
    attendance_rate: Optional[Decimal] = None
    sport_id: int
