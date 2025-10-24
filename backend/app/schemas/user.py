"""
Pydantic schemas for user authentication and authorization.

These schemas define the structure of request/response data for auth endpoints.
They provide automatic validation, serialization, and documentation.
"""

from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional
from datetime import datetime


# ============================================
# TRADITIONAL EMAIL/PASSWORD SCHEMAS
# ============================================

class UserCreate(BaseModel):
    """
    Schema for user registration with email and password.

    Validates email format and enforces minimum password length.
    """
    full_name: Optional[str] = Field(None, max_length=255, description="Full name of the user")
    email: EmailStr  # Automatically validates email format
    password: str = Field(..., min_length=6, description="Password (minimum 6 characters)")
    role: Optional[str] = Field(default="USER", description="User role: USER or ADMIN")

    @validator("role")
    def validate_role(cls, v):
        """Ensure role is either USER or ADMIN"""
        if v not in ["USER", "ADMIN"]:
            raise ValueError("Role must be USER or ADMIN")
        return v


class UserLogin(BaseModel):
    """
    Schema for user login with email and password.
    """
    email: EmailStr
    password: str


# ============================================
# GOOGLE OAUTH SCHEMAS
# ============================================

class GoogleAuthRequest(BaseModel):
    """
    Schema for Google OAuth login request.

    The frontend sends the authorization code received from Google's consent screen.
    """
    code: str = Field(..., description="Authorization code from Google OAuth")
    state: Optional[str] = Field(None, description="CSRF protection token")


class GoogleAuthResponse(BaseModel):
    """
    Schema for successful Google OAuth response.

    Returns JWT token and user information.
    """
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"
    is_new_user: bool = Field(..., description="True if account was just created")


# ============================================
# FORGOT PASSWORD SCHEMAS
# ============================================

class ForgotPasswordRequest(BaseModel):
    """
    Schema for forgot password request.

    User provides email to receive password reset link.
    """
    email: EmailStr = Field(..., description="Email address to send reset link")


class ForgotPasswordResponse(BaseModel):
    """
    Schema for forgot password response.

    Note: Always returns success message (even if email doesn't exist)
    to prevent email enumeration attacks.
    """
    message: str = "If that email exists, a password reset link has been sent"


class ResetPasswordRequest(BaseModel):
    """
    Schema for password reset request.

    User provides the token from email and their new password.
    """
    token: str = Field(..., description="Reset token from email link")
    new_password: str = Field(..., min_length=6, description="New password (minimum 6 characters)")

    @validator("new_password")
    def validate_password_strength(cls, v):
        """Optional: Add password strength validation"""
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        # Add more validation rules if needed:
        # - Must contain uppercase
        # - Must contain number
        # - Must contain special character
        return v


class ResetPasswordResponse(BaseModel):
    """
    Schema for successful password reset.
    """
    message: str = "Password reset successful. You can now log in with your new password."


class VerifyResetTokenRequest(BaseModel):
    """
    Schema for verifying if a reset token is valid.

    Frontend can call this before showing reset form to provide better UX.
    """
    token: str


class VerifyResetTokenResponse(BaseModel):
    """
    Schema for token verification response.
    """
    valid: bool
    message: Optional[str] = None


# ============================================
# USER RESPONSE SCHEMAS
# ============================================

class UserResponse(BaseModel):
    """
    Schema for user information in API responses.

    Excludes sensitive data like password_hash.
    Includes OAuth information if applicable.
    """
    id: int
    email: str
    role: str
    full_name: Optional[str] = None
    profile_picture: Optional[str] = None
    oauth_provider: Optional[str] = None  # "google", "github", etc.
    email_verified: bool = False
    created_at: datetime

    class Config:
        from_attributes = True  # Allows creation from SQLAlchemy models


class UserProfileUpdate(BaseModel):
    """
    Schema for updating user profile information.
    """
    full_name: Optional[str] = Field(None, max_length=255)
    accessibility_settings: Optional[dict] = None


# ============================================
# TOKEN SCHEMAS
# ============================================

class Token(BaseModel):
    """
    Schema for JWT token response after successful authentication.

    Returned by login, register, and OAuth endpoints.
    """
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenData(BaseModel):
    """
    Schema for data encoded in JWT tokens.

    Used internally for token generation and validation.
    """
    user_id: int
    email: str
    role: str
