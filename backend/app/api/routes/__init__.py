from fastapi import APIRouter
from app.api.routes import auth, gestures

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(gestures.router, prefix="/gestures", tags=["gestures"])
