from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Column, DateTime, Integer, String, Boolean

from app.models.base import Base


class User(Base):
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    nickname = Column(String(50), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    first_name = Column(String(255), nullable=True)
    last_name = Column(String(255), nullable=True)
    language_code = Column(String(16), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default=sa.true())

    display_name = Column(String(255), nullable=True)
    gender = Column(String(32), nullable=True)
    avatar_id = Column(String(64), nullable=True)
    avatar_url = Column(String(1024), nullable=True)

    last_login_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # No unique constraint on telegram_id anymore — site authentication is independent
    # of Telegram. Email uniqueness is enforced by migrations when present.
