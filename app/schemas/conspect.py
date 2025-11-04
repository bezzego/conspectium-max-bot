from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ConspectStatus


class ConspectBase(BaseModel):
    id: int
    user_id: int
    title: Optional[str] = None
    summary: Optional[str] = None
    compressed_markdown: Optional[str] = None
    full_markdown: Optional[str] = None
    keywords: Optional[List[str]] = None
    status: ConspectStatus
    model_used: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    generated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ConspectRead(ConspectBase):
    audio_source_id: Optional[int] = None


class ConspectCreateRequest(BaseModel):
    audio_source_id: Optional[int] = Field(default=None, description="ID загруженного аудио")
    title: Optional[str] = Field(default=None, description="Название для будущего конспекта")
    initial_summary: Optional[str] = Field(default=None, description="Текст вместо аудиофайла")


class ConspectListResponse(BaseModel):
    items: List[ConspectRead]
