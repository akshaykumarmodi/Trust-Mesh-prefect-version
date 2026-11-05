from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.core.config import settings

is_sqlite = "sqlite" in settings.DATABASE_URL.lower()

engine_kwargs = {}
if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False, "timeout": 30.0}
else:
    # Production PostgreSQL connection pool configuration
    # pool_pre_ping=True tests connections prior to checkout to discard stale/idle socket drops in serverless environments
    # pool_recycle=300 recycles connections every 5 minutes to prevent DB gateway timeouts
    # pool_size and max_overflow keep serverless process connection footprints small and safe
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 10

engine = create_engine(
    settings.DATABASE_URL,
    **engine_kwargs
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
