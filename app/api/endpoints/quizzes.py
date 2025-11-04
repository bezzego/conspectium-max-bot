from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.api import deps
from app.models.quiz import Quiz, QuizAnswer, QuizQuestion, QuizResult
from app.models.user import User
from app.schemas.job import JobRead
from app.schemas.quiz import (
    QuizCreateFromConspectRequest,
    QuizListResponse,
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
    quizzes = (
        db.query(Quiz)
        .filter(Quiz.user_id == user.id)
        .order_by(Quiz.created_at.desc())
        .all()
    )
    return QuizListResponse(items=[QuizSummaryRead.model_validate(q) for q in quizzes])


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
    return QuizRead.model_validate(quiz)


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
    return QuizSummaryRead.model_validate(quiz)


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
