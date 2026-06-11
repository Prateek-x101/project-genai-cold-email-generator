import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Server Info
    PROJECT_NAME: str = "ColdCraft AI API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # API Keys fallback (normally passed in requests from extension storage)
    GROQ_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""

    # Database
    CHROMADB_PATH: str = "vectorstore"

    # CORS Origins
    CORS_ORIGINS: List[str] = [
        "chrome-extension://*",
        "http://localhost:*",
        "http://127.0.0.1:*",
    ]

settings = Settings()
