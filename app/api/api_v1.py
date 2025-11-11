from fastapi import APIRouter

from app.api.endpoints import auth, audio, conspects, health, jobs, max as max_bot, quizzes

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(audio.router, prefix="/audio", tags=["audio"])
api_router.include_router(conspects.router, prefix="/conspects", tags=["conspects"])
api_router.include_router(quizzes.router, prefix="/quizzes", tags=["quizzes"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
api_router.include_router(max_bot.router, prefix="/max", tags=["max"])
