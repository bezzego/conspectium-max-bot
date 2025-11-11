"""Сервис для работы с Max Bot API"""
import logging
from typing import Any, Dict, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class MaxBotService:
    """Сервис для взаимодействия с Max Bot API"""

    def __init__(self, bot_token: Optional[str] = None, api_base_url: Optional[str] = None) -> None:
        self.bot_token = bot_token or settings.max_bot_token
        self.api_base_url = (api_base_url or settings.max_api_base_url).rstrip("/")
        self.mini_app_url = settings.max_mini_app_url or "https://conspectium-hackflow.ru/"
        self.welcome_message = settings.max_welcome_message
        self.welcome_button_text = settings.max_welcome_button_text

    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        timeout: float = 10.0,
    ) -> Dict[str, Any]:
        """Выполняет HTTP запрос к Max API"""
        if not self.bot_token:
            raise ValueError("Max bot token is not configured")

        url = f"{self.api_base_url}{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.bot_token}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=timeout) as client:
                response = client.request(method, url, headers=headers, json=data)
                response.raise_for_status()
                return response.json() if response.content else {}
        except httpx.HTTPError as e:
            logger.error(f"Max API request failed: {e}")
            raise

    def send_message(
        self,
        chat_id: str,
        text: str,
        reply_markup: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Отправляет сообщение пользователю"""
        payload = {
            "chat_id": chat_id,
            "text": text,
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup

        return self._make_request("POST", "/bot/sendMessage", data=payload)

    def send_welcome_message(self, chat_id: str) -> Dict[str, Any]:
        """Отправляет приветственное сообщение с кнопкой для открытия мини-приложения"""
        if not self.mini_app_url:
            logger.warning("Mini app URL is not configured, sending text-only welcome message")
            return self.send_message(chat_id, self.welcome_message)

        # Создаем inline кнопку для открытия мини-приложения
        reply_markup = {
            "inline_keyboard": [
                [
                    {
                        "text": self.welcome_button_text,
                        "web_app": {"url": self.mini_app_url},
                    }
                ]
            ]
        }

        return self.send_message(chat_id, self.welcome_message, reply_markup=reply_markup)

    def process_webhook_update(self, update: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Обрабатывает обновление от Max webhook"""
        try:
            # Обрабатываем команду /start
            if "message" in update:
                message = update["message"]
                text = message.get("text", "")
                chat = message.get("chat", {})
                chat_id = str(chat.get("id"))

                if text == "/start" or text.startswith("/start"):
                    return self.send_welcome_message(chat_id)

            return None
        except Exception as e:
            logger.error(f"Error processing webhook update: {e}")
            return None


# Создаем глобальный экземпляр сервиса
max_bot_service = MaxBotService() if settings.max_bot_token else None

