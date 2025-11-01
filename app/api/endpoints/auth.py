from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.models.user import User
from app.schemas.user import (
    AuthResponse,
    AuthToken,
    DevLoginRequest,
    TelegramAuthRequest,
    UserRead,
)
from app.services.security import token_service
from app.services.telegram import telegram_auth_service

router = APIRouter()


@router.post("/telegram", response_model=AuthResponse, summary="Авторизация через Telegram Mini App")
def telegram_auth(payload: TelegramAuthRequest, db: Session = Depends(deps.get_db_session)) -> AuthResponse:
    parsed = telegram_auth_service.parse_init_data(payload.init_data)
    user_payload = parsed.get("user") or {}
    telegram_id = int(user_payload.get("id"))

    user = db.query(User).filter(User.telegram_id == telegram_id).one_or_none()
    if user is None:
        user = User(
            telegram_id=telegram_id,
            username=user_payload.get("username"),
            first_name=user_payload.get("first_name"),
            last_name=user_payload.get("last_name"),
            language_code=user_payload.get("language_code"),
            photo_url=user_payload.get("photo_url"),
            last_login_at=datetime.utcnow(),
        )
        db.add(user)
    else:
        user.username = user_payload.get("username")
        user.first_name = user_payload.get("first_name")
        user.last_name = user_payload.get("last_name")
        user.language_code = user_payload.get("language_code")
        user.photo_url = user_payload.get("photo_url")
        user.last_login_at = datetime.utcnow()

    db.commit()
    db.refresh(user)

    session = deps.create_session(db, user, settings.access_token_expire_minutes)
    access_token = token_service.create_access_token(str(user.id), {"jti": session.token_jti})

    return AuthResponse(
        token=AuthToken(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.access_token_expire_minutes * 60,
        ),
        user=UserRead.model_validate(user),
    )


@router.post(
    "/dev-login",
    response_model=AuthResponse,
    summary="Локальная авторизация в режиме разработки",
)
def dev_login(payload: DevLoginRequest, db: Session = Depends(deps.get_db_session)) -> AuthResponse:
    if settings.environment == "production":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Dev-login disabled")

    telegram_id = payload.telegram_id or 999000000
    user = db.query(User).filter(User.telegram_id == telegram_id).one_or_none()
    if user is None:
        user = User(
            telegram_id=telegram_id,
            username=(payload.username or "demo_user").replace(" ", "_").lower(),
            first_name=payload.username or "Demo",
            last_name=None,
            language_code="ru",
            photo_url=None,
            last_login_at=datetime.utcnow(),
        )
        db.add(user)
    else:
        user.last_login_at = datetime.utcnow()
        if payload.username:
            user.first_name = payload.username

    db.commit()
    db.refresh(user)

    session = deps.create_session(db, user, settings.access_token_expire_minutes)
    access_token = token_service.create_access_token(str(user.id), {"jti": session.token_jti})

    return AuthResponse(
        token=AuthToken(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.access_token_expire_minutes * 60,
        ),
        user=UserRead.model_validate(user),
    )


@router.get("/me", response_model=UserRead, summary="Текущий пользователь")
def get_me(user: User = Depends(deps.get_current_user)) -> UserRead:
    return UserRead.model_validate(user)
