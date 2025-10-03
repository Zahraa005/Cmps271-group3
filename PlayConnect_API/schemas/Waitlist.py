from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class WaitlistRead(BaseModel):
    game_id: int
    user_id: int
    joined_at: datetime
    admitted: bool

    class Config:
        orm_mode = True

class WaitlistCreate(BaseModel):
    game_id: int
    user_id: int
    admitted: Optional[bool] = False
