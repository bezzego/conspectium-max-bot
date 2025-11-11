"""Сервис для генерации токенов шаринга"""
import secrets
from typing import Optional

from sqlalchemy.orm import Session

from app.models.conspect import Conspect
from app.models.quiz import Quiz


def generate_share_token() -> str:
    """Генерирует уникальный токен для шаринга"""
    return secrets.token_urlsafe(32)[:64]


def get_or_create_share_token_conspect(db: Session, conspect_id: int, user_id: int) -> Optional[str]:
    """Получает или создает share_token для конспекта"""
    conspect = db.query(Conspect).filter(
        Conspect.id == conspect_id,
        Conspect.user_id == user_id
    ).first()
    
    if not conspect:
        return None
    
    if not conspect.share_token:
        # Генерируем уникальный токен
        max_attempts = 10
        for _ in range(max_attempts):
            token = generate_share_token()
            existing = db.query(Conspect).filter(Conspect.share_token == token).first()
            if not existing:
                conspect.share_token = token
                db.commit()
                return token
        return None
    
    return conspect.share_token


def get_or_create_share_token_quiz(db: Session, quiz_id: int, user_id: int) -> Optional[str]:
    """Получает или создает share_token для теста"""
    quiz = db.query(Quiz).filter(
        Quiz.id == quiz_id,
        Quiz.user_id == user_id
    ).first()
    
    if not quiz:
        return None
    
    if not quiz.share_token:
        # Генерируем уникальный токен
        max_attempts = 10
        for _ in range(max_attempts):
            token = generate_share_token()
            existing = db.query(Quiz).filter(Quiz.share_token == token).first()
            if not existing:
                quiz.share_token = token
                db.commit()
                return token
        return None
    
    return quiz.share_token


def get_conspect_by_share_token(db: Session, share_token: str) -> Optional[Conspect]:
    """Получает конспект по share_token"""
    return db.query(Conspect).filter(Conspect.share_token == share_token).first()


def get_quiz_by_share_token(db: Session, share_token: str) -> Optional[Quiz]:
    """Получает тест по share_token"""
    return db.query(Quiz).filter(Quiz.share_token == share_token).first()

