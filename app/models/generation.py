from datetime import datetime

from sqlalchemy import Column, DateTime, Enum as SqlEnum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.models.base import Base
from app.models.enums import GenerationJobStatus, GenerationJobType


class GenerationJob(Base):
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    job_type = Column(
        SqlEnum(
            GenerationJobType,
            name="generationjobtype",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
    )
    status = Column(
        SqlEnum(
            GenerationJobStatus,
            name="generationjobstatus",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        default=GenerationJobStatus.PENDING,
        nullable=False,
    )
    conspect_id = Column(Integer, ForeignKey("conspect.id", ondelete="SET NULL"), nullable=True)
    quiz_id = Column(Integer, ForeignKey("quiz.id", ondelete="SET NULL"), nullable=True)
    audio_source_id = Column(
        Integer, ForeignKey("audiosource.id", ondelete="SET NULL"), nullable=True, index=True
    )
    prompt = Column(Text, nullable=True)
    response_payload = Column(JSONB, nullable=True)
    error = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User")
    conspect = relationship("Conspect")
    quiz = relationship("Quiz")
    audio_source = relationship("AudioSource")
