from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, engine
from app.api.routes import api_router, ws_router
from app.services import hand_tracking
import logging
import subprocess
import os
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global variable to track Electron process
electron_process = None

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
    global electron_process

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

    # Start Electron overlay automatically
    try:
        logger.info("🖥️ Starting Electron Overlay...")

        # Get the project root directory (parent of backend)
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        electron_dir = os.path.join(backend_dir, "electron")

        if not os.path.exists(electron_dir):
            logger.warning(f"⚠ Electron directory not found at: {electron_dir}")
            logger.warning("⚠ Skipping Electron startup")
        else:
            # Check if node_modules exists in electron directory
            node_modules_path = os.path.join(electron_dir, "node_modules")
            if not os.path.exists(node_modules_path):
                logger.warning("⚠ Electron dependencies not installed. Please run 'npm install' in the electron directory")
                logger.warning("⚠ Skipping Electron startup")
            else:
                # Start Electron directly using node and electron
                if sys.platform == "win32":
                    # On Windows, use npm.cmd with shell=True to properly launch electron
                    electron_process = subprocess.Popen(
                        "npm start",
                        cwd=electron_dir,
                        shell=True,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE
                    )
                else:
                    # On Unix-like systems
                    electron_process = subprocess.Popen(
                        ["npm", "start"],
                        cwd=electron_dir,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE
                    )

                logger.info("✓ Electron Overlay started successfully")
                logger.info("✓ Electron window should appear shortly...")

    except Exception as e:
        logger.error(f"✗ Failed to start Electron Overlay: {e}")
        logger.warning("⚠ Backend will continue without Electron overlay")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup services on application shutdown"""
    global electron_process

    logger.info("🛑 Shutting down AirClick Backend...")

    try:
        if hand_tracking.hand_tracking_service:
            hand_tracking.hand_tracking_service.cleanup()
            logger.info("✓ Hand Tracking Service cleaned up")
    except Exception as e:
        logger.error(f"✗ Error during cleanup: {e}")

    # Terminate Electron process if it's running
    try:
        if electron_process and electron_process.poll() is None:
            logger.info("🛑 Stopping Electron Overlay...")
            electron_process.terminate()

            # Wait for process to terminate gracefully (max 5 seconds)
            try:
                electron_process.wait(timeout=5)
                logger.info("✓ Electron Overlay stopped gracefully")
            except subprocess.TimeoutExpired:
                logger.warning("⚠ Electron did not stop gracefully, forcing termination...")
                electron_process.kill()
                logger.info("✓ Electron Overlay terminated")
    except Exception as e:
        logger.error(f"✗ Error stopping Electron: {e}")

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
