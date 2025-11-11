import types

import pytest

from app.models.audio import AudioSource
from app.models.enums import AudioProcessingStatus, ConspectVariantType
from app.models.generation import GenerationJob
from app.services.generation import GenerationService

try:  # pragma: no cover - optional dependency
    from google.api_core import exceptions as google_exceptions
except Exception:  # pragma: no cover
    google_exceptions = None


class _StubAI:
    model_name = "test-model"


def _make_service() -> GenerationService:
    return GenerationService(session_factory=lambda: None, ai_client=_StubAI())


def test_markdown_to_plain_strips_markdown_formatting() -> None:
    service = _make_service()
    markdown = "# Заголовок\n\n- **Пункт** один\n- Пункт *два*\n> Цитата"
    plain = service._markdown_to_plain(markdown, max_length=0)

    assert "Заголовок" in plain
    assert "Пункт один" in plain
    assert "Пункт два" in plain
    assert "Цитата" in plain
    assert "*" not in plain
    assert "#" not in plain


def test_local_conspect_builder_returns_requested_variants() -> None:
    service = _make_service()
    conspect = types.SimpleNamespace(title="Черновик")
    transcript = "Первое предложение. Второе предложение. Третье предложение."

    response = service._build_local_conspect(
        conspect,
        transcript,
        RuntimeError("stub"),
        audio_source=None,
        variants=[ConspectVariantType.FULL, ConspectVariantType.BRIEF],
    )

    assert response["mode"] == "offline"
    variants = response["variants"]
    assert ConspectVariantType.BRIEF.value in variants
    assert ConspectVariantType.FULL.value in variants
    assert ConspectVariantType.COMPRESSED.value not in variants

    brief = variants[ConspectVariantType.BRIEF.value]
    full = variants[ConspectVariantType.FULL.value]

    assert brief["markdown"]
    assert full["markdown"]
    assert brief["title"] == conspect.title
    assert full["title"] == conspect.title
    assert isinstance(brief.get("key_points", []), list)


class _StubSession:
    def __init__(self, job: GenerationJob, audio: AudioSource):
        self._store = {
            GenerationJob: {job.id: job},
            AudioSource: {audio.id: audio},
        }
        self.commits = 0

    def get(self, model, obj_id):
        return self._store.get(model, {}).get(obj_id)

    def commit(self) -> None:
        self.commits += 1


def test_mark_job_failed_keeps_pending_audio_status() -> None:
    service = _make_service()
    job = GenerationJob()
    job.id = 1
    job.audio_source_id = 5
    job.prompt = '{"mode": "create"}'
    job.conspect_id = None
    job.quiz_id = None

    audio = AudioSource()
    audio.id = 5
    audio.status = AudioProcessingStatus.PENDING

    session = _StubSession(job, audio)

    service._mark_job_failed(session, job_id=1, error="transient")

    assert audio.status == AudioProcessingStatus.PENDING


@pytest.mark.skipif(google_exceptions is None, reason="google.api_core is unavailable")
def test_is_transient_ai_failure_detects_service_unavailable() -> None:
    service = _make_service()
    exc = google_exceptions.ServiceUnavailable("overloaded")
    assert service._is_transient_ai_failure(exc)
