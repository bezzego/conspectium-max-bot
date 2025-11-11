"""Add user profile fields and brief conspect variant.

Revision ID: 20240610_0003
Revises: 20240607_0002
Create Date: 2024-06-10 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20240610_0003"
down_revision = "20240607_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user", sa.Column("display_name", sa.String(length=255), nullable=True))
    op.add_column("user", sa.Column("gender", sa.String(length=32), nullable=True))
    op.add_column("user", sa.Column("avatar_id", sa.String(length=64), nullable=True))
    op.add_column("user", sa.Column("avatar_url", sa.String(length=1024), nullable=True))

    op.add_column("conspect", sa.Column("brief_markdown", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("conspect", "brief_markdown")

    op.drop_column("user", "avatar_url")
    op.drop_column("user", "avatar_id")
    op.drop_column("user", "gender")
    op.drop_column("user", "display_name")
