from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.schemas.user import UserBase


class ProfileRead(UserBase):
    """Профиль пользователя с информацией о подписках"""
    nickname: str
    followers_count: int = 0
    following_count: int = 0
    is_following: bool = False  # Подписан ли текущий пользователь на этого пользователя
    is_own_profile: bool = False  # Это свой профиль или нет

    model_config = ConfigDict(from_attributes=True)


class ProfileUpdateRequest(BaseModel):
    """Запрос на обновление профиля"""
    display_name: Optional[str] = None
    description: Optional[str] = None
    gender: Optional[str] = None
    avatar_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class FollowRequest(BaseModel):
    """Запрос на подписку/отписку"""
    user_id: int


class FollowResponse(BaseModel):
    """Ответ на подписку/отписку"""
    is_following: bool
    followers_count: int


