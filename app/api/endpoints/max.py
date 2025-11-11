"""Endpoints для Max Bot"""
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request, status

from app.core.config import settings
from app.services.max import max_bot_service

router = APIRouter()


@router.post("/webhook", summary="Max Bot webhook")
async def max_webhook(request: Request) -> Dict[str, Any]:
    """Обрабатывает webhook обновления от Max Bot"""
    if not max_bot_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Max bot is not configured. Please set MAX_BOT_TOKEN in environment variables.",
        )

    try:
        update = await request.json()
        result = max_bot_service.process_webhook_update(update)
        return {"ok": True, "result": result} if result else {"ok": True}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing webhook: {str(e)}",
        ) from e


@router.get("/webhook/info", summary="Max Bot info")
def max_webhook_info() -> Dict[str, Any]:
    """Возвращает информацию о конфигурации Max бота"""
    return {
        "configured": max_bot_service is not None,
        "api_base_url": settings.max_api_base_url,
        "mini_app_url": settings.max_mini_app_url,
        "welcome_message": settings.max_welcome_message,
        "welcome_button_text": settings.max_welcome_button_text,
    }

