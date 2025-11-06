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
