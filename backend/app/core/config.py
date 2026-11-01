import os
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "TrustMesh"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./trustmesh.db")
    
    # Open-Weight AI Model Settings (GPT-OSS-120B)
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    AI_MODEL_NAME: str = os.getenv("AI_MODEL_NAME", "gpt-oss-120b")
    AI_API_BASE_URL: str = os.getenv("AI_API_BASE_URL", "https://openrouter.ai/api/v1")
    
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

settings = Settings()
