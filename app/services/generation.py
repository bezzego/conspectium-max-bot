from __future__ import annotations

import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Iterable, Sequence

from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.audio import AudioSource
from app.models.conspect import Conspect
from app.models.enums import (
    AudioProcessingStatus,
    ConspectStatus,
    GenerationJobStatus,
    GenerationJobType,
    QuizStatus,
)
from app.models.generation import GenerationJob
from app.models.quiz import Quiz, QuizAnswer, QuizQuestion
from app.models.user import User
from app.schemas.conspect import ConspectCreateRequest
from app.schemas.quiz import QuizCreateFromConspectRequest
from app.services.ai.gemini import GeminiClient, gemini_client
from app.services.storage import audio_storage


class GenerationService:
    def __init__(self, session_factory: sessionmaker[Session], ai_client: GeminiClient) -> None:
        self.session_factory = session_factory
        self.ai_client = ai_client

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

        conspect = Conspect(
            user_id=user.id,
            audio_source_id=payload.audio_source_id,
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
            audio_source_id=payload.audio_source_id,
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
            try:
                response = self.ai_client.generate_conspect(transcript_text)
            except Exception as exc:  # noqa: BLE001
                logging.exception("Conspect generation via AI failed: %s", exc)
                if settings.environment != "production":
                    response = self._build_local_conspect(conspect, transcript_text, exc, audio_source)
                else:
                    raise

            conspect.summary = response.get("summary")
            conspect.title = response.get("title") or conspect.title or "Конспект"
            conspect.keywords = response.get("key_points")
            conspect.model_used = self.ai_client.model_name
            conspect.raw_response = response
            conspect.status = ConspectStatus.READY
            conspect.generated_at = datetime.utcnow()
            conspect.updated_at = datetime.utcnow()

            job.status = GenerationJobStatus.COMPLETED
            job.finished_at = datetime.utcnow()
            job.response_payload = response

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

        file_path = Path(audio_source.file_path)
        if not file_path.is_absolute():
            file_path = audio_storage.base_dir / file_path

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
                else:
                    raise
            quiz.title = ai_response.get("title") or f"Тест по '{conspect.title or 'конспекту'}'"
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
    def _mark_job_failed(self, session: Session, job_id: int, error: str) -> None:
        job = session.get(GenerationJob, job_id)
        if not job:
            return
        job.status = GenerationJobStatus.FAILED
        job.error = error
        job.finished_at = datetime.utcnow()
        if job.conspect_id:
            conspect = session.get(Conspect, job.conspect_id)
            if conspect:
                conspect.status = ConspectStatus.FAILED
        if job.quiz_id:
            quiz = session.get(Quiz, job.quiz_id)
            if quiz:
                quiz.status = QuizStatus.FAILED
        if job.audio_source_id:
            audio_source = session.get(AudioSource, job.audio_source_id)
            if audio_source:
                audio_source.status = AudioProcessingStatus.FAILED
        session.commit()

    def _build_local_conspect(
        self,
        conspect: Conspect,
        transcript: str,
        error: Exception,
        audio_source: AudioSource | None,
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
                "Проблема: " + str(error),
                "Вы можете вставить текст лекции вручную на странице создания конспекта.",
            ]
        else:
            summary = " ".join(sentences[:3])
            key_points = sentences[3:8] or sentences[:3]
            key_points = [point[:200] for point in key_points if point]

        conspect_title = title if isinstance(title, str) else "Черновик конспекта"
        return {
            "title": conspect_title,
            "summary": summary,
            "key_points": key_points,
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


generation_service = GenerationService(SessionLocal, gemini_client)
