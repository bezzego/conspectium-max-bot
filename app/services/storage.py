import os
from pathlib import Path
from typing import BinaryIO

from fastapi import UploadFile

from app.core.config import settings


class AudioStorageService:
    def __init__(self, base_dir: str) -> None:
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _user_dir(self, user_id: int) -> Path:
        path = self.base_dir / str(user_id)
        path.mkdir(parents=True, exist_ok=True)
        return path

    def save_upload(self, user_id: int, upload: UploadFile) -> tuple[Path, int]:
        user_dir = self._user_dir(user_id)
        path = user_dir / upload.filename
        total_size = 0

        with path.open("wb") as out_file:
            while chunk := upload.file.read(1024 * 1024):
                total_size += len(chunk)
                out_file.write(chunk)

        upload.file.seek(0)

        return path, total_size

    def save_bytes(self, user_id: int, filename: str, data: bytes) -> Path:
        user_dir = self._user_dir(user_id)
        path = user_dir / filename
        path.write_bytes(data)
        return path

    def open(self, file_path: str) -> BinaryIO:
        return open(os.path.join(self.base_dir, file_path), "rb")


audio_storage = AudioStorageService(settings.audio_storage_dir)
