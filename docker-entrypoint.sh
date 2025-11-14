#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo "Starting Conspectium Web Container"
echo "=========================================="

# Wait for database to be ready
if [ -n "${DATABASE_URL:-}" ]; then
  echo "Waiting for database to be ready..."
  
  # Extract host from DATABASE_URL (default to 'db' if parsing fails)
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p' || echo "db")
  DB_PORT=5432
  
  echo "Checking database connection at $DB_HOST:$DB_PORT..."
  
  # Wait for database with timeout
  MAX_ATTEMPTS=30
  ATTEMPT=0
  while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U postgres >/dev/null 2>&1; then
      echo "✓ Database is ready!"
      break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo "  Attempt $ATTEMPT/$MAX_ATTEMPTS: Database not ready, waiting..."
    sleep 2
  done
  
  if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "⚠ Warning: Database connection timeout, but continuing..."
  fi
  
  # Run alembic migrations
  echo "Applying database migrations (alembic)..."
  if python -m alembic upgrade head; then
    echo "✓ Migrations applied successfully"
  else
    echo "⚠ Warning: Migration failed, but continuing..."
  fi
else
  echo "⚠ Warning: DATABASE_URL is not set"
fi

# Check other required environment variables
echo "Checking environment variables..."
if [ -z "${GOOGLE_API_KEY:-}" ]; then
  echo "⚠ Warning: GOOGLE_API_KEY is not set"
fi

if [ -z "${JWT_SECRET_KEY:-}" ] && [ -z "${secret_key:-}" ]; then
  echo "⚠ Warning: JWT_SECRET_KEY/secret_key is not set"
fi

echo "=========================================="
echo "Starting application server..."
echo "=========================================="

exec "$@"
