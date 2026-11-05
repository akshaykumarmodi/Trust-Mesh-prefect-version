import os
# Ensure test suite runs in isolated test environment without sending real external emails
os.environ["GMAIL_USER"] = ""
os.environ["GMAIL_APP_PASSWORD"] = ""
os.environ["SMTP_USER"] = ""
os.environ["SMTP_PASSWORD"] = ""
os.environ["RESEND_API_KEY"] = ""
os.environ["EMAIL_PROVIDER"] = "auto"

from app.core.config import settings
settings.GMAIL_USER = ""
settings.GMAIL_APP_PASSWORD = ""
settings.SMTP_USER = ""
settings.SMTP_PASSWORD = ""
settings.RESEND_API_KEY = ""
settings.EMAIL_PROVIDER = "auto"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.session import Base, get_db
from app.main import app
from app.services.seed_data import seed_database

# Shared in-memory test database with StaticPool
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="session", autouse=True)
def initialize_database():
    Base.metadata.create_all(bind=test_engine)
    db = TestSession()
    seed_database(db, reset=True)
    db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture
def db_session():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
