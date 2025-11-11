import os
import re
from pathlib import Path
from typing import BinaryIO
from uuid import uuid4

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
        path = user_dir / self._safe_filename(upload.filename or "audio")
        total_size = 0

        with path.open("wb") as out_file:
            while chunk := upload.file.read(1024 * 1024):
                total_size += len(chunk)
                out_file.write(chunk)

        upload.file.seek(0)

        return path, total_size

    def save_bytes(self, user_id: int, filename: str, data: bytes) -> Path:
        user_dir = self._user_dir(user_id)
        path = user_dir / self._safe_filename(filename or "audio")
        path.write_bytes(data)
        return path

    def resolve_path(self, file_path: str | os.PathLike[str]) -> Path:
        candidate = Path(file_path)
        if not candidate.is_absolute():
            candidate = self.base_dir / candidate
        candidate = candidate.resolve()
        base = self.base_dir.resolve()
        if not str(candidate).startswith(str(base)):
            raise ValueError("Invalid audio storage path")
        return candidate

    def open(self, file_path: str) -> BinaryIO:
        return self.resolve_path(file_path).open("rb")

    def _safe_filename(self, original: str) -> str:
        filename = Path(original).name
        stem, ext = os.path.splitext(filename)
        safe_stem = re.sub(r"[^A-Za-z0-9._-]", "_", stem or "audio")
        safe_ext = re.sub(r"[^A-Za-z0-9.]", "", ext) or ".bin"
        unique_suffix = uuid4().hex
        truncated_stem = safe_stem[:40]
        truncated_ext = safe_ext[:10]
        return f"{truncated_stem}_{unique_suffix}{truncated_ext}"


audio_storage = AudioStorageService(settings.audio_storage_dir)
