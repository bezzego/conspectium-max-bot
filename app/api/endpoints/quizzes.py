from sqlalchemy import and_, func
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.api import deps
from app.models.enums import QuizStatus
from app.models.quiz import Quiz, QuizAnswer, QuizQuestion, QuizResult
from app.models.user import User
from app.schemas.job import JobRead
from app.schemas.quiz import (
    QuizCreateFromConspectRequest,
    QuizListResponse,
    QuizManualCreateRequest,
    QuizRead,
    QuizResultCreate,
    QuizResultRead,
    QuizSummaryRead,
    QuizUpdateRequest,
)
from app.services.generation import generation_service
from app.services.sharing import (
    get_or_create_share_token_quiz,
    get_quiz_by_share_token,
)

router = APIRouter()


@router.post("/from-conspect", response_model=JobRead, status_code=status.HTTP_202_ACCEPTED)
def create_quiz_from_conspect(
    payload: QuizCreateFromConspectRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> JobRead:
    try:
        job = generation_service.create_quiz_job(db, user=user, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    background_tasks.add_task(generation_service.process_quiz_job, job.id)
    return JobRead.model_validate(job)


@router.get("", response_model=QuizListResponse)
def list_quizzes(
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> QuizListResponse:
    latest_subquery = (
        db.query(
            QuizResult.quiz_id,
            func.max(QuizResult.created_at).label("last_created"),
        )
        .filter(QuizResult.user_id == user.id)
        .group_by(QuizResult.quiz_id)
        .subquery()
    )

    latest_results = (
        db.query(QuizResult)
        .join(
            latest_subquery,
            and_(
                QuizResult.quiz_id == latest_subquery.c.quiz_id,
                QuizResult.created_at == latest_subquery.c.last_created,
            ),
        )
        .all()
    )
    latest_map = {result.quiz_id: result for result in latest_results}

    quizzes = (
        db.query(Quiz)
        .filter(Quiz.user_id == user.id)
        .order_by(Quiz.created_at.desc())
        .all()
    )
    items = []
    for quiz in quizzes:
        summary = QuizSummaryRead.model_validate(quiz)
        latest = latest_map.get(quiz.id)
        if latest:
            summary = summary.model_copy(
                update={"latest_result": QuizResultRead.model_validate(latest)}
            )
        items.append(summary)
    return QuizListResponse(items=items)


@router.get("/{quiz_id}", response_model=QuizRead)
def get_quiz(
    quiz_id: int,
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> QuizRead:
    quiz = (
        db.query(Quiz)
        .filter(Quiz.id == quiz_id, Quiz.user_id == user.id)
        .options(selectinload(Quiz.questions).selectinload(QuizQuestion.answers))
        .one_or_none()
    )
    if quiz is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тест не найден")
    result_rows = (
        db.query(QuizResult)
        .filter(QuizResult.quiz_id == quiz_id, QuizResult.user_id == user.id)
        .order_by(QuizResult.created_at.desc())
        .limit(20)
        .all()
    )
    result_models = [QuizResultRead.model_validate(row) for row in result_rows]
    latest_result = result_models[0] if result_models else None
    quiz_read = QuizRead.model_validate(quiz)
    return quiz_read.model_copy(
        update={
            "results": result_models,
            "latest_result": latest_result,
        }
    )


@router.patch("/{quiz_id}", response_model=QuizSummaryRead)
def update_quiz(
    quiz_id: int,
    payload: QuizUpdateRequest,
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> QuizSummaryRead:
    if payload.title is None and payload.description is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите новое название или описание",
        )

    quiz = (
        db.query(Quiz)
        .filter(Quiz.id == quiz_id, Quiz.user_id == user.id)
        .one_or_none()
    )
    if quiz is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тест не найден")

    if payload.title is not None:
        quiz.title = (payload.title or "").strip() or "Новый тест"
    if payload.description is not None:
        quiz.description = payload.description.strip() if payload.description else None

    db.add(quiz)
    db.commit()
    db.refresh(quiz)

    latest_result = (
        db.query(QuizResult)
        .filter(QuizResult.quiz_id == quiz.id, QuizResult.user_id == user.id)
        .order_by(QuizResult.created_at.desc())
        .first()
    )
    summary = QuizSummaryRead.model_validate(quiz)
    if latest_result:
        summary = summary.model_copy(
            update={"latest_result": QuizResultRead.model_validate(latest_result)}
        )
    return summary


@router.delete("/{quiz_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quiz(
    quiz_id: int,
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> None:
    quiz = (
        db.query(Quiz)
        .filter(Quiz.id == quiz_id, Quiz.user_id == user.id)
        .one_or_none()
    )
    if quiz is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тест не найден")

    db.delete(quiz)
    db.commit()


@router.post("/{quiz_id}/share-token", summary="Получить или создать токен для шаринга")
def get_share_token(
    quiz_id: int,
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> dict[str, str]:
    """Генерирует или возвращает существующий share_token для теста"""
    token = get_or_create_share_token_quiz(db, quiz_id, user.id)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Тест не найден"
        )
    return {"share_token": token}


@router.post("/{quiz_id}/publish-tournament", response_model=QuizSummaryRead, summary="Опубликовать тест в турнире")
def publish_to_tournament(
    quiz_id: int,
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> QuizSummaryRead:
    """Публикует тест в турнире (делает его доступным для других пользователей)"""
    quiz = (
        db.query(Quiz)
        .filter(Quiz.id == quiz_id, Quiz.user_id == user.id)
        .one_or_none()
    )
    if quiz is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тест не найден")
    
    if quiz.status != QuizStatus.READY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Тест еще не готов"
        )
    
    # Создаем share_token, если его еще нет
    if not quiz.share_token:
        from app.services.sharing import generate_share_token
        max_attempts = 10
        for _ in range(max_attempts):
            token = generate_share_token()
            existing = db.query(Quiz).filter(Quiz.share_token == token).first()
            if not existing:
                quiz.share_token = token
                break
    
    quiz.is_public_tournament = True
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    
    latest_result = (
        db.query(QuizResult)
        .filter(QuizResult.quiz_id == quiz.id, QuizResult.user_id == user.id)
        .order_by(QuizResult.created_at.desc())
        .first()
    )
    summary = QuizSummaryRead.model_validate(quiz)
    if latest_result:
        summary = summary.model_copy(
            update={"latest_result": QuizResultRead.model_validate(latest_result)}
        )
    return summary


@router.get("/share/{share_token}", response_model=QuizRead, summary="Получить тест по публичной ссылке")
def get_shared_quiz(
    share_token: str,
    db: Session = Depends(deps.get_db_session),
) -> QuizRead:
    """Получает тест по публичному токену (без авторизации)"""
    # Загружаем тест с вопросами и ответами
    quiz = (
        db.query(Quiz)
        .filter(Quiz.share_token == share_token)
        .options(selectinload(Quiz.questions).selectinload(QuizQuestion.answers))
        .one_or_none()
    )
    if not quiz:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Тест не найден"
        )
    if quiz.status != QuizStatus.READY:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Тест еще не готов"
        )
    
    quiz_read = QuizRead.model_validate(quiz)
    # Для публичных тестов не показываем результаты других пользователей
    return quiz_read.model_copy(update={"results": [], "latest_result": None})


@router.get("/tournament/public", response_model=QuizListResponse, summary="Список публичных тестов для турнира")
def list_public_tournament_quizzes(
    db: Session = Depends(deps.get_db_session),
    limit: int = 50,
    offset: int = 0,
) -> QuizListResponse:
    """Получает список публичных тестов для турнира"""
    from app.models.user import User
    
    try:
        # Загружаем тесты с пользователями и подсчитываем вопросы одним запросом
        quizzes_query = (
            db.query(
                Quiz,
                User.nickname.label('user_nickname'),
                User.avatar_url.label('user_avatar_url'),
                func.count(QuizQuestion.id).label('questions_count')
            )
            .join(User, Quiz.user_id == User.id)
            .outerjoin(QuizQuestion, QuizQuestion.quiz_id == Quiz.id)
            .filter(
                Quiz.is_public_tournament == True,  # noqa: E712
                Quiz.status == QuizStatus.READY,
            )
            .group_by(Quiz.id, User.nickname, User.avatar_url)
            .order_by(Quiz.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        
        items = []
        for quiz, user_nickname, user_avatar_url, questions_count in quizzes_query.all():
            quiz_dict = {
                "id": quiz.id,
                "user_id": quiz.user_id,
                "conspect_id": quiz.conspect_id,
                "title": quiz.title,
                "description": quiz.description,
                "status": quiz.status,
                "is_public_tournament": quiz.is_public_tournament,
                "created_at": quiz.created_at,
                "updated_at": quiz.updated_at,
                "latest_result": None,
                "user_nickname": user_nickname,
                "user_avatar_url": user_avatar_url,
                "questions_count": int(questions_count or 0),
            }
            try:
                validated_item = QuizSummaryRead.model_validate(quiz_dict)
                items.append(validated_item)
            except Exception as e:
                # Логируем ошибку валидации, но продолжаем обработку других элементов
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Error validating quiz {quiz.id}: {e}", exc_info=True)
                # Пропускаем этот элемент, если валидация не прошла
                continue
        
        return QuizListResponse(items=items)
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error in list_public_tournament_quizzes: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при загрузке турниров: {str(e)}"
        )


@router.get("/tournament/{quiz_id}", response_model=QuizRead, summary="Получить тест турнира")
def get_tournament_quiz(
    quiz_id: int,
    lobby_id: int,
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> QuizRead:
    """Получает тест для турнира (доступен участникам лобби)"""
    from app.models.tournament import TournamentLobby, TournamentParticipant
    
    # Проверяем, что пользователь является участником лобби
    participant = (
        db.query(TournamentParticipant)
        .filter(
            TournamentParticipant.lobby_id == lobby_id,
            TournamentParticipant.user_id == user.id,
        )
        .first()
    )
    
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вы не являетесь участником этого турнира"
        )
    
    # Проверяем, что лобби использует этот тест
    lobby = (
        db.query(TournamentLobby)
        .filter(TournamentLobby.id == lobby_id)
        .first()
    )
    
    if not lobby:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Лобби не найдено"
        )
    
    if lobby.quiz_id != quiz_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Тест не соответствует лобби"
        )
    
    # Загружаем тест (не проверяем владельца, так как это турнирный тест)
    quiz = (
        db.query(Quiz)
        .filter(Quiz.id == quiz_id)
        .options(selectinload(Quiz.questions).selectinload(QuizQuestion.answers))
        .one_or_none()
    )
    
    if quiz is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Тест не найден"
        )
    
    if quiz.status != QuizStatus.READY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Тест еще не готов"
        )
    
    # Загружаем результаты только текущего пользователя
    result_rows = (
        db.query(QuizResult)
        .filter(QuizResult.quiz_id == quiz_id, QuizResult.user_id == user.id)
        .order_by(QuizResult.created_at.desc())
        .limit(20)
        .all()
    )
    result_models = [QuizResultRead.model_validate(row) for row in result_rows]
    latest_result = result_models[0] if result_models else None
    
    quiz_read = QuizRead.model_validate(quiz)
    return quiz_read.model_copy(
        update={
            "results": result_models,
            "latest_result": latest_result,
        }
    )


