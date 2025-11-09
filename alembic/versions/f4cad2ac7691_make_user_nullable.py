"""make user nullable

Revision ID: f4cad2ac7691
Revises: 5cb10acc1258
Create Date: 2025-11-09 15:16:11.874777
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision = 'f4cad2ac7691'
down_revision = '5cb10acc1258'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('user', 'email', existing_type=sa.String(length=255), nullable=True)
    op.alter_column('user', 'password_hash', existing_type=sa.String(length=255), nullable=True)
    op.alter_column('user', 'full_name', existing_type=sa.String(length=255), nullable=True)


def downgrade() -> None:
    op.alter_column('user', 'email', existing_type=sa.String(length=255), nullable=False)
    op.alter_column('user', 'password_hash', existing_type=sa.String(length=255), nullable=False)
    op.alter_column('user', 'full_name', existing_type=sa.String(length=255), nullable=False)
