import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


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
    banner_url: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserRead(UserBase):
    last_login_at: datetime


class RegisterRequest(BaseModel):
    email: EmailStr = Field(..., description="Email пользователя")
    nickname: str = Field(..., min_length=3, max_length=50, description="Никнейм пользователя")
    password: str = Field(..., min_length=6, max_length=100, description="Пароль пользователя")
    display_name: Optional[str] = Field(None, max_length=255, description="Отображаемое имя")
    gender: Optional[str] = Field(None, description="Пол пользователя")
    avatar_id: Optional[str] = Field(None, description="ID аватара")
    avatar_url: Optional[str] = Field(None, description="URL аватара")
    
    @field_validator('nickname')
    @classmethod
    def validate_nickname(cls, v: str) -> str:
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('Никнейм может содержать только буквы, цифры и подчеркивание')
        return v.strip()
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError('Пароль должен содержать минимум 6 символов')
        return v


class LoginRequest(BaseModel):
    login: str = Field(..., description="Email или никнейм пользователя")
    password: str = Field(..., description="Пароль пользователя")


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., description="Текущий пароль")
    new_password: str = Field(..., min_length=6, max_length=100, description="Новый пароль")
    confirm_password: str = Field(..., description="Подтверждение нового пароля")
    
    @field_validator('new_password')
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError('Пароль должен содержать минимум 6 символов')
        return v
    
    @field_validator('confirm_password')
    @classmethod
    def validate_confirm_password(cls, v: str, info) -> str:
        if 'new_password' in info.data and v != info.data['new_password']:
            raise ValueError('Пароли не совпадают')
        return v


class AuthToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class AuthResponse(BaseModel):
    token: AuthToken
    user: UserRead


class UserUpdateRequest(BaseModel):
    display_name: Optional[str] = Field(None, max_length=255, description="Отображаемое имя")
    gender: Optional[str] = Field(None, description="Пол пользователя")
    avatar_id: Optional[str] = Field(None, description="ID аватара")
    avatar_url: Optional[str] = Field(None, description="URL аватара")
    banner_url: Optional[str] = Field(None, description="URL баннера")
    description: Optional[str] = Field(None, max_length=500, description="Описание профиля")
