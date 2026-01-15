from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Create engine for PostgreSQL (Supabase) with improved connection handling
# Supabase free tier limits: Session mode = 15 connections max
# Keep pool_size + max_overflow <= 10 to stay well under the limit
engine = create_engine(
    settings.DATABASE_URL,
    poolclass=QueuePool,
    pool_pre_ping=True,          # Test connections before using
    pool_size=5,                 # Reduced from 10 to 5 for Supabase free tier
    max_overflow=5,              # Reduced from 10 to 5 (total max = 10 connections)
    pool_recycle=3600,           # Recycle connections after 1 hour
    pool_timeout=30,             # Wait 30 seconds for connection
    connect_args={
        "connect_timeout": 30,    # Connection timeout in seconds
        "keepalives": 1,          # Enable TCP keepalives
        "keepalives_idle": 30,    # Seconds before sending keepalive
        "keepalives_interval": 10, # Seconds between keepalives
        "keepalives_count": 5     # Number of keepalives before giving up
    }
)

# Create session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# Dependency for FastAPI with connection retry
def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Database session error: {e}")
        db.rollback()
        raise
    finally:
        db.close()
