"""add missing user fields

Revision ID: 5cb10acc1258
Revises: f6a1d7de590f
Create Date: 2025-11-09 15:09:17.306805
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision = '5cb10acc1258'
down_revision = 'f6a1d7de590f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('user', sa.Column('first_name', sa.String(255), nullable=True))
    op.add_column('user', sa.Column('last_name', sa.String(255), nullable=True))
    op.add_column('user', sa.Column('language_code', sa.String(16), nullable=True))


def downgrade() -> None:
    op.drop_column('user', 'language_code')
    op.drop_column('user', 'last_name')
    op.drop_column('user', 'first_name')
