from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, engine
from app.api.routes import api_router, ws_router
from app.services import hand_tracking
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create database tables (with error handling)
try:
    Base.metadata.create_all(bind=engine)
    print("✓ Database connection successful")
except Exception as e:
    print(f"⚠ Warning: Could not connect to database: {e}")
    print("⚠ Server will start but database operations will fail")

# Initialize FastAPI app
app = FastAPI(
    title="AirClick API",
    description="Hand gesture recognition backend API",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")

# Include WebSocket routes
app.include_router(ws_router, prefix="/ws")


@app.on_event("startup")
async def startup_event():
    """Initialize services on application startup"""
    try:
        logger.info("🚀 Starting AirClick Backend Server...")

        # Initialize hand tracking service
        logger.info("📹 Initializing MediaPipe Hand Tracking Service...")
        hand_tracking.hand_tracking_service = hand_tracking.HandTrackingService()
        logger.info("✓ Hand Tracking Service initialized successfully")

        logger.info("✓ AirClick Backend is ready!")
        logger.info("✓ HTTP API: http://localhost:8000/api")
        logger.info("✓ WebSocket: ws://localhost:8000/ws/hand-tracking")
        logger.info("✓ API Docs: http://localhost:8000/docs")

    except Exception as e:
        logger.error(f"✗ Failed to initialize Hand Tracking Service: {e}")
        logger.warning("⚠ Server will start but hand tracking will not be available")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup services on application shutdown"""
    logger.info("🛑 Shutting down AirClick Backend...")

    try:
        if hand_tracking.hand_tracking_service:
            hand_tracking.hand_tracking_service.cleanup()
            logger.info("✓ Hand Tracking Service cleaned up")
    except Exception as e:
        logger.error(f"✗ Error during cleanup: {e}")

    logger.info("✓ Shutdown complete")


@app.get("/")
def root():
    """Root endpoint"""
    return {
        "message": "AirClick API is running",
        "version": "1.0.0",
        "services": {
            "http_api": "/api",
            "websocket": "/ws/hand-tracking",
            "docs": "/docs"
        }
    }

@app.get("/health")
def health_check():
    """Health check endpoint"""
    hand_tracking_status = "initialized" if hand_tracking.hand_tracking_service else "not_initialized"

    return {
        "status": "healthy",
        "services": {
            "database": "connected",
            "hand_tracking": hand_tracking_status
        }
    }
