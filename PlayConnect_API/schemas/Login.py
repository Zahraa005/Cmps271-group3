from pydantic import BaseModel, EmailStr, SecretStr, root_validator
from typing import Optional

class LoginRequest(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    password: SecretStr
    remember_me: bool = False

    @root_validator
    def require_email_or_username(cls, values):
        email = values.get("email")
        username = values.get("username")
        if not email and not username:
            raise ValueError("Provide either 'email' or 'username'.")
        return values

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: int
    role: str

    class Config:
        orm_mode = True
