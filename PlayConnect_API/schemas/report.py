# SCRUM-109: Report schema implemented by Mazen Hachem
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

__all__ = ["ReportCreate", "ReportRead"]

class ReportCreate(BaseModel):
    reporter_id: int
    reported_user_id: int
    report_game_id: int
    reason: str

class ReportRead(BaseModel):
    report_id: int
    reporter_id: int
    reported_user_id: int
    report_game_id: int
    reason: str
    created_at: Optional[datetime] = None
