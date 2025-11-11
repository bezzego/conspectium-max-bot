"""update_user_model_email_nickname_required

Revision ID: b8c9d2e1f4a3
Revises: a42d0a5ba805
Create Date: 2025-11-11 13:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b8c9d2e1f4a3'
down_revision = 'a42d0a5ba805'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    
    # Используем SQL напрямую с обработкой ошибок для идемпотентности
    # Добавляем колонку nickname, если её нет
    conn.execute(sa.text("""
        DO $$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='user' AND column_name='nickname'
            ) THEN
                ALTER TABLE "user" ADD COLUMN nickname VARCHAR(50);
            END IF;
        END $$;
    """))
    
    # Обновляем существующих пользователей (если есть)
    # Устанавливаем временные значения для пользователей без email/nickname/password_hash
    conn.execute(sa.text("""
        UPDATE "user" 
        SET email = COALESCE(email, 'temp_' || id || '@temp.com'),
            nickname = COALESCE(nickname, 'user_' || id),
            password_hash = COALESCE(password_hash, '$2b$12$temp_hash_placeholder_for_existing_users')
        WHERE email IS NULL OR nickname IS NULL OR password_hash IS NULL;
    """))
    
    # Исправляем дубликаты email
    conn.execute(sa.text("""
        DO $$
        DECLARE
            dup_email TEXT;
        BEGIN
            FOR dup_email IN 
                SELECT email FROM "user" 
                GROUP BY email 
                HAVING COUNT(*) > 1
            LOOP
                UPDATE "user"
                SET email = 'temp_' || id || '@temp.com'
                WHERE email = dup_email 
                AND id NOT IN (
                    SELECT id FROM "user" WHERE email = dup_email LIMIT 1
                );
            END LOOP;
        END $$;
    """))
    
    # Исправляем дубликаты nickname
    conn.execute(sa.text("""
        DO $$
        DECLARE
            dup_nickname TEXT;
        BEGIN
            FOR dup_nickname IN 
                SELECT nickname FROM "user" 
                WHERE nickname IS NOT NULL
                GROUP BY nickname 
                HAVING COUNT(*) > 1
            LOOP
                UPDATE "user"
                SET nickname = 'user_' || id
                WHERE nickname = dup_nickname 
                AND id NOT IN (
                    SELECT id FROM "user" WHERE nickname = dup_nickname LIMIT 1
                );
            END LOOP;
        END $$;
    """))
    
    # Обновляем nickname для существующих пользователей (на случай, если были NULL)
    conn.execute(sa.text("""
        UPDATE "user" 
        SET nickname = COALESCE(nickname, 'user_' || id)
        WHERE nickname IS NULL;
    """))
    
    # Делаем email обязательным
    conn.execute(sa.text("""
        DO $$ 
        BEGIN
            ALTER TABLE "user" ALTER COLUMN email SET NOT NULL;
        EXCEPTION
            WHEN OTHERS THEN NULL;
        END $$;
    """))
    
    # Создаем уникальное ограничение для email
    conn.execute(sa.text("""
        DO $$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE table_name='user' AND constraint_name='uq_user_email'
            ) THEN
                ALTER TABLE "user" ADD CONSTRAINT uq_user_email UNIQUE (email);
            END IF;
        EXCEPTION
            WHEN duplicate_table THEN NULL;
            WHEN OTHERS THEN NULL;
        END $$;
    """))
    
    # Создаем индекс для email
    conn.execute(sa.text("""
        DO $$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE tablename='user' AND indexname='ix_user_email'
            ) THEN
                CREATE UNIQUE INDEX ix_user_email ON "user"(email);
            END IF;
        EXCEPTION
            WHEN duplicate_table THEN NULL;
            WHEN OTHERS THEN NULL;
        END $$;
    """))
    
    # Делаем nickname обязательным
    conn.execute(sa.text("""
        DO $$ 
        BEGIN
            ALTER TABLE "user" ALTER COLUMN nickname SET NOT NULL;
        EXCEPTION
            WHEN OTHERS THEN NULL;
        END $$;
    """))
    
    # Создаем уникальное ограничение для nickname
    conn.execute(sa.text("""
        DO $$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE table_name='user' AND constraint_name='uq_user_nickname'
            ) THEN
                ALTER TABLE "user" ADD CONSTRAINT uq_user_nickname UNIQUE (nickname);
            END IF;
        EXCEPTION
            WHEN duplicate_table THEN NULL;
            WHEN OTHERS THEN NULL;
        END $$;
    """))
    
    # Создаем индекс для nickname
    conn.execute(sa.text("""
        DO $$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE tablename='user' AND indexname='ix_user_nickname'
            ) THEN
                CREATE UNIQUE INDEX ix_user_nickname ON "user"(nickname);
            END IF;
        EXCEPTION
            WHEN duplicate_table THEN NULL;
            WHEN OTHERS THEN NULL;
        END $$;
    """))
    
    # Делаем password_hash обязательным
    conn.execute(sa.text("""
        DO $$ 
        BEGIN
            ALTER TABLE "user" ALTER COLUMN password_hash SET NOT NULL;
        EXCEPTION
            WHEN OTHERS THEN NULL;
        END $$;
    """))


def downgrade() -> None:
    op.drop_constraint('uq_user_nickname', 'user', type_='unique')
    op.drop_index('ix_user_nickname', table_name='user')
    op.alter_column('user', 'nickname',
                    existing_type=sa.String(length=50),
                    nullable=True)
    
    op.drop_constraint('uq_user_email', 'user', type_='unique')
    op.alter_column('user', 'email',
                    existing_type=sa.String(length=255),
                    nullable=True)
    
    op.alter_column('user', 'password_hash',
                    existing_type=sa.String(length=255),
                    nullable=True)

