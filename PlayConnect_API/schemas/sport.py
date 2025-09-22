from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class SportRead(BaseModel):
    sport_id: int
    name: str
    description: Optional[str] = None
    min_players: int
    created_at: datetime

    class Config:
        from_attributes = True

class SportCreate(BaseModel):
    name: str
    description: Optional[str] = None
    min_players: int = 1
