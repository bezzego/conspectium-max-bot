"""Initial Conspectium schema.

Revision ID: 20240606_0001
Revises: 
Create Date: 2024-06-06 00:01:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20240606_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    audiosourcetype = sa.Enum("upload", "telegram_voice", "external_url", name="audiosourcetype")

    audioprocessingstatus = sa.Enum(
        "pending", "processing", "ready", "failed", name="audioprocessingstatus"
    )

    conspectstatus = sa.Enum("draft", "processing", "ready", "failed", name="conspectstatus")

    quizstatus = sa.Enum("processing", "ready", "failed", name="quizstatus")

    generationjobtype = sa.Enum("transcription", "conspect", "quiz", name="generationjobtype")

    generationjobstatus = sa.Enum(
        "pending", "running", "completed", "failed", name="generationjobstatus"
    )

    op.create_table(
        "user",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False),
        sa.Column("username", sa.String(length=255), nullable=True),
        sa.Column("first_name", sa.String(length=255), nullable=True),
        sa.Column("last_name", sa.String(length=255), nullable=True),
        sa.Column("language_code", sa.String(length=16), nullable=True),
        sa.Column("photo_url", sa.String(length=1024), nullable=True),
        sa.Column(
            "last_login_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', CURRENT_TIMESTAMP)"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', CURRENT_TIMESTAMP)"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', CURRENT_TIMESTAMP)"),
        ),
        sa.UniqueConstraint("telegram_id", name="uq_users_telegram_id"),
    )
    op.create_index(op.f("ix_user_id"), "user", ["id"])
    op.create_index(op.f("ix_user_telegram_id"), "user", ["telegram_id"])

    op.create_table(
        "audiosource",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("source_type", audiosourcetype, nullable=False),
        sa.Column("original_filename", sa.String(length=512), nullable=True),
        sa.Column("mime_type", sa.String(length=128), nullable=True),
        sa.Column("file_path", sa.String(length=1024), nullable=True),
        sa.Column("file_size", sa.Numeric(precision=16, scale=2), nullable=True),
        sa.Column("duration_seconds", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("status", audioprocessingstatus, nullable=False, server_default="pending"),
        sa.Column("transcription", sa.Text(), nullable=True),
        sa.Column("extra_metadata", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', CURRENT_TIMESTAMP)"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', CURRENT_TIMESTAMP)"),
        ),
        sa.ForeignKeyConstraint(
            ("user_id",),
            ["user.id"],
            ondelete="SET NULL",
        ),
    )
    op.create_index(op.f("ix_audiosource_id"), "audiosource", ["id"])
    op.create_index(op.f("ix_audiosource_user_id"), "audiosource", ["user_id"])

    op.create_table(
        "conspect",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("audio_source_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("keywords", postgresql.JSONB(), nullable=True),
        sa.Column("status", conspectstatus, nullable=False, server_default="draft"),
        sa.Column("model_used", sa.String(length=255), nullable=True),
        sa.Column("input_prompt", sa.Text(), nullable=True),
        sa.Column("raw_response", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', CURRENT_TIMESTAMP)"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', CURRENT_TIMESTAMP)"),
        ),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ("audio_source_id",),
            ["audiosource.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ("user_id",),
            ["user.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index(op.f("ix_conspect_id"), "conspect", ["id"])
    op.create_index(op.f("ix_conspect_user_id"), "conspect", ["user_id"])
    op.create_index(op.f("ix_conspect_audio_source_id"), "conspect", ["audio_source_id"])

    op.create_table(
        "quiz",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("conspect_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", quizstatus, nullable=False, server_default="processing"),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column("model_used", sa.String(length=255), nullable=True),
        sa.Column("raw_response", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', CURRENT_TIMESTAMP)"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', CURRENT_TIMESTAMP)"),
        ),
        sa.ForeignKeyConstraint(
            ("conspect_id",),
            ["conspect.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ("user_id",),
            ["user.id"],
            ondelete="CASCADE",
        ),
    )
    op.create_index(op.f("ix_quiz_id"), "quiz", ["id"])
    op.create_index(op.f("ix_quiz_user_id"), "quiz", ["user_id"])
    op.create_index(op.f("ix_quiz_conspect_id"), "quiz", ["conspect_id"])

    op.create_table(
        "quizquestion",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("quiz_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(("quiz_id",), ["quiz.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_quizquestion_id"), "quizquestion", ["id"])
    op.create_index(op.f("ix_quizquestion_quiz_id"), "quizquestion", ["quiz_id"])

    op.create_table(
        "quizanswer",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(("question_id",), ["quizquestion.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_quizanswer_id"), "quizanswer", ["id"])
    op.create_index(op.f("ix_quizanswer_question_id"), "quizanswer", ["question_id"])

    op.create_table(
        "quizresult",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("quiz_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("score", sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column("total_questions", sa.Integer(), nullable=True),
        sa.Column("answers_payload", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', CURRENT_TIMESTAMP)"),
        ),
        sa.ForeignKeyConstraint(("quiz_id",), ["quiz.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(("user_id",), ["user.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_quizresult_id"), "quizresult", ["id"])
    op.create_index(op.f("ix_quizresult_quiz_id"), "quizresult", ["quiz_id"])
    op.create_index(op.f("ix_quizresult_user_id"), "quizresult", ["user_id"])

    op.create_table(
        "telegramsession",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_jti", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', CURRENT_TIMESTAMP)"),
        ),
        sa.Column(
            "expires_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "last_used_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', CURRENT_TIMESTAMP)"),
        ),
        sa.ForeignKeyConstraint(("user_id",), ["user.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("token_jti"),
    )
    op.create_index(op.f("ix_telegramsession_id"), "telegramsession", ["id"])
    op.create_index(op.f("ix_telegramsession_token_jti"), "telegramsession", ["token_jti"])
    op.create_index(op.f("ix_telegramsession_user_id"), "telegramsession", ["user_id"])

    op.create_table(
        "generationjob",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("job_type", generationjobtype, nullable=False),
        sa.Column("status", generationjobstatus, nullable=False, server_default="pending"),
        sa.Column("conspect_id", sa.Integer(), nullable=True),
        sa.Column("quiz_id", sa.Integer(), nullable=True),
        sa.Column("audio_source_id", sa.Integer(), nullable=True),
        sa.Column("prompt", sa.Text(), nullable=True),
        sa.Column("response_payload", postgresql.JSONB(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("timezone('utc', CURRENT_TIMESTAMP)"),
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(("audio_source_id",), ["audiosource.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(("conspect_id",), ["conspect.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(("quiz_id",), ["quiz.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(("user_id",), ["user.id"], ondelete="CASCADE"),
    )
    op.create_index(op.f("ix_generationjob_id"), "generationjob", ["id"])
    op.create_index(op.f("ix_generationjob_user_id"), "generationjob", ["user_id"])
    op.create_index(op.f("ix_generationjob_job_type"), "generationjob", ["job_type"])
    op.create_index(op.f("ix_generationjob_status"), "generationjob", ["status"])


def downgrade() -> None:
    op.drop_index(op.f("ix_generationjob_status"), table_name="generationjob")
    op.drop_index(op.f("ix_generationjob_job_type"), table_name="generationjob")
    op.drop_index(op.f("ix_generationjob_user_id"), table_name="generationjob")
    op.drop_index(op.f("ix_generationjob_id"), table_name="generationjob")
    op.drop_table("generationjob")

    op.drop_index(op.f("ix_telegramsession_user_id"), table_name="telegramsession")
    op.drop_index(op.f("ix_telegramsession_token_jti"), table_name="telegramsession")
    op.drop_index(op.f("ix_telegramsession_id"), table_name="telegramsession")
    op.drop_table("telegramsession")

    op.drop_index(op.f("ix_quizresult_user_id"), table_name="quizresult")
    op.drop_index(op.f("ix_quizresult_quiz_id"), table_name="quizresult")
    op.drop_index(op.f("ix_quizresult_id"), table_name="quizresult")
    op.drop_table("quizresult")

    op.drop_index(op.f("ix_quizanswer_question_id"), table_name="quizanswer")
    op.drop_index(op.f("ix_quizanswer_id"), table_name="quizanswer")
    op.drop_table("quizanswer")

    op.drop_index(op.f("ix_quizquestion_quiz_id"), table_name="quizquestion")
    op.drop_index(op.f("ix_quizquestion_id"), table_name="quizquestion")
    op.drop_table("quizquestion")

    op.drop_index(op.f("ix_quiz_conspect_id"), table_name="quiz")
    op.drop_index(op.f("ix_quiz_user_id"), table_name="quiz")
    op.drop_index(op.f("ix_quiz_id"), table_name="quiz")
    op.drop_table("quiz")

    op.drop_index(op.f("ix_conspect_audio_source_id"), table_name="conspect")
    op.drop_index(op.f("ix_conspect_user_id"), table_name="conspect")
    op.drop_index(op.f("ix_conspect_id"), table_name="conspect")
    op.drop_table("conspect")

    op.drop_index(op.f("ix_audiosource_user_id"), table_name="audiosource")
    op.drop_index(op.f("ix_audiosource_id"), table_name="audiosource")
    op.drop_table("audiosource")

    op.drop_index(op.f("ix_user_telegram_id"), table_name="user")
    op.drop_index(op.f("ix_user_id"), table_name="user")
    op.drop_table("user")

    sa.Enum(name="generationjobstatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="generationjobtype").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="quizstatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="conspectstatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="audioprocessingstatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="audiosourcetype").drop(op.get_bind(), checkfirst=True)
