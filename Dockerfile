# ===========================
#   Stage 1 — Build deps
# ===========================
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
WORKDIR /app

# System deps
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        libpq-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip + install poetry
RUN pip install --upgrade pip setuptools wheel && pip install poetry

# Copy poetry files
COPY pyproject.toml poetry.lock* /app/

# Install deps into /packages to reuse later
RUN poetry config virtualenvs.create false \
    && poetry install --without dev --no-root --no-ansi --no-interaction

# ===========================
#   Stage 2 — Runtime image
# ===========================
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
WORKDIR /app

# Install system deps needed at runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy python deps from builder

COPY --from=builder /usr/local/lib/python3.11 /usr/local/lib/python3.11

# Install gunicorn explicitly
RUN pip install gunicorn

# Copy app code
COPY . /app
COPY .env /app/.env

# Entry point
ENV PORT=8000
EXPOSE 8000

# ✅ Prod server: Gunicorn + Uvicorn workers
CMD ["gunicorn", "app.main:app", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--workers", "4"]