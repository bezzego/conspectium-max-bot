# """add max_user_id to user

# Revision ID: add_max_user_id
# Revises: 2d46dfa1e369
# Create Date: 2024-01-01 12:00:00.000000

# """
# from alembic import op
# import sqlalchemy as sa


# # revision identifiers, used by Alembic.
# revision = 'add_max_user_id'
# down_revision = '2d46dfa1e369'
# branch_labels = None
# depends_on = None


# def upgrade() -> None:
#     # Добавляем колонку max_user_id
#     op.add_column('user', sa.Column('max_user_id', sa.String(length=255), nullable=True))
#     # Создаем уникальный индекс
#     op.create_index(op.f('ix_user_max_user_id'), 'user', ['max_user_id'], unique=True)


# def downgrade() -> None:
#     # Удаляем индекс
#     op.drop_index(op.f('ix_user_max_user_id'), table_name='user')
#     # Удаляем колонку
#     op.drop_column('user', 'max_user_id')

