from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
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
from app.services.storage import avatar_storage

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

    # Обрабатываем avatar_url и avatar_id вместе
    if payload.avatar_url is not None:
        new_avatar_url = payload.avatar_url.strip() or None
        user.avatar_url = new_avatar_url
        
        # Если устанавливаем загруженный аватар с устройства, всегда очищаем avatar_id
        if new_avatar_url and new_avatar_url.startswith('/api/auth/avatar/'):
            user.avatar_id = None
        # Если avatar_url установлен (но не загруженный) и avatar_id тоже передан, используем avatar_id
        elif payload.avatar_id is not None:
            user.avatar_id = payload.avatar_id.strip() or None
        changed = True
    elif payload.avatar_id is not None:
        # Если avatar_url не передан, но avatar_id передан, обновляем только avatar_id
        user.avatar_id = payload.avatar_id.strip() or None
        changed = True

    if payload.description is not None:
        user.description = payload.description.strip() or None
        changed = True

    if payload.banner_url is not None:
        user.banner_url = payload.banner_url.strip() or None
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


@router.post("/upload-avatar", response_model=UserRead, summary="Загрузка аватара пользователя")
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> UserRead:
    """Загружает аватар пользователя"""
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Файл не найден")

    # Проверяем тип файла (разрешаем изображения)
    allowed_types = ("image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif")
    if file.content_type and file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Неподдерживаемый тип файла: {file.content_type}. Разрешенные типы: {', '.join(allowed_types)}",
        )

    # Сохраняем файл
    path, size = avatar_storage.save_upload(user.id, file)
    size_mb = size / (1024 * 1024)
    if size_mb > settings.max_avatar_size_mb:
        path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Файл слишком большой. Максимальный размер: {settings.max_avatar_size_mb} МБ",
        )

    # Получаем относительный путь для сохранения в БД
    relative_path = path.relative_to(avatar_storage.base_dir)
    
    # Формируем URL для доступа к файлу (используем статический путь)
    avatar_url = f"/api/auth/avatar/{user.id}/{relative_path.name}"
    
    # Обновляем пользователя
    user.avatar_url = avatar_url
    db.add(user)
    db.commit()
    db.refresh(user)

    return UserRead.model_validate(user)


@router.get("/avatar/{user_id}/{filename}", response_class=FileResponse, summary="Получить аватар пользователя")
def get_avatar(
    user_id: int,
    filename: str,
    db: Session = Depends(deps.get_db_session),
) -> FileResponse:
    """Получает аватар пользователя"""
    try:
        file_path = avatar_storage.resolve_path(f"{user_id}/{filename}")
        if not file_path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Аватар не найден")
        
        # Определяем MIME тип по расширению
        ext = file_path.suffix.lower()
        mime_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
        }
        media_type = mime_types.get(ext, 'image/jpeg')
        
        return FileResponse(
            path=file_path,
            media_type=media_type,
            filename=filename,
        )
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Аватар не найден")


@router.post("/upload-banner", response_model=UserRead, summary="Загрузка баннера пользователя")
async def upload_banner(
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> UserRead:
    """Загружает баннер пользователя"""
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Файл не найден")

    # Проверяем тип файла (разрешаем изображения)
    allowed_types = ("image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif")
    if file.content_type and file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Неподдерживаемый тип файла: {file.content_type}. Разрешенные типы: {', '.join(allowed_types)}",
        )

    # Сохраняем файл (используем тот же сервис, что и для аватаров)
    path, size = avatar_storage.save_upload(user.id, file)
    size_mb = size / (1024 * 1024)
    if size_mb > settings.max_avatar_size_mb:
        path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Файл слишком большой. Максимальный размер: {settings.max_avatar_size_mb} МБ",
        )

    # Получаем относительный путь для сохранения в БД
    relative_path = path.relative_to(avatar_storage.base_dir)
    
    # Формируем URL для доступа к файлу
    banner_url = f"/api/auth/banner/{user.id}/{relative_path.name}"
    
    # Обновляем пользователя
    user.banner_url = banner_url
    db.add(user)
    db.commit()
    db.refresh(user)

    return UserRead.model_validate(user)


@router.get("/banner/{user_id}/{filename}", response_class=FileResponse, summary="Получить баннер пользователя")
def get_banner(
    user_id: int,
    filename: str,
    db: Session = Depends(deps.get_db_session),
) -> FileResponse:
    """Получает баннер пользователя"""
    try:
        file_path = avatar_storage.resolve_path(f"{user_id}/{filename}")
        if not file_path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Баннер не найден")
        
        # Определяем MIME тип по расширению
        ext = file_path.suffix.lower()
        mime_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
        }
        media_type = mime_types.get(ext, 'image/jpeg')
        
        return FileResponse(
            path=file_path,
            media_type=media_type,
            filename=filename,
        )
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Баннер не найден")


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT, summary="Удаление аккаунта")
def delete_account(
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> None:
    """Удаляет аккаунт пользователя и все связанные данные"""
    # Удаляем пользователя (каскадное удаление должно удалить все связанные данные)
    db.delete(user)
    db.commit()
