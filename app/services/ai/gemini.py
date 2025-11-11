from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import google.generativeai as genai
from fastapi import HTTPException, status

from app.core.config import settings
from app.models.enums import ConspectVariantType


class GeminiClient:
    def __init__(self, api_key: str, model_name: str) -> None:
        genai.configure(api_key=api_key)
        self.model_name = model_name
        self._model = genai.GenerativeModel(model_name)

    def _generate_json(self, prompt: str, contents: Optional[List[Any]] = None) -> Dict[str, Any]:
        generation_config = {
            "temperature": 0.3,
            "top_p": 0.9,
            "top_k": 32,
            "response_mime_type": "application/json",
        }
        parts: List[Any] = [{"text": prompt}]
        if contents:
            parts = contents + parts

        response = self._model.generate_content(parts, generation_config=generation_config)
        try:
            text = response.text if hasattr(response, "text") else response.candidates[0].content.parts[0].text
        except (AttributeError, IndexError) as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Gemini returned unexpected response",
            ) from exc

        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to decode Gemini JSON response",
            ) from exc

    def transcribe_audio(self, file_path: Path, mime_type: str | None = None) -> Dict[str, Any]:
        uploaded_file = genai.upload_file(
            path=str(file_path),
            mime_type=mime_type or "audio/mpeg",
        )
        prompt = (
            "Ты — внимательный транскрибер. Переведи аудиофайл в полный текст. "
            "Верни JSON: {\"transcript\": \"текст\", \"duration_sec\": число }"
        )
        return self._generate_json(prompt, contents=[uploaded_file])

    def _conspect_prompt(self, variant: ConspectVariantType) -> str:
        base_prompt = (
            "You will receive a text in Russian that was transcribed from audio.\n\n"
            "Your task: create a structured summary (конспект) of this text in Russian.\n\n"
            "Use Markdown formatting:\n"
            "- Include clear headings, subheadings, and bullet points\n"
            "- Divide content into logical sections (e.g., Introduction, Main Ideas, Key Points, Conclusion)\n"
            "- Add a final summary or conclusion\n\n"
            "Keep the tone clear, logical, and easy to read. The output should be ready for display in a chat interface."
        )
        if variant == ConspectVariantType.FULL:
            variant_prompt = (
                "Variant type: ФАКТИЧЕСКИЙ (full).\n"
                "Сохрани максимум деталей и всю фактическую канву выступления. Передавай аргументы, цифры, имена, "
                "хронологию и причинно-следственные связи. Каждый раздел должен включать вводный абзац и короткое "
                "подытоживание того, почему блок важен."
            )
        elif variant == ConspectVariantType.BRIEF:
            variant_prompt = (
                "Variant type: КРАТКИЙ (brief).\n"
                "Нужен баланс между деталями и ёмкостью. Собери основные тезисы и опиши ключевые выводы, разделяя текст "
                "на короткие абзацы и маркированные списки. Убирай второстепенные примеры, но оставляй связи между идеями."
            )
        else:
            variant_prompt = (
                "Variant type: СЖАТЫЙ (compressed).\n"
                "Сделай ультракороткую выжимку: 5–7 пунктов, каждый — одно предложение о факте/выводе. "
                "Не используй воду, не повторяйся, избегай длинных абзацев. Это шпаргалка для быстрого повтора."
            )
        format_prompt = (
            "Return a JSON object with the following structure:\n"
            '{\n'
            '  "title": "short descriptive title in Russian",\n'
            '  "markdown": "the full Markdown summary",\n'
            '  "key_points": ["list of 3-6 key bullet points in Russian"]\n'
            '}\n'
            "Ensure the JSON is valid and do not include any extra text outside of the JSON object."
        )
        return f"{base_prompt}\n\nVariant: {variant.value}.\n{variant_prompt}\n\n{format_prompt}"

    def generate_conspect_variant(
        self,
        transcript: str,
        variant: ConspectVariantType,
    ) -> Dict[str, Any]:
        prompt = self._conspect_prompt(variant)
        return self._generate_json(prompt, contents=[{"text": transcript}])

    def generate_conspect(self, transcript: str) -> Dict[str, Dict[str, Any]]:
        return {
            ConspectVariantType.FULL.value: self.generate_conspect_variant(transcript, ConspectVariantType.FULL),
            ConspectVariantType.COMPRESSED.value: self.generate_conspect_variant(
                transcript, ConspectVariantType.COMPRESSED
            ),
        }

    def generate_quiz(self, conspect_summary: str, questions_count: int = 5) -> Dict[str, Any]:
        prompt = (
            f"Сформируй тест из {questions_count} вопросов по следующему конспекту. "
            "Каждый вопрос должен иметь 4 варианта ответа, один из которых верный. "
            "Дополнительно добавь краткое объяснение для верного ответа. "
            "Верни JSON: {"
            '"title": "строка", '
            '"description": "строка", '
            '"questions": ['
            '{'
            '"question": "строка", '
            '"answers": ['
            '{"text": "строка", "is_correct": bool}'
            "], "
            '"explanation": "строка"'
            "}"
            "]}"
        )
        return self._generate_json(prompt, contents=[{"text": conspect_summary}])


gemini_client = GeminiClient(settings.google_api_key, settings.google_model)

if settings.google_api_key_text and settings.google_api_key_text != settings.google_api_key:
    gemini_text_client = GeminiClient(settings.google_api_key_text, settings.google_model)
else:
    gemini_text_client = gemini_client
