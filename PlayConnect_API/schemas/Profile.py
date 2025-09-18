from pydantic import BaseModel
from typing import Optional

class ProfileCreate(BaseModel):
    first_name: str
    last_name: str
    age: int
    favorite_sport: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str   

class ProfileRead(BaseModel):
    user_id: int
    first_name: str
    last_name: str
    age: int
    favorite_sport: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str

    class Config:
        orm_mode = True
