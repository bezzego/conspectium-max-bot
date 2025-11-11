from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.api import deps
from app.models.conspect import Conspect
from app.models.enums import ConspectStatus
from app.models.user import User
from app.schemas.conspect import (
    ConspectCreateRequest,
    ConspectListResponse,
    ConspectRead,
    ConspectVariantCreateRequest,
)
from app.schemas.job import JobRead
from app.services.generation import generation_service
from app.services.sharing import (
    get_conspect_by_share_token,
    get_or_create_share_token_conspect,
)

router = APIRouter()


def _serialize_conspect(conspect: Conspect) -> ConspectRead:
    base = ConspectRead.model_validate(conspect)
    return base.model_copy(
        update={
            "available_variants": conspect.available_variants,
        }
    )


@router.post("", response_model=JobRead, status_code=status.HTTP_202_ACCEPTED)
def create_conspect(
    payload: ConspectCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> JobRead:
    try:
        job = generation_service.create_conspect_job(db, user=user, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    background_tasks.add_task(generation_service.process_conspect_job, job.id)
    return JobRead.model_validate(job)


@router.post("/{conspect_id}/share-token", summary="Получить или создать токен для шаринга")
def get_share_token(
    conspect_id: int,
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> dict[str, str]:
    """Генерирует или возвращает существующий share_token для конспекта"""
    token = get_or_create_share_token_conspect(db, conspect_id, user.id)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Конспект не найден"
        )
    return {"share_token": token}


@router.get("/share/{share_token}", response_model=ConspectRead, summary="Получить конспект по публичной ссылке")
def get_shared_conspect(
    share_token: str,
    db: Session = Depends(deps.get_db_session),
) -> ConspectRead:
    """Получает конспект по публичному токену (без авторизации)"""
    conspect = get_conspect_by_share_token(db, share_token)
    if not conspect:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Конспект не найден"
        )
    if conspect.status != ConspectStatus.READY:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Конспект еще не готов"
        )
    return _serialize_conspect(conspect)


@router.get("", response_model=ConspectListResponse)
def list_conspects(
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> ConspectListResponse:
    items = (
        db.query(Conspect)
        .filter(Conspect.user_id == user.id)
        .order_by(Conspect.created_at.desc())
        .options(selectinload(Conspect.audio_source))
        .all()
    )
    return ConspectListResponse(items=[_serialize_conspect(item) for item in items])


@router.get("/{conspect_id}", response_model=ConspectRead)
def get_conspect(
    conspect_id: int,
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> ConspectRead:
    conspect = (
        db.query(Conspect)
        .filter(Conspect.id == conspect_id, Conspect.user_id == user.id)
        .options(selectinload(Conspect.audio_source))
        .one_or_none()
    )
    if conspect is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Конспект не найден")
    return _serialize_conspect(conspect)


@router.post(
    "/{conspect_id}/variants",
    response_model=JobRead,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Запросить дополнительный вариант конспекта",
)
def create_conspect_variant(
    conspect_id: int,
    payload: ConspectVariantCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> JobRead:
    try:
        job = generation_service.create_conspect_variant_job(
            db,
            user=user,
            conspect_id=conspect_id,
            variant=payload.variant,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    background_tasks.add_task(generation_service.process_conspect_job, job.id)
    return JobRead.model_validate(job)