@router.get("/tournament/public", response_model=QuizListResponse, summary="Список публичных тестов для турнира")
def list_public_tournament_quizzes(
    db: Session = Depends(deps.get_db_session),
    limit: int = 50,
    offset: int = 0,
) -> QuizListResponse:
    """Получает список публичных тестов для турнира"""
    from app.models.user import User
    
    try:
        # Загружаем тесты с пользователями и подсчитываем вопросы одним запросом
        quizzes_query = (
            db.query(
                Quiz,
                User.nickname.label('user_nickname'),
                User.avatar_url.label('user_avatar_url'),
                func.count(QuizQuestion.id).label('questions_count')
            )
            .join(User, Quiz.user_id == User.id)
            .outerjoin(QuizQuestion, QuizQuestion.quiz_id == Quiz.id)
            .filter(
                Quiz.is_public_tournament == True,  # noqa: E712
                Quiz.status == QuizStatus.READY,
            )
            .group_by(Quiz.id, User.nickname, User.avatar_url)
            .order_by(Quiz.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        
        items = []
        for quiz, user_nickname, user_avatar_url, questions_count in quizzes_query.all():
            quiz_dict = {
                "id": quiz.id,
                "user_id": quiz.user_id,
                "conspect_id": quiz.conspect_id,
                "title": quiz.title,
                "description": quiz.description,
                "status": quiz.status,
                "is_public_tournament": quiz.is_public_tournament,
                "created_at": quiz.created_at,
                "updated_at": quiz.updated_at,
                "latest_result": None,
                "user_nickname": user_nickname,
                "user_avatar_url": user_avatar_url,
                "questions_count": int(questions_count or 0),
            }
            try:
                validated_item = QuizSummaryRead.model_validate(quiz_dict)
                items.append(validated_item)
            except Exception as e:
                # Логируем ошибку валидации, но продолжаем обработку других элементов
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Error validating quiz {quiz.id}: {e}", exc_info=True)
                # Пропускаем этот элемент, если валидация не прошла
                continue
        
        return QuizListResponse(items=items)
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error in list_public_tournament_quizzes: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при загрузке турниров: {str(e)}"
        )


@router.post("/{quiz_id}/results", response_model=QuizResultRead, status_code=status.HTTP_201_CREATED)
def submit_quiz_result(
    quiz_id: int,
    payload: QuizResultCreate,
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> QuizResultRead:
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).one_or_none()
    if quiz is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тест не найден")

    # Если это турнирный тест, проверяем участие в лобби
    if payload.lobby_id:
        from app.models.tournament import TournamentLobby, TournamentParticipant, TournamentLobbyStatus
        from datetime import datetime
        
        participant = (
            db.query(TournamentParticipant)
            .filter(
                TournamentParticipant.lobby_id == payload.lobby_id,
                TournamentParticipant.user_id == user.id,
            )
            .first()
        )
        
        if not participant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Вы не являетесь участником этого турнира"
            )
        
        lobby = db.query(TournamentLobby).filter(TournamentLobby.id == payload.lobby_id).first()
        if not lobby or lobby.quiz_id != quiz_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Тест не соответствует лобби"
            )
        
        if lobby.status != TournamentLobbyStatus.STARTED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Турнир еще не начат"
            )

    answers = (
        db.query(QuizAnswer)
        .join(QuizQuestion, QuizQuestion.id == QuizAnswer.question_id)
        .filter(
            QuizQuestion.quiz_id == quiz_id,
            QuizAnswer.id.in_(payload.answers),
        )
        .all()
    )
    correct_answers = [answer for answer in answers if answer.is_correct]
    total_questions = (
        db.query(QuizQuestion).filter(QuizQuestion.quiz_id == quiz_id).count()
    )
    score = len(correct_answers) / total_questions if total_questions else 0

    result = QuizResult(
        quiz_id=quiz_id,
        user_id=user.id,
        score=round(score * 100, 2),
        total_questions=total_questions,
        answers_payload={"answers": payload.answers},
    )
    db.add(result)
    db.flush()
    
    # Если это турнирный тест, обновляем информацию об участнике
    if payload.lobby_id:
        from app.models.tournament import TournamentParticipant
        from datetime import datetime
        
        participant = (
            db.query(TournamentParticipant)
            .filter(
                TournamentParticipant.lobby_id == payload.lobby_id,
                TournamentParticipant.user_id == user.id,
            )
            .first()
        )
        
        if participant:
            participant.quiz_result_id = result.id
            participant.score = int(round(score * 100, 2))
            participant.finished_at = datetime.utcnow()
            # Время прохождения можно вычислить, если есть started_at в лобби
            if lobby and lobby.started_at:
                time_elapsed = (datetime.utcnow() - lobby.started_at).total_seconds()
                participant.time_seconds = int(time_elapsed)
            db.add(participant)
    
    db.commit()
    db.refresh(result)
    return QuizResultRead.model_validate(result)


