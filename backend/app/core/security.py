from datetime import datetime, timedelta
from typing import Optional
import jwt
import hashlib
import bcrypt
from app.core.config import settings

def _prepare_password(password: str) -> bytes:
    """
    Prepare password for bcrypt by hashing it with SHA256 first.
    This allows passwords of any length while staying within bcrypt's 72-byte limit.
    """
    # Hash the password with SHA256 to get a fixed-length digest
    # This ensures any length password becomes exactly 32 bytes
    return hashlib.sha256(password.encode('utf-8')).digest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash. Supports passwords of any length."""
    prepared_password = _prepare_password(plain_password)
    return bcrypt.checkpw(prepared_password, hashed_password.encode('utf-8'))

def get_password_hash(password: str) -> str:
    """Hash a password. Supports passwords of any length."""
    prepared_password = _prepare_password(password)
    # Generate salt and hash the password
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(prepared_password, salt)
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """Decode a JWT access token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except Exception:
        return None
