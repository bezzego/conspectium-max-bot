"""rework auth and user isolation

Revision ID: f6a1d7de590f
Revises: 20240610_0003
Create Date: 2025-11-09 12:57:23.434221
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from passlib.context import CryptContext


# revision identifiers, used by Alembic.
revision = "f6a1d7de590f"
down_revision = "20240610_0003"
branch_labels = None
depends_on = None

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def upgrade() -> None:
    conn = op.get_bind()

    # --- User table adjustments ---
    op.add_column("user", sa.Column("email", sa.String(length=255), nullable=True))
    op.add_column("user", sa.Column("password_hash", sa.String(length=255), nullable=True))
    op.add_column("user", sa.Column("full_name", sa.String(length=255), nullable=True))
    op.add_column(
        "user",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    user_table = sa.table(
        "user",
        sa.column("id", sa.Integer()),
        sa.column("email", sa.String()),
        sa.column("password_hash", sa.String()),
        sa.column("full_name", sa.String()),
        sa.column("display_name", sa.String()),
        sa.column("first_name", sa.String()),
        sa.column("last_name", sa.String()),
        sa.column("username", sa.String()),
        sa.column("telegram_id", sa.BigInteger()),
    )

    users = conn.execute(
        sa.select(
            user_table.c.id,
            user_table.c.email,
            user_table.c.password_hash,
            user_table.c.full_name,
            user_table.c.display_name,
            user_table.c.first_name,
            user_table.c.last_name,
            user_table.c.username,
            user_table.c.telegram_id,
        )
    ).fetchall()
    default_hash = "$2b$12$fNQ7Hc85/Q9hBsXqv4R5beP2KFyKXqQ9LPe1YnGHJog20xrUuQS7."
    for row in users:
        fallback_token = row.telegram_id or row.id
        suggested_email = (row.username or "").strip().lower()
        if not suggested_email:
            suggested_email = f"user{fallback_token}@conspectium.local"
        elif "@" not in suggested_email:
            suggested_email = f"{suggested_email}@conspectium.local"
        full_name = (row.display_name or row.first_name or row.last_name or "").strip()
        if not full_name:
            full_name = f"User {row.id}"

        conn.execute(
            user_table.update()
            .where(user_table.c.id == row.id)
            .values(
                email=suggested_email,
                password_hash=default_hash,
                full_name=full_name,
                display_name=row.display_name or full_name,
                is_active=True,
            )
        )

    op.alter_column("user", "email", existing_type=sa.String(length=255), nullable=False)
    op.alter_column(
        "user",
        "password_hash",
        existing_type=sa.String(length=255),
        nullable=False,
    )
    op.alter_column(
        "user",
        "full_name",
        existing_type=sa.String(length=255),
        nullable=False,
    )
    op.alter_column(
        "user",
        "is_active",
        existing_type=sa.Boolean(),
        nullable=False,
        server_default=None,
    )

    op.create_unique_constraint("uq_users_email", "user", ["email"])
    op.drop_constraint("uq_users_telegram_id", "user", type_="unique")
    op.drop_index("ix_user_telegram_id", table_name="user")
    op.drop_column("user", "photo_url")
    op.drop_column("user", "language_code")
    op.drop_column("user", "last_name")
    op.drop_column("user", "first_name")
    op.drop_column("user", "username")
    op.drop_column("user", "telegram_id")

    # --- Replace telegramsession with user_session ---
    op.drop_table("telegramsession")
    op.create_table(
        "user_session",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("user.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_jti", sa.String(length=64), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(op.f("ix_user_session_id"), "user_session", ["id"])
    op.create_index(op.f("ix_user_session_user_id"), "user_session", ["user_id"])

    # --- AudioSource ownership ---
    op.execute(
        """
        UPDATE audiosource
        SET user_id = (
            SELECT id FROM "user" ORDER BY id LIMIT 1
        )
        WHERE user_id IS NULL
        """
    )
    op.alter_column("audiosource", "user_id", existing_type=sa.Integer(), nullable=False)
    op.drop_constraint("audiosource_user_id_fkey", "audiosource", type_="foreignkey")
    op.create_foreign_key(
        "fk_audiosource_user_id",
        "audiosource",
        "user",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # --- Quiz question/answer ownership ---
    op.add_column("quizquestion", sa.Column("user_id", sa.Integer(), nullable=True))
    op.add_column("quizanswer", sa.Column("user_id", sa.Integer(), nullable=True))
    op.execute(
        """
        UPDATE quizquestion qq
        SET user_id = quiz.user_id
        FROM quiz
        WHERE qq.quiz_id = quiz.id
        """
    )
    op.execute(
        """
        UPDATE quizanswer qa
        SET user_id = qq.user_id
        FROM quizquestion qq
        WHERE qa.question_id = qq.id
        """
    )
    op.alter_column("quizquestion", "user_id", existing_type=sa.Integer(), nullable=False)
    op.alter_column("quizanswer", "user_id", existing_type=sa.Integer(), nullable=False)
    op.create_index(op.f("ix_quizquestion_user_id"), "quizquestion", ["user_id"])
    op.create_index(op.f("ix_quizanswer_user_id"), "quizanswer", ["user_id"])
    op.create_foreign_key(
        "fk_quizquestion_user_id",
        "quizquestion",
        "user",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_quizanswer_user_id",
        "quizanswer",
        "user",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # --- Remove legacy enum value by recreating ENUM (PostgreSQL does not support DROP VALUE) ---
    op.execute("ALTER TYPE audiosourcetype RENAME TO audiosourcetype_old")

    op.execute("""
    CREATE TYPE audiosourcetype AS ENUM (
        'uploaded',
        'microphone'
    )
    """)

    op.execute("""
    ALTER TABLE audiosource
    ALTER COLUMN source_type
    TYPE audiosourcetype
    USING source_type::text::audiosourcetype
    """)

    op.execute("DROP TYPE audiosourcetype_old")


def downgrade() -> None:
    # Downgrade not fully supported due to irreversible auth migration
    raise RuntimeError("Downgrading this migration is not supported.")
