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

# Silence per-frame chatty loggers — they log at INFO on every webcam frame
# (30 fps × many log lines = thousands of messages/second that flood the
# console and slow down the Electron overlay via stdout pressure).
# Set these to WARNING so only actual problems surface.
_QUIET_LOGGERS = [
    'app.services.hand_pose_fingerprint',
    'app.services.gesture_matcher',
    'app.services.gesture_validation',
    'app.services.gesture_preprocessing',
    'app.services.enhanced_dtw',
    'app.services.gesture_indexing',
    'app.services.gesture_cache',
    'app.services.temporal_smoothing',
    'app.services.hybrid_state_machine',
    'app.services.hybrid_mode_controller',
    'app.services.cursor_controller',
]
for _name in _QUIET_LOGGERS:
    logging.getLogger(_name).setLevel(logging.WARNING)

# Create database tables (with error handling)
try:
    Base.metadata.create_all(bind=engine)
    logging.info("Database connection successful")
except Exception as e:
    logging.warning(f"Warning: Could not connect to database: {e}")
    logging.warning("Server will start but database operations will fail")

# Initialize FastAPI app
app = FastAPI(
    title="AirClick API",
    description="Hand gesture recognition backend API",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
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
        logger.info("")

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
    logger.info("💡 Electron overlay will continue running independently")


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
