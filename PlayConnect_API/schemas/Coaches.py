from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal

__all__ = ["CoachCreate", "CoachRead"]

class CoachCreate(BaseModel):
    experience_yrs: Optional[int] = None
    certifications: Optional[str] = None
    isverified: bool = False
    hourly_rate: Optional[Decimal] = None

class CoachRead(BaseModel):
    coach_id: int
    experience_yrs: Optional[int] = None
    certifications: Optional[str] = None
    isverified: bool
    hourly_rate: Optional[Decimal] = None
    created_at: datetime
