from pydantic import BaseModel
from typing import Literal


class GameParticipantJoin(BaseModel):
    game_id: int
    user_id: int
    role: Literal["PLAYER", "HOST"] = "PLAYER"


class GameParticipantLeave(BaseModel):
    game_id: int
    user_id: int


