from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class UserBase(BaseModel):
    id: int
    # legacy field removed from public API; kept for DB compatibility only
    telegram_id: Optional[int] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    language_code: Optional[str] = None
    photo_url: Optional[str] = None
    display_name: Optional[str] = None
    gender: Optional[str] = None
    avatar_id: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserRead(UserBase):
    last_login_at: datetime


class RegisterRequest(BaseModel):
    display_name: str
    gender: Optional[str] = None
    avatar_id: Optional[str] = None
    avatar_url: Optional[str] = None


class AuthToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class AuthResponse(BaseModel):
    token: AuthToken
    user: UserRead


class UserUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    gender: Optional[str] = None
    avatar_id: Optional[str] = None
    avatar_url: Optional[str] = None
