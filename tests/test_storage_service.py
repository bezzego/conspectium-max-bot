import io

import pytest
from fastapi import UploadFile

from app.services.storage import AudioStorageService


def _make_upload(name: str, data: bytes) -> UploadFile:
    return UploadFile(filename=name, file=io.BytesIO(data))


def test_save_upload_uses_safe_unique_filename(tmp_path) -> None:
    storage = AudioStorageService(tmp_path)

    first, first_size = storage.save_upload(user_id=1, upload=_make_upload("../../evil.m4a", b"abc"))
    second, _ = storage.save_upload(user_id=1, upload=_make_upload("../../evil.m4a", b"xyz"))

    assert first.parent == tmp_path / "1"
    assert first.exists()
    assert first_size == 3
    assert first.suffix == ".m4a"
    assert ".." not in first.name
    assert first.name != second.name


def test_resolve_path_rejects_directory_escape(tmp_path) -> None:
    storage = AudioStorageService(tmp_path)
    with pytest.raises(ValueError):
        storage.resolve_path("../outside.dat")


def test_resolve_path_returns_absolute_path(tmp_path) -> None:
    storage = AudioStorageService(tmp_path)
    path, _ = storage.save_upload(user_id=2, upload=_make_upload("clip.wav", b"123"))
    relative = path.relative_to(storage.base_dir)

    resolved = storage.resolve_path(relative)
    assert resolved == path
