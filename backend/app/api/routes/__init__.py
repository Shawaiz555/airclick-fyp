from fastapi import APIRouter
from app.api.routes import auth, gestures, websocket, admin

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(gestures.router, prefix="/gestures", tags=["gestures"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])

# WebSocket routes (separate router for ws:// prefix)
ws_router = APIRouter()
ws_router.include_router(websocket.router, prefix="", tags=["websocket"])
