from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Union


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    age: int
    created_at: Union[datetime, None] = None

class RegisterResponse(BaseModel):
    user_id: int
    email: EmailStr
    first_name: str 
    last_name: str
    age: int
    created_at: Union[datetime, None] = None
