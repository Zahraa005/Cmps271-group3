from pydantic import BaseModel, EmailStr, SecretStr, model_validator
from typing import Optional

class LoginRequest(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    password: SecretStr
    remember_me: bool = False

    @model_validator(mode='after')
    def require_email_or_username(self):
        if not self.email and not self.username:
            raise ValueError("Provide either 'email' or 'username'.")
        return self

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: int
    role: str

    class Config:
        from_attributes = True
