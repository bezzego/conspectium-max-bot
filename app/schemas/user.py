from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class UserBase(BaseModel):
    id: int
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    language_code: Optional[str] = None
    photo_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserRead(UserBase):
    last_login_at: datetime


class TelegramAuthRequest(BaseModel):
    init_data: str


class DevLoginRequest(BaseModel):
    username: Optional[str] = "Demo User"
    telegram_id: Optional[int] = None


class AuthToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class AuthResponse(BaseModel):
    token: AuthToken
    user: UserRead
