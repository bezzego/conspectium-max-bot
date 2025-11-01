from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.enums import GenerationJobStatus, GenerationJobType


class JobRead(BaseModel):
    id: int
    user_id: int
    job_type: GenerationJobType
    status: GenerationJobStatus
    conspect_id: Optional[int] = None
    quiz_id: Optional[int] = None
    audio_source_id: Optional[int] = None
    error: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
