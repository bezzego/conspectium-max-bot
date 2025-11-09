"""merge heads

Revision ID: 2f4c4f4ff2c5
Revises: 20251109_add_upload_to_audiosourcetype, c5a27a7eba21
Create Date: 2025-11-09 15:44:56.100030
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision = '2f4c4f4ff2c5'
down_revision = ('20251109_add_upload_to_audiosourcetype', 'c5a27a7eba21')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
