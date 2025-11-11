#!/usr/bin/env bash
set -euo pipefail

echo "Starting container entrypoint..."

# If DATABASE_URL is set, run alembic migrations before starting the app
if [ -n "${DATABASE_URL:-}" ]; then
  echo "Applying database migrations (alembic)..."
  python -m alembic upgrade head || exit 1
fi

exec "$@"
