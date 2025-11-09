"""Add 'upload' value to audiosourcetype enum"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "20251109_add_upload_to_audiosourcetype"
down_revision = "f6a1d7de590f"
depends_on = None


def upgrade():
    # Добавляем новое значение в ENUM
    op.execute("ALTER TYPE audiosourcetype ADD VALUE IF NOT EXISTS 'upload';")


def downgrade():
    # Откат ENUM невозможен напрямую — Postgres не позволяет удалить значение
    # Поэтому создаём новый ENUM без 'upload', пересоздаём колонку, копируем данные.
    # ВНИМАНИЕ: downgrade опасный и обычно не нужен, можно оставить pass
    pass