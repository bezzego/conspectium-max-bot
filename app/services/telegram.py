import hashlib
import hmac
import json
from datetime import datetime, timezone
from typing import Any, Dict
from urllib.parse import parse_qsl

from fastapi import HTTPException, status

from app.core.config import settings


class TelegramAuthService:
    WEB_APP_DATA_PREFIX = "WebAppData"

    def __init__(self, bot_token: str) -> None:
        self.bot_token = bot_token
        secret_key = hashlib.sha256(bot_token.encode("utf-8")).digest()
        self._secret_key = secret_key

    def parse_init_data(self, init_data: str) -> Dict[str, Any]:
        data = dict(parse_qsl(init_data, keep_blank_values=True))
        if "hash" not in data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing hash in init data")
        received_hash = data.pop("hash")

        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(data.items()))
        hmac_hash = hmac.new(self._secret_key, msg=data_check_string.encode("utf-8"), digestmod=hashlib.sha256)
        calculated_hash = hmac_hash.hexdigest()

        if not hmac.compare_digest(received_hash, calculated_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram init data hash")

        auth_date = int(data.get("auth_date", "0"))
        if auth_date:
            auth_datetime = datetime.fromtimestamp(auth_date, tz=timezone.utc)
            age = datetime.now(tz=timezone.utc) - auth_datetime
            if age.total_seconds() > 24 * 60 * 60:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Telegram init data expired",
                )

        if "user" in data:
            if isinstance(data["user"], str):
                data["user"] = json.loads(data["user"])

        return data


# Telegram auth service removed for web-only flow. Keep class for reference only.
