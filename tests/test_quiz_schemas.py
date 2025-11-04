from datetime import datetime, timezone

from app.schemas.quiz import QuizListResponse, QuizSummaryRead, QuizUpdateRequest


def _sample_summary(**overrides):
    payload = {
        "id": 1,
        "user_id": 42,
        "conspect_id": 10,
        "title": "Новый тест",
        "description": "Описание",
        "status": "ready",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    payload.update(overrides)
    return payload


def test_quiz_summary_read_builds_from_dict() -> None:
    summary = QuizSummaryRead.model_validate(_sample_summary(title=None))
    assert summary.id == 1
    assert summary.title is None
    assert summary.status == "ready"


def test_quiz_list_response_accepts_summaries() -> None:
    payload = [_sample_summary(id=idx) for idx in range(1, 4)]
    response = QuizListResponse.model_validate({"items": payload})
    assert len(response.items) == 3
    assert response.items[0].id == 1


def test_quiz_update_request_allows_optional_fields() -> None:
    request = QuizUpdateRequest(title=" Новое имя ", description=None)
    assert request.title == " Новое имя "
    assert request.description is None
