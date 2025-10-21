"""
Application Configuration Settings

This module defines all environment variables used by the application.
Uses Pydantic Settings for automatic validation and type checking.
"""

from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    All settings are loaded from the .env file and validated using Pydantic.
    Required fields will raise an error if not set in environment.
    Optional fields have default values.
    """

    # ============================================
    # DATABASE CONFIGURATION
    # ============================================
    DATABASE_URL: str  # Required - PostgreSQL connection string

    # ============================================
    # JWT AUTHENTICATION
    # ============================================
    SECRET_KEY: str  # Required - Secret key for JWT token signing
    ALGORITHM: str = "HS256"  # JWT algorithm
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30  # Token expiration time

    # ============================================
    # CORS & FRONTEND
    # ============================================
    FRONTEND_URL: str = "http://localhost:3000"  # Frontend application URL

    # ============================================
    # GOOGLE OAUTH CONFIGURATION
    # ============================================
    # Optional - If not set, Google OAuth will be disabled
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: Optional[str] = "http://localhost:8000/api/auth/google/callback"

    # ============================================
    # EMAIL CONFIGURATION
    # ============================================
    # Optional - If not set, email features will be disabled
    MAIL_USERNAME: Optional[str] = None  # SMTP username or email address
    MAIL_PASSWORD: Optional[str] = None  # SMTP password or app password
    MAIL_FROM: Optional[str] = None  # Sender email address
    MAIL_SERVER: Optional[str] = "smtp.gmail.com"  # SMTP server hostname
    MAIL_PORT: Optional[int] = 587  # SMTP port (587 for TLS, 465 for SSL)

    class Config:
        """Pydantic configuration"""
        env_file = ".env"  # Load from .env file
        case_sensitive = True  # Environment variables are case-sensitive
        extra = "ignore"  # Ignore extra fields in .env that aren't defined here

# Create global settings instance
settings = Settings()
