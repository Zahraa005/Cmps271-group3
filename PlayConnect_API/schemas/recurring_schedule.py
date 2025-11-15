from __future__ import annotations
from typing import Optional, Any, Dict
from pydantic import BaseModel, Field
from datetime import datetime, date

class RecurringScheduleBase(BaseModel):
    host_id: int
    sport_id: Optional[int] = None
    rrule: str = Field(..., description="RFC5545 RRULE string, e.g. 'FREQ=WEEKLY;BYDAY=FR'")
    dtstart: datetime = Field(..., description="Anchor start datetime (tz-aware ISO)")
    timezone: str = Field("UTC", description="IANA timezone name")
    template: Optional[Dict[str, Any]] = Field(None, description="JSON template for fields to apply when creating a game")
    duration_minutes: Optional[int] = Field(90, description="Default game duration")
    max_players: Optional[int] = None
    location: Optional[str] = None
    skill_level: Optional[str] = None
    cost: Optional[float] = None
    status: Optional[str] = Field("open", description="Default status for created game instances")
    end_date: Optional[date] = None
    occurrences_left: Optional[int] = None
    active: Optional[bool] = True

class RecurringScheduleCreate(RecurringScheduleBase):
    pass

class RecurringScheduleUpdate(BaseModel):
    # All fields optional for PATCH-like updates
    sport_id: Optional[int] = None
    rrule: Optional[str] = None
    dtstart: Optional[datetime] = None
    timezone: Optional[str] = None
    template: Optional[Dict[str, Any]] = None
    duration_minutes: Optional[int] = None
    max_players: Optional[int] = None
    location: Optional[str] = None
    skill_level: Optional[str] = None
    cost: Optional[float] = None
    status: Optional[str] = None
    end_date: Optional[date] = None
    occurrences_left: Optional[int] = None
    active: Optional[bool] = None

class RecurringScheduleRead(RecurringScheduleBase):
    id: int
    next_run: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True