from datetime import datetime

from sqlalchemy import Column, DateTime, Enum as SqlEnum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.models.base import Base
from app.models.enums import ConspectStatus, ConspectVariantType


class Conspect(Base):
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    audio_source_id = Column(
        Integer, ForeignKey("audiosource.id", ondelete="SET NULL"), nullable=True, index=True
    )

    title = Column(String(255), nullable=True)
    summary = Column(Text, nullable=True)
    compressed_markdown = Column(Text, nullable=True)
    brief_markdown = Column(Text, nullable=True)
    full_markdown = Column(Text, nullable=True)
    keywords = Column(JSONB, nullable=True)
    share_token = Column(String(64), nullable=True, unique=True, index=True)
    status = Column(
        SqlEnum(
            ConspectStatus,
            name="conspectstatus",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        default=ConspectStatus.DRAFT,
        nullable=False,
    )
    model_used = Column(String(255), nullable=True)
    input_prompt = Column(Text, nullable=True)
    raw_response = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    generated_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", backref="conspects")
    audio_source = relationship("AudioSource", back_populates="conspects")
    quizzes = relationship("Quiz", back_populates="conspect")

    @property
    def available_variants(self) -> list[ConspectVariantType]:
        variants: list[ConspectVariantType] = []
        if self.full_markdown:
            variants.append(ConspectVariantType.FULL)
        if self.brief_markdown:
            variants.append(ConspectVariantType.BRIEF)
        if self.compressed_markdown:
            variants.append(ConspectVariantType.COMPRESSED)
        return variants
