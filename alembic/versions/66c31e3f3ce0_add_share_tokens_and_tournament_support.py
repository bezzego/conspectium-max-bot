"""add_share_tokens_and_tournament_support

Revision ID: 66c31e3f3ce0
Revises: 2f4c4f4ff2c5
Create Date: 2025-11-11 12:42:54.946781
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision = '66c31e3f3ce0'
down_revision = '2f4c4f4ff2c5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('conspect', sa.Column('share_token', sa.String(length=64), nullable=True))
    op.create_index(op.f('ix_conspect_share_token'), 'conspect', ['share_token'], unique=True)
    
    op.add_column('quiz', sa.Column('share_token', sa.String(length=64), nullable=True))
    op.add_column('quiz', sa.Column('is_public_tournament', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_index(op.f('ix_quiz_share_token'), 'quiz', ['share_token'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_quiz_share_token'), table_name='quiz')
    op.drop_column('quiz', 'is_public_tournament')
    op.drop_column('quiz', 'share_token')
    
    op.drop_index(op.f('ix_conspect_share_token'), table_name='conspect')
    op.drop_column('conspect', 'share_token')
