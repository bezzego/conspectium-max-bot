from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Iterable, Sequence

from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.audio import AudioSource
from app.models.conspect import Conspect
from app.models.enums import (
    AudioProcessingStatus,
    ConspectStatus,
    ConspectVariantType,
    GenerationJobStatus,
    GenerationJobType,
    QuizStatus,
)
from app.models.generation import GenerationJob
from app.models.quiz import Quiz, QuizAnswer, QuizQuestion
from app.models.user import User
from app.schemas.conspect import ConspectCreateRequest
from app.schemas.quiz import QuizCreateFromConspectRequest
from app.services.ai.gemini import GeminiClient, gemini_client, gemini_text_client
from app.services.storage import audio_storage

try:  # pragma: no cover - optional dependency guard for better resilience
    from google.api_core import exceptions as google_exceptions
except Exception:  # pragma: no cover
    google_exceptions = None


class GenerationService:
    def __init__(
        self,
        session_factory: sessionmaker[Session],
        ai_client: GeminiClient,
        text_ai_client: GeminiClient | None = None,
    ) -> None:
        self.session_factory = session_factory
        self.ai_client = ai_client
        self.text_ai_client = text_ai_client or ai_client

    # Conspect pipeline -------------------------------------------------
    def create_conspect_job(
        self,
        db: Session,
        *,
        user: User,
        payload: ConspectCreateRequest,
    ) -> GenerationJob:
        if not payload.audio_source_id and not (payload.initial_summary and payload.initial_summary.strip()):
            raise ValueError('Укажи аудио-файл или текст для создания конспекта')

        variants = self._normalize_variants(payload.variants)
        audio_source_id: int | None = None
        if payload.audio_source_id is not None:
            audio_source = self._get_user_audio_source(db, user.id, payload.audio_source_id)
            audio_source_id = audio_source.id

        conspect = Conspect(
            user_id=user.id,
            audio_source_id=audio_source_id,
            title=payload.title,
            status=ConspectStatus.PROCESSING,
            input_prompt=payload.initial_summary,
        )
        db.add(conspect)
        db.flush()

        job = GenerationJob(
            user_id=user.id,
            job_type=GenerationJobType.CONSPECT,
            status=GenerationJobStatus.PENDING,
            conspect_id=conspect.id,
            audio_source_id=audio_source_id,
            prompt=json.dumps(
                {
                    "variants": [variant.value for variant in variants],
                    "mode": "create",
                }
            ),
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    def create_conspect_variant_job(
        self,
        db: Session,
        *,
        user: User,
        conspect_id: int,
        variant: ConspectVariantType,
    ) -> GenerationJob:
        conspect = db.get(Conspect, conspect_id)
        if not conspect or conspect.user_id != user.id:
            raise ValueError("Конспект не найден")
        if self._variant_exists(conspect, variant):
            raise ValueError("Этот вариант уже создан")

        job = GenerationJob(
            user_id=user.id,
            job_type=GenerationJobType.CONSPECT,
            status=GenerationJobStatus.PENDING,
            conspect_id=conspect.id,
            audio_source_id=conspect.audio_source_id,
            prompt=json.dumps(
                {
                    "variants": [variant.value],
                    "mode": "append",
                }
            ),
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    def process_conspect_job(self, job_id: int) -> None:
        session = self.session_factory()
        try:
            job = session.get(GenerationJob, job_id)
            if not job:
                return

            job.status = GenerationJobStatus.RUNNING
            job.started_at = datetime.utcnow()
            session.commit()

            conspect = session.get(Conspect, job.conspect_id)
            if not conspect:
                raise RuntimeError("Conspect not found for job")

            transcript_text = self._obtain_transcript(session, job)
            audio_source = session.get(AudioSource, job.audio_source_id) if job.audio_source_id else None
            variants, job_mode = self._job_execution_options(job)
            try:
                ai_client = self.ai_client if job.audio_source_id else self.text_ai_client
                variant_payloads: dict[str, dict] = {}
                for variant in variants:
                    variant_payloads[variant.value] = ai_client.generate_conspect_variant(transcript_text, variant)
                response = {"variants": variant_payloads, "mode": "online"}
            except Exception as exc:  # noqa: BLE001
                logging.exception("Conspect generation via AI failed: %s", exc)
                if settings.environment != "production":
                    response = self._build_local_conspect(conspect, transcript_text, exc, audio_source, variants)
                    variant_payloads = response.get("variants", {})
                else:
                    raise

            self._apply_variants_to_conspect(
                conspect,
                variant_payloads,
                allow_title_update=job_mode == "create",
            )
            self._refresh_conspect_summary(conspect, transcript_text)

            generation_mode = response.get("mode", "online")
            conspect.model_used = (
                (self.ai_client.model_name if job.audio_source_id else self.text_ai_client.model_name)
                if generation_mode != "offline"
                else "offline-fallback"
            )
            response_variants = variant_payloads
            existing_response = conspect.raw_response or {}
            combined_variants = dict(existing_response.get("variants") or {})
            combined_variants.update(response_variants)
            updated_response = {**existing_response, **response}
            updated_response["variants"] = combined_variants
            conspect.raw_response = updated_response
            if job_mode == "create":
                conspect.status = ConspectStatus.READY
                conspect.generated_at = datetime.utcnow()
            conspect.updated_at = datetime.utcnow()

            job.status = GenerationJobStatus.COMPLETED
            job.finished_at = datetime.utcnow()
            job.response_payload = updated_response

            session.commit()
        except Exception as exc:  # noqa: BLE001
            session.rollback()
            self._mark_job_failed(session, job_id, str(exc))
            raise
        finally:
            session.close()

    def _obtain_transcript(self, session: Session, job: GenerationJob) -> str:
        if job.audio_source_id is None:
            conspect = session.get(Conspect, job.conspect_id)
            if conspect and conspect.input_prompt:
                return conspect.input_prompt
            raise RuntimeError("No audio source or initial summary provided")

        audio_source = session.get(AudioSource, job.audio_source_id)
        if not audio_source:
            raise RuntimeError("Audio source not found")

        if audio_source.transcription:
            return audio_source.transcription

        if not audio_source.file_path:
            raise RuntimeError("Audio source does not have a file_path")

        audio_source.status = AudioProcessingStatus.PROCESSING
        session.commit()

        try:
            file_path = audio_storage.resolve_path(audio_source.file_path)
        except ValueError as exc:
            raise RuntimeError("Audio source path is invalid") from exc

        try:
            transcription_payload = self.ai_client.transcribe_audio(
                file_path,
                mime_type=audio_source.mime_type,
            )
        except Exception as exc:  # noqa: BLE001
            logging.exception("Audio transcription failed: %s", exc)
            if settings.environment != "production":
                fallback_transcript = (
                    "Аудио загружено, но транскрибация недоступна в офлайн-режиме."
                )
                audio_source.transcription = fallback_transcript
                audio_source.status = AudioProcessingStatus.READY
                audio_source.extra_metadata = {
                    "error": str(exc),
                    "note": "Gemini API недоступен, использован заглушечный текст",
                }
                session.commit()
                return fallback_transcript
            if self._is_transient_ai_failure(exc):
                audio_source.status = AudioProcessingStatus.PENDING
                metadata = audio_source.extra_metadata or {}
                metadata.update(
                    {
                        "transient_error": str(exc),
                        "transient_at": datetime.utcnow().isoformat(),
                    }
                )
                audio_source.extra_metadata = metadata
                session.commit()
                raise RuntimeError(
                    "Сервис распознавания перегружен. Повтори попытку через пару минут."
                ) from exc
            audio_source.status = AudioProcessingStatus.FAILED
            session.commit()
            raise RuntimeError(f"Ошибка распознавания аудио: {exc}") from exc
        transcript = transcription_payload.get("transcript")
        if not transcript:
            raise RuntimeError("Failed to obtain transcript from AI service")

        audio_source.transcription = transcript
        audio_source.status = AudioProcessingStatus.READY
        audio_source.extra_metadata = transcription_payload
        session.commit()

        return transcript

    # Quiz pipeline -----------------------------------------------------
    def create_quiz_job(
        self,
        db: Session,
        *,
        user: User,
        payload: QuizCreateFromConspectRequest,
    ) -> GenerationJob:
        conspect = db.get(Conspect, payload.conspect_id)
        if not conspect or conspect.user_id != user.id:
            raise ValueError("Конспект не найден")
        if conspect.status != ConspectStatus.READY:
            raise ValueError("Дождись завершения генерации конспекта")

        quiz = Quiz(
            user_id=user.id,
            conspect_id=conspect.id,
            status=QuizStatus.PROCESSING,
        )
        db.add(quiz)
        db.flush()

        job = GenerationJob(
            user_id=user.id,
            job_type=GenerationJobType.QUIZ,
            status=GenerationJobStatus.PENDING,
            conspect_id=conspect.id,
            quiz_id=quiz.id,
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    def process_quiz_job(self, job_id: int) -> None:
        session = self.session_factory()
        try:
            job = session.get(GenerationJob, job_id)
            if not job:
                return

            job.status = GenerationJobStatus.RUNNING
            job.started_at = datetime.utcnow()
            session.commit()

            conspect = session.get(Conspect, job.conspect_id)
            quiz = session.get(Quiz, job.quiz_id) if job.quiz_id else None
            if not conspect or not quiz:
                raise RuntimeError("Конспект или тест не найдены")

            if conspect.status != ConspectStatus.READY:
                raise RuntimeError("Конспект еще в обработке")

            try:
                ai_response = self.ai_client.generate_quiz(conspect.summary or "")
            except Exception as exc:  # noqa: BLE001
                logging.exception("Quiz generation via AI failed: %s", exc)
                if settings.environment != "production":
                    ai_response = self._build_local_quiz(conspect, exc)
                elif self._is_transient_ai_failure(exc):
                    raise RuntimeError(
                        "Сервис генерации тестов перегружен. Попробуй снова через минуту."
                    ) from exc
                else:
                    raise
            fallback_title = "Новый тест"
            if conspect.title:
                fallback_title = f"Тест по «{conspect.title}»"
            elif conspect.input_prompt:
                fallback_title = "Тест по конспекту"
            quiz.title = (ai_response.get("title") or fallback_title).strip() or "Новый тест"
            quiz.description = ai_response.get("description")
            quiz.instructions = ai_response.get("instructions")
            quiz.model_used = self.ai_client.model_name
            quiz.raw_response = ai_response

            questions_payload = ai_response.get("questions") or []
            self._populate_quiz_questions(session, quiz, questions_payload)

            quiz.status = QuizStatus.READY
            quiz.updated_at = datetime.utcnow()
            job.status = GenerationJobStatus.COMPLETED
            job.finished_at = datetime.utcnow()
            job.response_payload = ai_response

            session.commit()
        except Exception as exc:  # noqa: BLE001
            session.rollback()
            self._mark_job_failed(session, job_id, str(exc))
            raise
        finally:
            session.close()

    def _populate_quiz_questions(
        self,
        session: Session,
        quiz: Quiz,
        questions_payload: Sequence[dict],
    ) -> None:
        existing_questions: Iterable[QuizQuestion] = list(quiz.questions)
        for question in existing_questions:
            session.delete(question)
        session.flush()

        for idx, item in enumerate(questions_payload):
            question = QuizQuestion(
                quiz_id=quiz.id,
                title=item.get("question", f"Вопрос {idx + 1}"),
                explanation=item.get("explanation"),
                position=idx,
            )
            session.add(question)
            session.flush()

            answers = item.get("answers") or []
            for answer_idx, answer_payload in enumerate(answers):
                answer = QuizAnswer(
                    question_id=question.id,
                    text=answer_payload.get("text", ""),
                    is_correct=bool(answer_payload.get("is_correct")),
                    position=answer_idx,
                )
                session.add(answer)

    # Utility -----------------------------------------------------------
    def _normalize_variants(
        self,
        variants: Sequence[ConspectVariantType] | None,
    ) -> list[ConspectVariantType]:
        if not variants:
            return [ConspectVariantType.BRIEF]
        normalized: list[ConspectVariantType] = []
        seen: set[ConspectVariantType] = set()
        for variant in variants:
            if not isinstance(variant, ConspectVariantType):
                continue
            if variant in seen:
                continue
            seen.add(variant)
            normalized.append(variant)
        return normalized or [ConspectVariantType.BRIEF]

    def _get_user_audio_source(self, db: Session, user_id: int, audio_source_id: int) -> AudioSource:
        audio_source = db.get(AudioSource, audio_source_id)
        if not audio_source or audio_source.user_id != user_id:
            raise ValueError("Аудиофайл не найден")
        if audio_source.status == AudioProcessingStatus.FAILED:
            raise ValueError("Не удалось обработать аудио. Попробуй загрузить файл заново.")
        if not (audio_source.transcription or audio_source.file_path):
            raise ValueError("Аудиофайл ещё не готов к обработке")
        return audio_source

    def _variant_exists(self, conspect: Conspect, variant: ConspectVariantType) -> bool:
        if variant == ConspectVariantType.FULL:
            return bool(conspect.full_markdown)
        if variant == ConspectVariantType.BRIEF:
            return bool(conspect.brief_markdown)
        return bool(conspect.compressed_markdown)

    def _is_transient_ai_failure(self, exc: Exception) -> bool:
        if google_exceptions is None:
            return False
        transient_types: tuple[type[Exception], ...] = (
            google_exceptions.RetryError,
            google_exceptions.ServiceUnavailable,
            google_exceptions.DeadlineExceeded,
            google_exceptions.ResourceExhausted,
        )
        if isinstance(exc, transient_types):
            return True
        cause = exc.__cause__
        if cause and isinstance(cause, transient_types):
            return True
        return False

    def _job_execution_options(self, job: GenerationJob) -> tuple[list[ConspectVariantType], str]:
        options: dict[str, object] = {}
        if job.prompt:
            try:
                payload = json.loads(job.prompt)
                if isinstance(payload, dict):
                    options = payload
            except json.JSONDecodeError:
                options = {}

        variant_values = options.get("variants")
        variants: list[ConspectVariantType] = []
        if isinstance(variant_values, list):
            for value in variant_values:
                try:
                    variants.append(ConspectVariantType(value))
                except ValueError:
                    continue

        if not variants:
            variants = [ConspectVariantType.FULL, ConspectVariantType.COMPRESSED]

        raw_mode = options.get("mode")
        mode = raw_mode if isinstance(raw_mode, str) else "create"
        return variants, mode

    def _apply_variants_to_conspect(
        self,
        conspect: Conspect,
        variant_payloads: dict[str, dict],
        *,
        allow_title_update: bool,
    ) -> None:
        for variant_key, payload in variant_payloads.items():
            try:
                variant = ConspectVariantType(variant_key)
            except ValueError:
                continue

            markdown = (payload.get("markdown") or "").strip()
            if variant == ConspectVariantType.FULL:
                conspect.full_markdown = markdown or conspect.full_markdown
            elif variant == ConspectVariantType.BRIEF:
                conspect.brief_markdown = markdown or conspect.brief_markdown
            else:
                conspect.compressed_markdown = markdown or conspect.compressed_markdown

            title = (payload.get("title") or "").strip()
            if allow_title_update and title:
                conspect.title = title

            key_points = payload.get("key_points")
            if key_points:
                conspect.keywords = [
                    str(point) for point in key_points if str(point).strip()
                ] or conspect.keywords

    def _refresh_conspect_summary(self, conspect: Conspect, transcript_text: str | None) -> None:
        preferred_markdown = (
            conspect.brief_markdown
            or conspect.compressed_markdown
            or conspect.full_markdown
        )
        if preferred_markdown:
            conspect.summary = self._markdown_to_plain(preferred_markdown)
        elif transcript_text:
            conspect.summary = transcript_text[:200].strip()

    def _mark_job_failed(self, session: Session, job_id: int, error: str) -> None:
        job = session.get(GenerationJob, job_id)
        if not job:
            return
        _, job_mode = self._job_execution_options(job)
        job.status = GenerationJobStatus.FAILED
        job.error = error
        job.finished_at = datetime.utcnow()
        if job.conspect_id:
            conspect = session.get(Conspect, job.conspect_id)
            if conspect and job_mode == "create":
                conspect.status = ConspectStatus.FAILED
        if job.quiz_id:
            quiz = session.get(Quiz, job.quiz_id)
            if quiz:
                quiz.status = QuizStatus.FAILED
        if job.audio_source_id and job_mode == "create":
            audio_source = session.get(AudioSource, job.audio_source_id)
            if audio_source and audio_source.status != AudioProcessingStatus.PENDING:
                audio_source.status = AudioProcessingStatus.FAILED
        session.commit()

    def _markdown_to_plain(self, text: str, max_length: int = 400) -> str:
        if not text:
            return ""
        cleaned = re.sub(r"```.*?```", "", text, flags=re.S)
        cleaned = re.sub(r"`([^`]*)`", r"\1", cleaned)
        cleaned = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", cleaned)
        cleaned = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", cleaned)
        cleaned = re.sub(r"^#+\s*", "", cleaned, flags=re.M)
        cleaned = re.sub(r"[*_~`]", "", cleaned)
        cleaned = re.sub(r"^\s*[-*+]\s*", "", cleaned, flags=re.M)
        cleaned = re.sub(r"\s{2,}", " ", cleaned)
        cleaned = re.sub(r"\n{2,}", "\n", cleaned)
        cleaned = cleaned.strip()
        if max_length and len(cleaned) > max_length:
            truncated = cleaned[:max_length].rsplit(" ", 1)[0].strip()
            cleaned = f"{truncated}…"
        return cleaned

    def _build_local_conspect(
        self,
        conspect: Conspect,
        transcript: str,
        error: Exception,
        audio_source: AudioSource | None,
        variants: Sequence[ConspectVariantType],
    ) -> dict:
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", transcript) if s.strip()]
        title = conspect.title or (audio_source.original_filename if audio_source else "Черновик конспекта")

        if not sentences:
            summary = (
                "Не удалось автоматически расшифровать аудио. Воспользуйтесь текстовым полем, "
                "чтобы добавить конспект вручную, или попробуйте повторить загрузку позже."
            )
            key_points = [
                "Аудиозапись сохранена и будет доступна для повторной обработки.",
                f"Проблема: {error}",
                "Вы можете вставить текст лекции вручную на странице создания конспекта.",
            ]
        else:
            summary = " ".join(sentences[:5])
            key_points = sentences[5:10] or sentences[:5]
            key_points = [point[:200] for point in key_points if point]

        conspect_title = title if isinstance(title, str) else "Черновик конспекта"

        compressed_md_parts = [
            f"# {conspect_title}",
            "",
            "## Основные тезисы",
        ]
        if key_points:
            compressed_md_parts.extend(f"- {point}" for point in key_points)
        else:
            compressed_md_parts.append(summary)

        full_md_parts = [
            f"# {conspect_title}",
            "",
            "## Краткое содержание",
            summary,
        ]
        if key_points:
            full_md_parts.extend(["", "## Ключевые идеи"])
            full_md_parts.extend(f"- {point}" for point in key_points)

        variant_map: dict[str, dict] = {}
        effective_variants = list(variants) or [ConspectVariantType.BRIEF]
        for variant in effective_variants:
            if variant == ConspectVariantType.FULL:
                variant_map[variant.value] = {
                    "title": conspect_title,
                    "markdown": "\n".join(full_md_parts),
                    "key_points": key_points,
                }
            elif variant == ConspectVariantType.BRIEF:
                lines = [f"# {conspect_title}", ""]
                if key_points:
                    lines.extend(["## Главное", summary, "", "## Ключевые тезисы"])
                    lines.extend(f"- {point}" for point in key_points[:5])
                else:
                    lines.extend(["## Главное", summary])
                variant_map[variant.value] = {
                    "title": conspect_title,
                    "markdown": "\n".join(lines),
                    "key_points": key_points,
                }
            else:
                lines = [f"# {conspect_title}", "", "## Выжимка"]
                if key_points:
                    lines.extend(f"- {point}" for point in key_points[:5])
                else:
                    lines.append(summary)
                variant_map[variant.value] = {
                    "title": conspect_title,
                    "markdown": "\n".join(lines),
                    "key_points": key_points,
                }

        return {
            "variants": variant_map,
            "mode": "offline",
            "error": str(error),
        }

    def _build_local_quiz(self, conspect: Conspect, error: Exception) -> dict:
        points = conspect.keywords or []
        if not points and conspect.summary:
            points = [
                s.strip()
                for s in re.split(r"(?<=[.!?])\s+", conspect.summary)
                if s.strip()
            ]

        if not points:
            points = [
                "Конспект создан в офлайн-режиме. Проверьте содержание вручную.",
                "После повторной генерации появятся полноценные вопросы.",
            ]

        questions = []
        for idx, point in enumerate(points[:5], start=1):
            questions.append(
                {
                    "question": f"Верно ли утверждение: {point}",
                    "answers": [
                        {"text": "Да, верно", "is_correct": True},
                        {"text": "Нет, не упоминалось", "is_correct": False},
                        {"text": "Частично", "is_correct": False},
                        {"text": "Трудно сказать", "is_correct": False},
                    ],
                    "explanation": "Ответ отмечен как верный автоматически. Уточните детали вручную.",
                }
            )

        return {
            "title": conspect.title or "Черновой тест",
            "description": "Тест создан локально. После успешной генерации обновите вопросы.",
            "questions": questions,
            "mode": "offline",
            "error": str(error),
        }


generation_service = GenerationService(SessionLocal, gemini_client, text_ai_client=gemini_text_client)
