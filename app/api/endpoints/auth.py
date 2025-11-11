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
    LoginRequest,
    ChangePasswordRequest,
)
from app.services.security import token_service
from app.services.auth import hash_password, verify_password

router = APIRouter()


# Telegram-based auth removed: site now uses web registration (/auth/register)


# Dev-login endpoint removed to enforce web-only registration


@router.post("/register", response_model=AuthResponse, summary="Регистрация пользователя (веб)")
def register(payload: RegisterRequest, db: Session = Depends(deps.get_db_session)) -> AuthResponse:
    # Проверяем уникальность email
    existing_email = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже существует"
        )
    
    # Проверяем уникальность nickname
    existing_nickname = db.query(User).filter(User.nickname == payload.nickname.strip()).first()
    if existing_nickname:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким никнеймом уже существует"
        )
    
    # Хешируем пароль
    password_hash = hash_password(payload.password)
    
    # Создаем пользователя
    user = User(
        email=payload.email.lower().strip(),
        nickname=payload.nickname.strip(),
        password_hash=password_hash,
        display_name=payload.display_name.strip() if payload.display_name else None,
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


@router.post("/login", response_model=AuthResponse, summary="Вход пользователя")
def login(payload: LoginRequest, db: Session = Depends(deps.get_db_session)) -> AuthResponse:
    # Ищем пользователя по email или nickname
    user = (
        db.query(User)
        .filter(
            (User.email == payload.login.lower().strip()) | (User.nickname == payload.login.strip())
        )
        .first()
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email/никнейм или пароль"
        )
    
    # Проверяем пароль
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email/никнейм или пароль"
        )
    
    # Проверяем, активен ли пользователь
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт деактивирован"
        )
    
    # Обновляем время последнего входа
    user.last_login_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    # Создаем сессию
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


@router.post("/change-password", response_model=dict, summary="Изменение пароля")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> dict:
    # Проверяем старый пароль
    if not verify_password(payload.old_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный текущий пароль"
        )
    
    # Проверяем, что новый пароль отличается от старого
    if verify_password(payload.new_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Новый пароль должен отличаться от текущего"
        )
    
    # Хешируем новый пароль
    user.password_hash = hash_password(payload.new_password)
    db.add(user)
    db.commit()
    
    return {"message": "Пароль успешно изменен"}
