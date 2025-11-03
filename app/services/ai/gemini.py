from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import google.generativeai as genai
from fastapi import HTTPException, status

from app.core.config import settings


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

    def generate_conspect(self, transcript: str) -> Dict[str, Any]:
        prompt = (
            "На основе расшифровки лекции создай структурированный конспект на русском языке. "
            "Сфокусируйся на кратком изложении ключевых идей и списке основных тезисов. "
            "Верни JSON вида: {"
            '"title": "строка", '
            '"summary": "3-4 абзаца по сути", '
            '"key_points": ["пул основных мыслей"]'
            "}"
        )
        return self._generate_json(prompt, contents=[{"text": transcript}])

    def generate_quiz(self, conspect_summary: str) -> Dict[str, Any]:
        prompt = (
            "Сформируй тест из 10 вопросов по следующему конспекту. "
            "Каждый вопрос должен иметь ровно четыре варианта ответа с полем is_correct. "
            "Не добавляй пояснений или подсказок. "
            "Верни JSON: {"
            '"title": "строка", '
            '"description": "строка", '
            '"questions": ['
            '{'
            '"question": "строка", '
            '"answers": ['
            '{"text": "строка", "is_correct": bool}'
            "]"
            "}"
            "]}"
        )
        return self._generate_json(prompt, contents=[{"text": conspect_summary}])


gemini_client = GeminiClient(settings.google_api_key, settings.google_model)
