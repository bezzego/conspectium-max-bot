from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.models.user import User
from app.schemas.user import (
    AuthResponse,
    AuthToken,
    UserRead,
    UserUpdateRequest,
    RegisterRequest,
)
from app.services.security import token_service

router = APIRouter()


# Telegram-based auth removed: site now uses web registration (/auth/register)


# Dev-login endpoint removed to enforce web-only registration


@router.post("/register", response_model=AuthResponse, summary="Регистрация пользователя (веб)")
def register(payload: RegisterRequest, db: Session = Depends(deps.get_db_session)) -> AuthResponse:
    # Create a new user (minimal required fields) and return auth token
    user = User(
        display_name=payload.display_name.strip() or None,
        gender=payload.gender.strip().lower() if payload.gender else None,
        avatar_id=payload.avatar_id,
        avatar_url=payload.avatar_url,
        last_login_at=datetime.utcnow(),
    )
    db.add(user)
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


@router.patch("/me", response_model=UserRead, summary="Обновление профиля текущего пользователя")
def update_me(
    payload: UserUpdateRequest,
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> UserRead:
    changed = False

    if payload.display_name is not None:
        user.display_name = payload.display_name.strip() or None
        changed = True

    if payload.gender is not None:
        gender = payload.gender.strip().lower()
        user.gender = gender if gender in {"male", "female", "robot"} else None
        changed = True

    if payload.avatar_id is not None:
        user.avatar_id = payload.avatar_id.strip() or None
        changed = True

    if payload.avatar_url is not None:
        user.avatar_url = payload.avatar_url.strip() or None
        changed = True

    if changed:
        db.add(user)
        db.commit()
        db.refresh(user)

    return UserRead.model_validate(user)
