from __future__ import annotations

import secrets
from datetime import datetime, timedelta
from typing import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.session import TelegramSession
from app.models.user import User
from app.services.security import token_service


auth_scheme = HTTPBearer(auto_error=False)


def get_db_session() -> Generator[Session, None, None]:
    yield from get_db()


def get_current_user(
    db: Session = Depends(get_db_session),
    credentials: HTTPAuthorizationCredentials | None = Depends(auth_scheme),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing credentials")

    payload = token_service.decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    jti = payload.get("jti")
    if not jti:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token")

    session = (
        db.query(TelegramSession)
        .filter(TelegramSession.token_jti == jti, TelegramSession.expires_at > datetime.utcnow())
        .one_or_none()
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    session.last_used_at = datetime.utcnow()
    db.add(session)
    db.commit()

    user = db.get(User, int(user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return user


def create_session(db: Session, user: User, expire_minutes: int) -> TelegramSession:
    token_jti = secrets.token_hex(16)
    session = TelegramSession(
        user_id=user.id,
        token_jti=token_jti,
        created_at=datetime.utcnow(),
        last_used_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(minutes=expire_minutes),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session
