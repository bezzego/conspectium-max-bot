"""add_tournament_lobby_and_medals

Revision ID: a42d0a5ba805
Revises: 66c31e3f3ce0
Create Date: 2025-11-11 12:50:45.329985
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision = 'a42d0a5ba805'
down_revision = '66c31e3f3ce0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    
    # Создаем enum для статуса лобби (если не существует)
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE tournamentlobbystatus AS ENUM ('waiting', 'started', 'finished', 'cancelled');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """))
    conn.commit()
    
    # Создаем enum для типа медали (если не существует)
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE medaltype AS ENUM ('gold', 'silver', 'bronze', 'participant', 'winner', 'perfect_score');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """))
    conn.commit()
    
    # Создаем таблицы через SQL напрямую, чтобы избежать проблем с enum
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS tournamentlobby (
            id SERIAL PRIMARY KEY,
            quiz_id INTEGER NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
            host_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
            invite_code VARCHAR(16) NOT NULL UNIQUE,
            max_participants INTEGER NOT NULL DEFAULT 8,
            status tournamentlobbystatus NOT NULL DEFAULT 'waiting',
            started_at TIMESTAMP WITH TIME ZONE,
            finished_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
    """))
    
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_tournamentlobby_id ON tournamentlobby(id);
        CREATE INDEX IF NOT EXISTS ix_tournamentlobby_quiz_id ON tournamentlobby(quiz_id);
        CREATE INDEX IF NOT EXISTS ix_tournamentlobby_host_id ON tournamentlobby(host_id);
        CREATE UNIQUE INDEX IF NOT EXISTS ix_tournamentlobby_invite_code ON tournamentlobby(invite_code);
    """))
    
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS tournamentparticipant (
            id SERIAL PRIMARY KEY,
            lobby_id INTEGER NOT NULL REFERENCES tournamentlobby(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
            is_ready BOOLEAN NOT NULL DEFAULT false,
            is_host BOOLEAN NOT NULL DEFAULT false,
            quiz_result_id INTEGER REFERENCES quizresult(id) ON DELETE SET NULL,
            score INTEGER,
            time_seconds INTEGER,
            place INTEGER,
            joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            finished_at TIMESTAMP WITH TIME ZONE
        );
    """))
    
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_tournamentparticipant_id ON tournamentparticipant(id);
        CREATE INDEX IF NOT EXISTS ix_tournamentparticipant_lobby_id ON tournamentparticipant(lobby_id);
        CREATE INDEX IF NOT EXISTS ix_tournamentparticipant_user_id ON tournamentparticipant(user_id);
    """))
    
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS medal (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
            lobby_id INTEGER REFERENCES tournamentlobby(id) ON DELETE SET NULL,
            medal_type medaltype NOT NULL,
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
    """))
    
    conn.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_medal_id ON medal(id);
        CREATE INDEX IF NOT EXISTS ix_medal_user_id ON medal(user_id);
        CREATE INDEX IF NOT EXISTS ix_medal_lobby_id ON medal(lobby_id);
    """))
    
    conn.commit()


def downgrade() -> None:
    op.drop_index(op.f('ix_medal_lobby_id'), table_name='medal')
    op.drop_index(op.f('ix_medal_user_id'), table_name='medal')
    op.drop_index(op.f('ix_medal_id'), table_name='medal')
    op.drop_table('medal')
    
    op.drop_index(op.f('ix_tournamentparticipant_user_id'), table_name='tournamentparticipant')
    op.drop_index(op.f('ix_tournamentparticipant_lobby_id'), table_name='tournamentparticipant')
    op.drop_index(op.f('ix_tournamentparticipant_id'), table_name='tournamentparticipant')
    op.drop_table('tournamentparticipant')
    
    op.drop_index(op.f('ix_tournamentlobby_invite_code'), table_name='tournamentlobby')
    op.drop_index(op.f('ix_tournamentlobby_host_id'), table_name='tournamentlobby')
    op.drop_index(op.f('ix_tournamentlobby_quiz_id'), table_name='tournamentlobby')
    op.drop_index(op.f('ix_tournamentlobby_id'), table_name='tournamentlobby')
    op.drop_table('tournamentlobby')
    
    sa.Enum(name="medaltype").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="tournamentlobbystatus").drop(op.get_bind(), checkfirst=True)
