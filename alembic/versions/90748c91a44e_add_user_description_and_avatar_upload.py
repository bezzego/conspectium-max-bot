"""add_user_description_and_avatar_upload

Revision ID: 90748c91a44e
Revises: 
Create Date: 2024-12-19 12:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '90748c91a44e'
down_revision = 'b8c9d2e1f4a3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Добавляем колонку description в таблицу user
    op.add_column('user', sa.Column('description', sa.String(length=500), nullable=True))


def downgrade() -> None:
    # Удаляем колонку description
    op.drop_column('user', 'description')
