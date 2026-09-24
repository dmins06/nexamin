from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_env: Literal["development", "test", "production"] = "development"
    app_name: str = "Nexamin"
    assistant_name: str = "Emin AI"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+asyncpg://studyhub:studyhub@localhost:5432/studyhub"
    redis_url: str = "redis://localhost:6379/0"
    rate_limit_enabled: bool = True
    jwt_secret: str = Field(default="development-secret-change-before-production-123456")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    cors_origins: list[str] | str = ["http://localhost:5173"]

    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "studyhub"
    s3_secret_key: str = "change-me"
    s3_bucket: str = "studyhub-documents"
    s3_region: str = "us-east-1"
    storage_provider: Literal["local", "s3"] = "local"
    media_base_url: str = "http://localhost:8010/media"
    max_upload_bytes: int = 25 * 1024 * 1024

    llm_provider: Literal["auto", "local", "ollama", "openai-compatible"] = "auto"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen3:4b"
    ollama_api_key: str = ""
    embedding_provider: Literal["local", "ollama"] = "local"
    openai_compatible_base_url: str = ""
    openai_compatible_api_key: str = ""
    openai_compatible_model: str = ""
    embedding_model: str = "nomic-embed-text"
    embedding_dimensions: int = 768
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8010/api/v1/auth/google/callback"

    chunk_size: int = 900
    chunk_overlap: int = 150
    rag_top_k: int = 12
    rerank_top_k: int = 5
    max_context_tokens: int = 5000

    @field_validator("database_url", mode="before")
    @classmethod
    def use_async_database_driver(cls, value: object) -> object:
        if isinstance(value, str) and value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+asyncpg://", 1)
        if isinstance(value, str) and value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+asyncpg://", 1)
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("jwt_secret")
    @classmethod
    def secure_production_secret(cls, value: str, info: object) -> str:
        if len(value) < 32:
            raise ValueError("JWT_SECRET must contain at least 32 characters")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
