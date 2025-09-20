from pydantic import BaseModel, Emailstr
from datetime import datetime


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    age: int
    created_at: datetime | None = None


class RegisterResponse(BaseModel):
    user_id: int
    email: EmailStr
    first_name: str
    last_name: str
    age: int
    created_at: datetime | None = None
