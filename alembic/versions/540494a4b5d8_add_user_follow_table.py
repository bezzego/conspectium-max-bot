"""add_user_follow_table

Revision ID: 540494a4b5d8
Revises: 90748c91a44e
Create Date: 2025-11-12 11:22:53.410074
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '540494a4b5d8'
down_revision = '90748c91a44e'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Создаем таблицу user_follow для подписок
    op.create_table(
        'user_follow',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('follower_id', sa.Integer(), nullable=False),
        sa.Column('following_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['follower_id'], ['user.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['following_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('follower_id', 'following_id', name='uq_user_follow')
    )
    op.create_index(op.f('ix_user_follow_follower_id'), 'user_follow', ['follower_id'], unique=False)
    op.create_index(op.f('ix_user_follow_following_id'), 'user_follow', ['following_id'], unique=False)
    op.create_index(op.f('ix_user_follow_id'), 'user_follow', ['id'], unique=False)


def downgrade() -> None:
    # Удаляем индексы и таблицу
    op.drop_index(op.f('ix_user_follow_id'), table_name='user_follow')
    op.drop_index(op.f('ix_user_follow_following_id'), table_name='user_follow')
    op.drop_index(op.f('ix_user_follow_follower_id'), table_name='user_follow')
    op.drop_table('user_follow')
