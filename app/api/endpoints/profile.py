from sqlalchemy import func
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.models.user import User
from app.models.user_follow import UserFollow
from app.schemas.profile import ProfileRead, ProfileUpdateRequest, FollowResponse

router = APIRouter()


@router.get("/{user_identifier}", response_model=ProfileRead, summary="Получить профиль пользователя")
def get_profile(
    user_identifier: str,  # Может быть ID или nickname
    db: Session = Depends(deps.get_db_session),
    current_user: User | None = Depends(deps.get_optional_user),  # Может быть None для публичных профилей
) -> ProfileRead:
    """Получает профиль пользователя по ID или nickname"""
    # Пытаемся найти пользователя по ID или nickname
    try:
        user_id = int(user_identifier)
        user = db.query(User).filter(User.id == user_id).first()
    except ValueError:
        # Если не число, ищем по nickname
        user = db.query(User).filter(User.nickname == user_identifier).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    # Подсчитываем подписчиков и подписки
    followers_count = db.query(func.count(UserFollow.id)).filter(
        UserFollow.following_id == user.id
    ).scalar() or 0
    
    following_count = db.query(func.count(UserFollow.id)).filter(
        UserFollow.follower_id == user.id
    ).scalar() or 0
    
    # Проверяем, подписан ли текущий пользователь на этого пользователя
    is_following = False
    is_own_profile = False
    
    if current_user:
        is_own_profile = current_user.id == user.id
        if not is_own_profile:
            # Проверяем, подписан ли текущий пользователь
            follow = db.query(UserFollow).filter(
                UserFollow.follower_id == current_user.id,
                UserFollow.following_id == user.id
            ).first()
            is_following = follow is not None
    
    # Формируем ответ
    profile_data = {
        "id": user.id,
        "nickname": user.nickname,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "language_code": user.language_code,
        "photo_url": user.avatar_url,
        "display_name": user.display_name,
        "gender": user.gender,
        "avatar_id": user.avatar_id,
        "avatar_url": user.avatar_url,
        "banner_url": user.banner_url,
        "description": user.description,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "followers_count": followers_count,
        "following_count": following_count,
        "is_following": is_following,
        "is_own_profile": is_own_profile,
    }
    
    return ProfileRead.model_validate(profile_data)


@router.post("/{user_id}/follow", response_model=FollowResponse, summary="Подписаться на пользователя")
def follow_user(
    user_id: int,
    db: Session = Depends(deps.get_db_session),
    current_user: User = Depends(deps.get_current_user),
) -> FollowResponse:
    """Подписаться на пользователя"""
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя подписаться на самого себя"
        )
    
    # Проверяем, существует ли пользователь
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    # Проверяем, не подписан ли уже
    existing_follow = db.query(UserFollow).filter(
        UserFollow.follower_id == current_user.id,
        UserFollow.following_id == user_id
    ).first()
    
    if existing_follow:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Вы уже подписаны на этого пользователя"
        )
    
    # Создаем подписку
    follow = UserFollow(
        follower_id=current_user.id,
        following_id=user_id
    )
    db.add(follow)
    db.commit()
    db.refresh(follow)
    
    # Подсчитываем новых подписчиков
    followers_count = db.query(func.count(UserFollow.id)).filter(
        UserFollow.following_id == user_id
    ).scalar() or 0
    
    return FollowResponse(
        is_following=True,
        followers_count=followers_count
    )


@router.delete("/{user_id}/follow", response_model=FollowResponse, summary="Отписаться от пользователя")
def unfollow_user(
    user_id: int,
    db: Session = Depends(deps.get_db_session),
    current_user: User = Depends(deps.get_current_user),
) -> FollowResponse:
    """Отписаться от пользователя"""
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя отписаться от самого себя"
        )
    
    # Проверяем, существует ли пользователь
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    # Находим подписку
    follow = db.query(UserFollow).filter(
        UserFollow.follower_id == current_user.id,
        UserFollow.following_id == user_id
    ).first()
    
    if not follow:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Вы не подписаны на этого пользователя"
        )
    
    # Удаляем подписку
    db.delete(follow)
    db.commit()
    
    # Подсчитываем новых подписчиков
    followers_count = db.query(func.count(UserFollow.id)).filter(
        UserFollow.following_id == user_id
    ).scalar() or 0
    
    return FollowResponse(
        is_following=False,
        followers_count=followers_count
    )


@router.patch("/{user_id}", response_model=ProfileRead, summary="Обновить профиль пользователя")
def update_profile(
    user_id: int,
    payload: ProfileUpdateRequest,
    db: Session = Depends(deps.get_db_session),
    current_user: User = Depends(deps.get_current_user),
) -> ProfileRead:
    """Обновить профиль пользователя (только свой)"""
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нельзя обновить чужой профиль"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    # Обновляем поля
    if payload.display_name is not None:
        user.display_name = payload.display_name.strip() or None
    if payload.description is not None:
        user.description = payload.description.strip() or None
    if payload.gender is not None:
        gender = payload.gender.strip().lower()
        user.gender = gender if gender in {"male", "female", "robot"} else None
    if payload.avatar_id is not None:
        user.avatar_id = payload.avatar_id.strip() or None
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Подсчитываем подписчиков и подписки
    followers_count = db.query(func.count(UserFollow.id)).filter(
        UserFollow.following_id == user.id
    ).scalar() or 0
    
    following_count = db.query(func.count(UserFollow.id)).filter(
        UserFollow.follower_id == user.id
    ).scalar() or 0
    
    # Формируем ответ
    profile_data = {
        "id": user.id,
        "nickname": user.nickname,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "language_code": user.language_code,
        "photo_url": user.avatar_url,
        "display_name": user.display_name,
        "gender": user.gender,
        "avatar_id": user.avatar_id,
        "avatar_url": user.avatar_url,
        "banner_url": user.banner_url,
        "description": user.description,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "followers_count": followers_count,
        "following_count": following_count,
        "is_following": False,
        "is_own_profile": True,
    }
    
    return ProfileRead.model_validate(profile_data)

