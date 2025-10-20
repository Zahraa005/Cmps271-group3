from pydantic import BaseModel
from typing import Optional
from datetime import datetime

_all_ = ["MatchHistoryCreate", "MatchHistoryRead"]

class MatchHistoryCreate(BaseModel):
    player_id: int
    opponent_id: int
    score_player: Optional[int] = None
    score_opponent: Optional[int] = None
    result: Optional[str] = None
    duration_minutes: int
    played_at: datetime


class MatchHistoryRead(BaseModel):
    match_id: int
    player_id: int
    opponent_id: int
    score_player: Optional[int]
    score_opponent: Optional[int]
    result: Optional[str]
    duration_minutes: int
    played_at: datetime

    class Config:
        from_attributes = True