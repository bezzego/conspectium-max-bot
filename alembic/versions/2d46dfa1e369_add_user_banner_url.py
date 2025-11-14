"""add_user_banner_url

Revision ID: 2d46dfa1e369
Revises: 540494a4b5d8
Create Date: 2025-11-14 18:43:00.676585
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision = '2d46dfa1e369'
down_revision = '540494a4b5d8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('user', sa.Column('banner_url', sa.String(length=1024), nullable=True))


def downgrade() -> None:
    op.drop_column('user', 'banner_url')
