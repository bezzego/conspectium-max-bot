from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.models.audio import AudioSource
from app.models.enums import AudioProcessingStatus, AudioSourceType
from app.models.user import User
from app.schemas.audio import AudioSourceRead
from app.services.storage import audio_storage

router = APIRouter()


@router.post("/upload", response_model=AudioSourceRead, summary="Загрузка аудио файла")
async def upload_audio(
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> AudioSourceRead:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Файл не найден")

    allowed_prefix = ("audio/", "application/octet-stream")
    if file.content_type and not file.content_type.startswith(allowed_prefix):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Неподдерживаемый тип файла: {file.content_type}",
        )

    path, size = audio_storage.save_upload(user.id, file)
    size_mb = size / (1024 * 1024)
    if size_mb > settings.max_upload_size_mb:
        path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Файл слишком большой",
        )

    relative_path = path.relative_to(audio_storage.base_dir)
    audio_source = AudioSource(
        user_id=user.id,
        source_type=AudioSourceType.UPLOAD,
        original_filename=file.filename,
        mime_type=file.content_type,
        file_path=str(relative_path),
        file_size=size_mb,
        status=AudioProcessingStatus.PENDING,
    )
    db.add(audio_source)
    db.commit()
    db.refresh(audio_source)
    return AudioSourceRead.model_validate(audio_source)


@router.get(
    "/{audio_id}/download",
    response_class=FileResponse,
    summary="Скачать исходный аудиофайл",
)
def download_audio(
    audio_id: int,
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> FileResponse:
    audio_source = (
        db.query(AudioSource)
        .filter(AudioSource.id == audio_id, AudioSource.user_id == user.id)
        .one_or_none()
    )
    if audio_source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл не найден")
    if not audio_source.file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл не сохранён")

    try:
        file_path = audio_storage.resolve_path(audio_source.file_path)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл недоступен") from exc
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Файл недоступен")

    return FileResponse(
        path=file_path,
        media_type=audio_source.mime_type or "application/octet-stream",
        filename=audio_source.original_filename or file_path.name,
    )
