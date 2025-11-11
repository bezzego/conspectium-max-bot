import secrets
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.api import deps
from app.models.enums import QuizStatus
from app.models.quiz import Quiz
from app.models.tournament import Medal, MedalType, TournamentLobby, TournamentLobbyStatus, TournamentParticipant
from app.models.user import User
from app.schemas.tournament import (
    MedalRead,
    MedalStatsRead,
    TournamentLobbyCreateRequest,
    TournamentLobbyJoinRequest,
    TournamentLobbyRead,
    TournamentParticipantRead,
    TournamentParticipantUpdateRequest,
)

router = APIRouter()


def generate_invite_code() -> str:
    """Генерирует уникальный код приглашения"""
    return secrets.token_urlsafe(8)[:8].upper().replace('-', '').replace('_', '')


def _serialize_participant(participant: TournamentParticipant) -> TournamentParticipantRead:
    """Сериализует участника с информацией о пользователе"""
    data = TournamentParticipantRead.model_validate(participant)
    if participant.user:
        data.user_display_name = participant.user.display_name or participant.user.full_name or f"User {participant.user.id}"
        data.user_avatar_url = participant.user.avatar_url
    return data


def _serialize_lobby(lobby: TournamentLobby) -> TournamentLobbyRead:
    """Сериализует лобби с полной информацией"""
    data = TournamentLobbyRead.model_validate(lobby)
    
    # Информация о тесте
    if lobby.quiz:
        data.quiz_title = lobby.quiz.title
        if lobby.quiz.questions:
            data.quiz_questions_count = len(lobby.quiz.questions)
    
    # Участники
    participants = [_serialize_participant(p) for p in lobby.participants]
    data.participants = participants
    data.participants_count = len(participants)
    
    return data


@router.post("", response_model=TournamentLobbyRead, status_code=status.HTTP_201_CREATED)
def create_lobby(
    payload: TournamentLobbyCreateRequest,
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> TournamentLobbyRead:
    """Создает новое лобби для турнира"""
    # Проверяем, что тест существует и готов
    quiz = db.query(Quiz).filter(Quiz.id == payload.quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тест не найден")
    
    if quiz.status != QuizStatus.READY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Тест еще не готов"
        )
    
    # Генерируем уникальный код приглашения
    max_attempts = 10
    invite_code = None
    for _ in range(max_attempts):
        code = generate_invite_code()
        existing = db.query(TournamentLobby).filter(TournamentLobby.invite_code == code).first()
        if not existing:
            invite_code = code
            break
    
    if not invite_code:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось сгенерировать код приглашения"
        )
    
    # Создаем лобби
    lobby = TournamentLobby(
        quiz_id=payload.quiz_id,
        host_id=user.id,
        invite_code=invite_code,
        max_participants=payload.max_participants,
        status=TournamentLobbyStatus.WAITING,
    )
    db.add(lobby)
    db.flush()
    
    # Добавляем хоста как участника
    participant = TournamentParticipant(
        lobby_id=lobby.id,
        user_id=user.id,
        is_host=True,
        is_ready=False,
    )
    db.add(participant)
    db.commit()
    db.refresh(lobby)
    
    return _serialize_lobby(lobby)


@router.post("/join", response_model=TournamentLobbyRead)
def join_lobby(
    payload: TournamentLobbyJoinRequest,
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> TournamentLobbyRead:
    """Присоединяется к лобби по коду приглашения"""
    lobby = (
        db.query(TournamentLobby)
        .filter(TournamentLobby.invite_code == payload.invite_code.upper())
        .options(selectinload(TournamentLobby.participants).selectinload(TournamentParticipant.user))
        .options(selectinload(TournamentLobby.quiz))
        .first()
    )
    
    if not lobby:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Лобби не найдено")
    
    if lobby.status != TournamentLobbyStatus.WAITING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Лобби уже началось или завершено"
        )
    
    # Проверяем, не является ли пользователь уже участником
    existing = (
        db.query(TournamentParticipant)
        .filter(
            TournamentParticipant.lobby_id == lobby.id,
            TournamentParticipant.user_id == user.id,
        )
        .first()
    )
    if existing:
        return _serialize_lobby(lobby)
    
    # Проверяем лимит участников
    current_count = (
        db.query(func.count(TournamentParticipant.id))
        .filter(TournamentParticipant.lobby_id == lobby.id)
        .scalar()
    )
    if current_count >= lobby.max_participants:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Лобби переполнено"
        )
    
    # Добавляем участника
    participant = TournamentParticipant(
        lobby_id=lobby.id,
        user_id=user.id,
        is_host=False,
        is_ready=False,
    )
    db.add(participant)
    db.commit()
    db.refresh(lobby)
    
    return _serialize_lobby(lobby)


