from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal
from typing import Literal

__all__ = ["CoachCreate", "CoachRead"]

class CoachCreate(BaseModel):
    experience_yrs: Optional[int] = None
    certifications: Optional[str] = None
    isverified: bool = False
    hourly_rate: Optional[Decimal] = None

class CoachUpdate(BaseModel):
    experience_yrs: Optional[int] = None
    certifications: Optional[str] = None
    isverified: Optional[bool] = None
    hourly_rate: Optional[Decimal] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    favorite_sport: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None

class CoachRead(BaseModel):
    coach_id: int
    experience_yrs: Optional[int] = None
    certifications: Optional[str] = None
    isverified: bool
    hourly_rate: Optional[Decimal] = None
    created_at: datetime

    # ✅ extra optional fields the Frontend expects
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    favorite_sport: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None

    class Config:
        orm_mode = True


class CoachVerifyUpdate(BaseModel):
    # Only allow turning verification ON via this endpoint
    isverified: Literal[True]
