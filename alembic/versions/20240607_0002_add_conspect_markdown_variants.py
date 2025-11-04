"""Add markdown variants columns to conspect model.

Revision ID: 20240607_0002
Revises: 20240606_0001
Create Date: 2024-06-07 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20240607_0002"
down_revision = "20240606_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("conspect", sa.Column("compressed_markdown", sa.Text(), nullable=True))
    op.add_column("conspect", sa.Column("full_markdown", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("conspect", "full_markdown")
    op.drop_column("conspect", "compressed_markdown")
