from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Boolean, Column, DateTime, Enum as SqlEnum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import Base


class TournamentLobbyStatus(PyEnum):
    WAITING = "waiting"
    STARTED = "started"
    FINISHED = "finished"
    CANCELLED = "cancelled"


class TournamentLobby(Base):
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    quiz_id = Column(Integer, ForeignKey("quiz.id", ondelete="CASCADE"), nullable=False, index=True)
    host_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    
    invite_code = Column(String(16), nullable=False, unique=True, index=True)
    max_participants = Column(Integer, nullable=False, default=8)
    
    status = Column(
        SqlEnum(
            TournamentLobbyStatus,
            name="tournamentlobbystatus",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        default=TournamentLobbyStatus.WAITING,
        nullable=False,
    )
    
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    
    quiz = relationship("Quiz", backref="tournament_lobbies")
    host = relationship("User", foreign_keys=[host_id], backref="hosted_lobbies")
    participants = relationship(
        "TournamentParticipant",
        back_populates="lobby",
        cascade="all, delete-orphan",
        order_by="TournamentParticipant.joined_at",
    )


class TournamentParticipant(Base):
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    lobby_id = Column(Integer, ForeignKey("tournamentlobby.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    
    is_ready = Column(Boolean, nullable=False, default=False)
    is_host = Column(Boolean, nullable=False, default=False)
    
    # Результаты прохождения теста
    quiz_result_id = Column(Integer, ForeignKey("quizresult.id", ondelete="SET NULL"), nullable=True)
    score = Column(Integer, nullable=True)  # Процент правильных ответов
    time_seconds = Column(Integer, nullable=True)  # Время прохождения в секундах
    place = Column(Integer, nullable=True)  # Место в турнире
    
    joined_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    
    lobby = relationship("TournamentLobby", back_populates="participants")
    user = relationship("User", backref="tournament_participations")
    quiz_result = relationship("QuizResult", foreign_keys=[quiz_result_id])


class MedalType(PyEnum):
    GOLD = "gold"  # 1 место
    SILVER = "silver"  # 2 место
    BRONZE = "bronze"  # 3 место
    PARTICIPANT = "participant"  # Участие в турнире
    WINNER = "winner"  # Победа в турнире
    PERFECT_SCORE = "perfect_score"  # 100% правильных ответов


class Medal(Base):
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    lobby_id = Column(Integer, ForeignKey("tournamentlobby.id", ondelete="SET NULL"), nullable=True, index=True)
    
    medal_type = Column(
        SqlEnum(
            MedalType,
            name="medaltype",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
    )
    
    description = Column(Text, nullable=True)  # Описание достижения
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    
    user = relationship("User", backref="medals")
    lobby = relationship("TournamentLobby", foreign_keys=[lobby_id])

