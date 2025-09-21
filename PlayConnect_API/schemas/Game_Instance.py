from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class GameInstanceCreate(BaseModel):
    host_id: int
    sport_id: int
    start_time: datetime
    duration_minutes: int
    location: str
    skill_level: str
    max_players: int
    cost: float = 0
    status: str = "Open"
    notes: Optional[str] = None

class GameInstanceResponse(BaseModel):
    game_id: int
    host_id: int
    sport_id: int
    start_time: datetime
    duration_minutes: int
    location: str
    skill_level: str
    max_players: int
    cost: float
    status: str
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
