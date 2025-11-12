from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.api_v1 import api_router
from app.core.config import settings
from app.db.session import init_db


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.project_name,
        description="Backend API for the Conspectium MAX Mini App",
        version="0.1.0",
        openapi_url=f"{settings.api_v1_prefix}/openapi.json",
        docs_url=f"{settings.api_v1_prefix}/docs",
        redoc_url=f"{settings.api_v1_prefix}/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.backend_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.api_v1_prefix)

    static_path = Path("front")
    if static_path.exists():
        app.mount("/front", StaticFiles(directory=str(static_path)), name="front")

    img_path = Path("img")
    if img_path.exists():
        app.mount("/img", StaticFiles(directory=str(img_path)), name="img")

    @app.on_event("startup")
    def _startup() -> None:
        Path(settings.audio_storage_dir).mkdir(parents=True, exist_ok=True)
        Path(settings.avatar_storage_dir).mkdir(parents=True, exist_ok=True)

    return app


app = create_app()
