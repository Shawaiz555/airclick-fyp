from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    """
    User model representing registered users in the system.

    Supports both traditional email/password authentication and OAuth providers (Google).
    Users authenticated via OAuth will have password_hash as NULL and oauth_provider set.
    """
    __tablename__ = "users"

    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)

    # Traditional authentication (nullable for OAuth users)
    password_hash = Column(String(255), nullable=True)  # NULL for OAuth users

    # OAuth authentication fields
    oauth_provider = Column(String(50), nullable=True)  # e.g., "google", "github"
    oauth_provider_id = Column(String(255), nullable=True, index=True)  # Provider's unique user ID

    # User profile information
    full_name = Column(String(255), nullable=True)  # From OAuth or user input
    profile_picture = Column(String(500), nullable=True)  # URL to profile image

    # Authorization and settings
    role = Column(String(20), default="USER", nullable=False)  # "USER" or "ADMIN"
    accessibility_settings = Column(JSONB, default={})  # Custom user preferences

    # Email verification (for future enhancement)
    email_verified = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")


class PasswordResetToken(Base):
    """
    Model for storing password reset tokens.

    Tokens are one-time use and expire after 15 minutes for security.
    Each token is hashed before storage to prevent unauthorized access if database is compromised.
    """
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # Security: Store hashed version of token (like passwords)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)

    # Token lifecycle management
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False)  # Prevent token reuse

    # Relationships
    user = relationship("User", back_populates="reset_tokens")
