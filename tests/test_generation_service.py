import types

from app.models.enums import ConspectVariantType
from app.services.generation import GenerationService


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


def test_local_conspect_builder_returns_both_variants() -> None:
    service = _make_service()
    conspect = types.SimpleNamespace(title="Черновик")
    transcript = "Первое предложение. Второе предложение. Третье предложение."

    response = service._build_local_conspect(conspect, transcript, RuntimeError("stub"), audio_source=None)

    assert response["mode"] == "offline"
    variants = response["variants"]
    assert ConspectVariantType.COMPRESSED.value in variants
    assert ConspectVariantType.FULL.value in variants

    compressed = variants[ConspectVariantType.COMPRESSED.value]
    full = variants[ConspectVariantType.FULL.value]

    assert compressed["markdown"]
    assert full["markdown"]
    assert compressed["title"] == conspect.title
    assert full["title"] == conspect.title
    assert isinstance(compressed.get("key_points", []), list)
