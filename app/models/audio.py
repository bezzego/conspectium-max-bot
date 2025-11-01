from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, Enum as SqlEnum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.models.base import Base
from app.models.enums import AudioProcessingStatus, AudioSourceType


class AudioSource(Base):
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True, index=True)
    source_type = Column(
        SqlEnum(
            AudioSourceType,
            name="audiosourcetype",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
    )
    original_filename = Column(String(512), nullable=True)
    mime_type = Column(String(128), nullable=True)
    file_path = Column(String(1024), nullable=True)
    file_size = Column(Numeric(precision=16, scale=2), nullable=True)
    duration_seconds = Column(Numeric(precision=8, scale=2), nullable=True)
    status = Column(
        SqlEnum(
            AudioProcessingStatus,
            name="audioprocessingstatus",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        default=AudioProcessingStatus.PENDING,
        nullable=False,
    )
    transcription = Column(Text, nullable=True)
    extra_metadata = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    user = relationship("User", backref="audio_sources")
    conspects = relationship("Conspect", back_populates="audio_source")

    @property
    def is_ready(self) -> bool:
        return self.status == AudioProcessingStatus.READY
