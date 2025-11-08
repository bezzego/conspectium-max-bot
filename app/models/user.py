from datetime import datetime

from sqlalchemy import BigInteger, Column, DateTime, Integer, String, UniqueConstraint

from app.models.base import Base


class User(Base):
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    telegram_id = Column(BigInteger, unique=True, nullable=False, index=True)
    username = Column(String(255), nullable=True)
    first_name = Column(String(255), nullable=True)
    last_name = Column(String(255), nullable=True)
    language_code = Column(String(16), nullable=True)
    photo_url = Column(String(1024), nullable=True)

    display_name = Column(String(255), nullable=True)
    gender = Column(String(32), nullable=True)
    avatar_id = Column(String(64), nullable=True)
    avatar_url = Column(String(1024), nullable=True)

    last_login_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    __table_args__ = (UniqueConstraint("telegram_id", name="uq_users_telegram_id"),)
