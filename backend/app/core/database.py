from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Create engine for PostgreSQL (Supabase) with improved connection handling
# Optimized for scalability: pool_size + max_overflow allows up to 12 concurrent connections
engine = create_engine(
    settings.DATABASE_URL,
    poolclass=QueuePool,
    pool_pre_ping=True,
    pool_size=10,                 # Reduced from 20 to stay within Supabase limit (15)
    max_overflow=2,              # Reduced from 10 to leave headroom
    pool_recycle=300,
    pool_timeout=60,
    connect_args={
        "connect_timeout": 30,
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
