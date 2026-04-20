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
    pool_pre_ping=True,          # Test connections before using — retries on stale conn
    pool_size=3,                 # Supabase free tier: keep total connections low
    max_overflow=2,              # Total max = 5 connections
    pool_recycle=300,            # Recycle every 5 min — Supabase pooler drops idle after ~5 min
    pool_timeout=30,             # Wait 30 seconds for connection
    connect_args={
        "connect_timeout": 30,   # Connection timeout in seconds
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
