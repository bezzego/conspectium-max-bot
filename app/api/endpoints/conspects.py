from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.models.conspect import Conspect
from app.models.enums import ConspectStatus
from app.models.user import User
from app.schemas.conspect import ConspectCreateRequest, ConspectListResponse, ConspectRead
from app.schemas.job import JobRead
from app.services.generation import generation_service

router = APIRouter()


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


@router.get("", response_model=ConspectListResponse)
def list_conspects(
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> ConspectListResponse:
    items = (
        db.query(Conspect)
        .filter(Conspect.user_id == user.id)
        .order_by(Conspect.created_at.desc())
        .all()
    )
    return ConspectListResponse(items=[ConspectRead.model_validate(item) for item in items])


@router.get("/{conspect_id}", response_model=ConspectRead)
def get_conspect(
    conspect_id: int,
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> ConspectRead:
    conspect = db.get(Conspect, conspect_id)
    if conspect is None or conspect.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Конспект не найден")
    return ConspectRead.model_validate(conspect)
