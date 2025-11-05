from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import settings
from app.services.max_bot import MaxBotClient, max_bot_client

logger = logging.getLogger(__name__)

router = APIRouter()


def get_max_bot_client() -> MaxBotClient:
    if not max_bot_client.is_configured:
        max_bot_client.reload()
    return max_bot_client


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def handle_max_webhook(
    update: Dict[str, Any],
    client: MaxBotClient = Depends(get_max_bot_client),
) -> Dict[str, str]:
    if not client.is_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MAX bot is not configured. Set MAX_BOT_TOKEN and MAX_MINI_APP_URL.",
        )

    chat_id = _extract_chat_id(update)
    if chat_id is None:
        logger.debug("Unable to extract chat_id from MAX webhook payload: %s", update)
        return {"status": "ignored"}

    text = _extract_message_text(update)
    event_type = str(update.get("event") or update.get("type") or "").lower()

    if should_send_welcome(event_type, text):
        user = _extract_user(update)
        user_name = user.get("first_name") if user else None
        await client.send_welcome_message(chat_id, user_name=user_name)
        return {"status": "welcome_sent"}

    logger.debug("MAX webhook processed without actions: %s", update)
    return {"status": "ok"}


def should_send_welcome(event_type: str, message_text: str) -> bool:
    normalized = message_text.strip().lower()
    if normalized.startswith("/start"):
        return True
    if normalized in {"start", "старт", "начать"}:
        return True
    if event_type in {"conversation_started", "chat_opened"}:
        return True
    return False


def _extract_chat_id(update: Dict[str, Any]) -> Optional[int]:
    if "chat" in update and isinstance(update["chat"], dict):
        chat_id = update["chat"].get("id")
        if isinstance(chat_id, int):
            return chat_id
    message = update.get("message") or update.get("data", {}).get("message")
    if isinstance(message, dict):
        chat = message.get("chat")
        if isinstance(chat, dict):
            chat_id = chat.get("id")
            if isinstance(chat_id, int):
                return chat_id
    return None


def _extract_message_text(update: Dict[str, Any]) -> str:
    message = update.get("message") or update.get("data", {}).get("message")
    if isinstance(message, dict):
        text = message.get("text")
        if isinstance(text, str):
            return text
    payload_text = update.get("text")
    if isinstance(payload_text, str):
        return payload_text
    return ""


def _extract_user(update: Dict[str, Any]) -> Dict[str, Any]:
    message = update.get("message") or update.get("data", {}).get("message")
    if isinstance(message, dict):
        from_data = message.get("from")
        if isinstance(from_data, dict):
            return from_data
    user = update.get("user") or update.get("from")
    if isinstance(user, dict):
        return user
    return {}
