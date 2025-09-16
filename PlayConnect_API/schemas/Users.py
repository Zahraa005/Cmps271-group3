from pydantic import BaseModel, EmailStr

__all__ = ["UserRead", "UserCreate"]
from typing import Optional
from datetime import datetime

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    age: int
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    favorite_sport: Optional[str] = None
    isverified: bool = False
    role: str

class UserRead(BaseModel):
    user_id: int
    email: EmailStr
    first_name: str
    last_name: str
    age: int
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    favorite_sport: Optional[str] = None
    isverified: bool
    num_of_strikes: int
    created_at: datetime
    role: str

