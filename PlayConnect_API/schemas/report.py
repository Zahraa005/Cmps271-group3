# SCRUM-109: Report schema implemented by Mazen Hachem
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

__all__ = ["ReportCreate", "ReportRead", "ReportUpdate"]

class ReportCreate(BaseModel):
    reporter_id: int
    reported_user_id: int
    report_game_id: Optional[int] = None
    reason: str

class ReportUpdate(BaseModel):
    reporter_id: Optional[int] = None
    reported_user_id: Optional[int] = None
    report_game_id: Optional[int] = None
    reason: Optional[str] = None

class ReportRead(BaseModel):
    report_id: int
    reporter_id: int
    reported_user_id: int
    report_game_id: Optional[int] = None
    reason: str
    created_at: Optional[datetime] = None
