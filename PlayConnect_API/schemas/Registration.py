from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class Registration(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str = Field(..., min_length=6)
    age: int
    created_at: Optional[datetime] = None
    isverified: bool = False
    role: str = "player"
    
  
