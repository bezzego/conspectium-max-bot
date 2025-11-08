from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles

from app.models.base import Base
from app.models.quiz import Quiz, QuizResult
from app.models.user import User


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(element, compiler, **kw):  # pragma: no cover - sqlalchemy hook
    return "TEXT"


def test_deleting_quiz_removes_results() -> None:
    engine = create_engine("sqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(
            telegram_id=123456,
            username="tester",
            first_name="Test",
            last_name="User",
            last_login_at=datetime.utcnow(),
        )
        session.add(user)
        session.commit()

        quiz = Quiz(user_id=user.id, title="Sample quiz")
        session.add(quiz)
        session.commit()

        result = QuizResult(
            quiz_id=quiz.id,
            user_id=user.id,
            score=100,
            total_questions=5,
            answers_payload={"answers": [1]},
        )
        session.add(result)
        session.commit()

        session.delete(quiz)
        session.commit()

        remaining = session.query(QuizResult).count()

    assert remaining == 0
