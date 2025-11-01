from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.enums import AudioProcessingStatus, AudioSourceType


class AudioSourceRead(BaseModel):
    id: int
    user_id: Optional[int] = None
    source_type: AudioSourceType
    original_filename: Optional[str] = None
    mime_type: Optional[str] = None
    file_path: Optional[str] = None
    file_size: Optional[float] = None
    duration_seconds: Optional[float] = None
    status: AudioProcessingStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
