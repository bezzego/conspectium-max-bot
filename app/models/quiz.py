from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum as SqlEnum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.models.base import Base
from app.models.enums import QuizStatus


class Quiz(Base):
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    conspect_id = Column(
        Integer, ForeignKey("conspect.id", ondelete="SET NULL"), nullable=True, index=True
    )

    title = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    status = Column(
        SqlEnum(
            QuizStatus,
            name="quizstatus",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        default=QuizStatus.PROCESSING,
        nullable=False,
    )
    instructions = Column(Text, nullable=True)
    model_used = Column(String(255), nullable=True)
    raw_response = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    user = relationship("User", backref="quizzes")
    conspect = relationship("Conspect", back_populates="quizzes")
    questions = relationship("QuizQuestion", back_populates="quiz", cascade="all, delete-orphan")
    results = relationship(
        "QuizResult",
        back_populates="quiz",
        cascade="all, delete-orphan",
    )


class QuizQuestion(Base):
    id = Column(Integer, primary_key=True, autoincrement=True)
    quiz_id = Column(Integer, ForeignKey("quiz.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(Text, nullable=False)
    explanation = Column(Text, nullable=True)
    position = Column(Integer, nullable=False, default=0)

    quiz = relationship("Quiz", back_populates="questions")
    answers = relationship(
        "QuizAnswer", back_populates="question", cascade="all, delete-orphan", order_by="QuizAnswer.position"
    )
    user = relationship("User")


class QuizAnswer(Base):
    id = Column(Integer, primary_key=True, autoincrement=True)
    question_id = Column(
        Integer, ForeignKey("quizquestion.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    is_correct = Column(Boolean, nullable=False, default=False)
    position = Column(Integer, nullable=False, default=0)

    question = relationship("QuizQuestion", back_populates="answers")
    user = relationship("User")


class QuizResult(Base):
    id = Column(Integer, primary_key=True, autoincrement=True)
    quiz_id = Column(Integer, ForeignKey("quiz.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(Numeric(precision=5, scale=2), nullable=True)
    total_questions = Column(Integer, nullable=True)
    answers_payload = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    quiz = relationship(
        "Quiz",
        back_populates="results",
    )
    user = relationship("User")
