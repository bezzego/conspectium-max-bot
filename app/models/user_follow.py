from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import Base


class UserFollow(Base):
    """Модель для подписок пользователей друг на друга"""
    __tablename__ = "user_follow"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    follower_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    following_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    # Relationships
    follower = relationship("User", foreign_keys=[follower_id], backref="following")
    following_user = relationship("User", foreign_keys=[following_id], backref="followers")

    # Уникальный индекс на пару (follower_id, following_id)
    __table_args__ = (
        UniqueConstraint('follower_id', 'following_id', name='uq_user_follow'),
    )


