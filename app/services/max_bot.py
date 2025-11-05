from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Any, Dict, Optional
from urllib import error, request
from urllib.parse import urljoin

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class MaxBotConfig:
    api_base_url: str
    token: str
    mini_app_url: str
    welcome_message: str
    button_text: str
    request_timeout: float = 10.0


class MaxBotClient:
    def __init__(self, config: Optional[MaxBotConfig]) -> None:
        self._config = config

    @property
    def is_configured(self) -> bool:
        return self._config is not None

    def reload(self) -> None:
        if settings.max_bot_token and settings.max_mini_app_url:
            self._config = MaxBotConfig(
                api_base_url=settings.max_api_base_url.rstrip("/"),
                token=settings.max_bot_token,
                mini_app_url=settings.max_mini_app_url,
                welcome_message=settings.max_welcome_message,
                button_text=settings.max_welcome_button_text,
            )
        else:
            self._config = None

    async def send_welcome_message(self, chat_id: int, user_name: Optional[str] = None) -> None:
        if not self.is_configured or not self._config:
            logger.debug("MAX bot client is not configured; skipping welcome message")
            return

        message = self._config.welcome_message
        if user_name:
            message = message.replace("{first_name}", user_name)

        payload: Dict[str, Any] = {
            "chat_id": chat_id,
            "text": message,
            "reply_markup": {
                "inline_keyboard": [
                    [
                        {
                            "text": self._config.button_text,
                            "url": self._config.mini_app_url,
                        }
                    ]
                ]
            },
        }

        await asyncio.to_thread(self._post, "/messages/send", payload)

    def _post(self, path: str, payload: Dict[str, Any]) -> None:
        if not self._config:
            return

        url = urljoin(f"{self._config.api_base_url}/", path.lstrip("/"))
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = request.Request(url, data=data, method="POST")
        req.add_header("Content-Type", "application/json")
        req.add_header("Authorization", self._config.token)

        try:
            with request.urlopen(req, timeout=self._config.request_timeout):
                logger.debug("MAX bot message sent to %s", url)
        except error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore")
            logger.error(
                "MAX bot API returned %s when sending request to %s: %s", exc.code, url, body
            )
        except error.URLError as exc:
            logger.error("Failed to reach MAX bot API at %s: %s", url, exc)


def create_max_bot_client() -> MaxBotClient:
    config: Optional[MaxBotConfig] = None
    if settings.max_bot_token and settings.max_mini_app_url:
        config = MaxBotConfig(
            api_base_url=settings.max_api_base_url.rstrip("/"),
            token=settings.max_bot_token,
            mini_app_url=settings.max_mini_app_url,
            welcome_message=settings.max_welcome_message,
            button_text=settings.max_welcome_button_text,
        )
    return MaxBotClient(config)


max_bot_client = create_max_bot_client()