@router.post("/manual", response_model=QuizRead, status_code=status.HTTP_201_CREATED)
def create_quiz_manual(
    payload: QuizManualCreateRequest,
    db: Session = Depends(deps.get_db_session),
    user: User = Depends(deps.get_current_user),
) -> QuizRead:
    if not payload.questions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Добавь хотя бы один вопрос")

    for idx, question in enumerate(payload.questions, start=1):
        if not question.answers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Добавь варианты ответа в вопросе №{idx}",
            )
        if not any(answer.is_correct for answer in question.answers):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Отметь правильный ответ в вопросе №{idx}",
            )

    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Название теста не может быть пустым")

    quiz = Quiz(
        user_id=user.id,
        title=title,
        description=payload.description.strip() if payload.description and payload.description.strip() else None,
        instructions=payload.instructions.strip() if payload.instructions and payload.instructions.strip() else None,
        status=QuizStatus.READY,
        model_used="manual",
        raw_response={"mode": "manual"},
    )
    db.add(quiz)
    db.flush()

    for position, question_payload in enumerate(payload.questions):
        question_title = question_payload.title.strip()
        if not question_title:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Текст вопроса №{position + 1} не может быть пустым",
            )
        explanation = (
            question_payload.explanation.strip()
            if question_payload.explanation and question_payload.explanation.strip()
            else None
        )
        question = QuizQuestion(
            quiz_id=quiz.id,
            user_id=user.id,
            title=question_title,
            explanation=explanation,
            position=position,
        )
        db.add(question)
        db.flush()

        for answer_position, answer_payload in enumerate(question_payload.answers):
            answer_text = answer_payload.text.strip()
            if not answer_text:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ответ №{answer_position + 1} в вопросе №{position + 1} не может быть пустым",
                )
            answer = QuizAnswer(
                question_id=question.id,
                user_id=user.id,
                text=answer_text,
                is_correct=answer_payload.is_correct,
                position=answer_position,
            )
            db.add(answer)

    db.commit()

    created_quiz = (
        db.query(Quiz)
        .filter(Quiz.id == quiz.id, Quiz.user_id == user.id)
        .options(selectinload(Quiz.questions).selectinload(QuizQuestion.answers))
        .one()
    )
    return QuizRead.model_validate(created_quiz)
