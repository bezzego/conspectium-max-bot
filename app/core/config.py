from functools import lru_cache
from typing import Any, List, Optional

from pydantic import Field, PostgresDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    project_name: str = "Conspectium API"
    api_v1_prefix: str = "/api"
    secret_key: str
    access_token_expire_minutes: int = 60 * 72  # 3 days
    jwt_algorithm: str = "HS256"

    database_url: PostgresDsn

    telegram_bot_token: str

    google_api_key: str
    google_model: str = "gemini-2.5-flash"
    google_api_key_text: Optional[str] = None

    max_api_base_url: str = "https://platform-api.max.ru"
    max_bot_token: Optional[str] = None
    max_mini_app_url: Optional[str] = None
    max_welcome_message: str = "Привет! Я бот Конспектиума. Нажми кнопку ниже, чтобы открыть мини-приложение."
    max_welcome_button_text: str = "Открыть Конспектиум"

    audio_storage_dir: str = "var/audio"
    max_upload_size_mb: int = 50

    backend_cors_origins: List[str] = Field(default_factory=list)

    environment: str = "development"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="allow")

    @field_validator("backend_cors_origins", mode="before")
    @classmethod
    def assemble_cors_origins(cls, value: Any) -> List[str]:
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return []
            if value.startswith("[") and value.endswith("]"):
                # Treat as JSON-style list
                value = value.strip("[]")
                items = [item.strip().strip('"').strip("'") for item in value.split(",") if item.strip()]
                return items
            return [origin.strip() for origin in value.split(",")]
        if isinstance(value, list):
            return value
        return []


@lru_cache(1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[arg-type]


settings = get_settings()