@router.get("/{lobby_id}", response_model=TournamentLobbyRead)
def get_lobby(
    lobby_id: int,
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> TournamentLobbyRead:
    """Получает информацию о лобби"""
    lobby = (
        db.query(TournamentLobby)
        .filter(TournamentLobby.id == lobby_id)
        .options(selectinload(TournamentLobby.participants).selectinload(TournamentParticipant.user))
        .options(selectinload(TournamentLobby.quiz))
        .first()
    )
    
    if not lobby:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Лобби не найдено")
    
    # Проверяем, является ли пользователь участником
    is_participant = (
        db.query(TournamentParticipant)
        .filter(
            TournamentParticipant.lobby_id == lobby_id,
            TournamentParticipant.user_id == user.id,
        )
        .first()
    )
    
    if not is_participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вы не являетесь участником этого лобби"
        )
    
    return _serialize_lobby(lobby)


@router.get("/invite/{invite_code}", response_model=TournamentLobbyRead)
def get_lobby_by_invite_code(
    invite_code: str,
    db: Session = Depends(deps.get_db_session),
) -> TournamentLobbyRead:
    """Получает информацию о лобби по коду приглашения (публичный endpoint)"""
    lobby = (
        db.query(TournamentLobby)
        .filter(TournamentLobby.invite_code == invite_code.upper())
        .options(selectinload(TournamentLobby.participants).selectinload(TournamentParticipant.user))
        .options(selectinload(TournamentLobby.quiz))
        .first()
    )
    
    if not lobby:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Лобби не найдено")
    
    return _serialize_lobby(lobby)


@router.patch("/{lobby_id}/participants/me", response_model=TournamentParticipantRead)
def update_participant_status(
    lobby_id: int,
    payload: TournamentParticipantUpdateRequest,
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> TournamentParticipantRead:
    """Обновляет статус готовности участника"""
    participant = (
        db.query(TournamentParticipant)
        .filter(
            TournamentParticipant.lobby_id == lobby_id,
            TournamentParticipant.user_id == user.id,
        )
        .first()
    )
    
    if not participant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Участник не найден")
    
    if payload.is_ready is not None:
        participant.is_ready = payload.is_ready
    
    db.commit()
    db.refresh(participant)
    
    return _serialize_participant(participant)


@router.post("/{lobby_id}/start", response_model=TournamentLobbyRead)
def start_lobby(
    lobby_id: int,
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> TournamentLobbyRead:
    """Запускает турнир (только хост)"""
    lobby = (
        db.query(TournamentLobby)
        .filter(TournamentLobby.id == lobby_id)
        .options(selectinload(TournamentLobby.participants).selectinload(TournamentParticipant.user))
        .options(selectinload(TournamentLobby.quiz))
        .first()
    )
    
    if not lobby:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Лобби не найдено")
    
    if lobby.host_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только хост может запустить турнир"
        )
    
    if lobby.status != TournamentLobbyStatus.WAITING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Турнир уже начат или завершен"
        )
    
    from datetime import datetime
    lobby.status = TournamentLobbyStatus.STARTED
    lobby.started_at = datetime.utcnow()
    db.commit()
    db.refresh(lobby)
    
    return _serialize_lobby(lobby)


@router.get("/medals/me", response_model=MedalStatsRead)
def get_my_medals(
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> MedalStatsRead:
    """Получает статистику медалей текущего пользователя"""
    medals = db.query(Medal).filter(Medal.user_id == user.id).all()
    
    stats = MedalStatsRead(
        total_medals=len(medals),
        gold_count=sum(1 for m in medals if m.medal_type == MedalType.GOLD),
        silver_count=sum(1 for m in medals if m.medal_type == MedalType.SILVER),
        bronze_count=sum(1 for m in medals if m.medal_type == MedalType.BRONZE),
        winner_count=sum(1 for m in medals if m.medal_type == MedalType.WINNER),
        perfect_score_count=sum(1 for m in medals if m.medal_type == MedalType.PERFECT_SCORE),
        participant_count=sum(1 for m in medals if m.medal_type == MedalType.PARTICIPANT),
    )
    
    return stats


@router.get("/medals/me/list", response_model=List[MedalRead])
def list_my_medals(
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
    limit: int = 50,
    offset: int = 0,
) -> List[MedalRead]:
    """Получает список медалей текущего пользователя"""
    medals = (
        db.query(Medal)
        .filter(Medal.user_id == user.id)
        .order_by(Medal.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    
    return [MedalRead.model_validate(medal) for medal in medals]

