from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, engine
from app.api.routes import api_router

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

@app.get("/")
def root():
    """Root endpoint"""
    return {
        "message": "AirClick API is running",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
