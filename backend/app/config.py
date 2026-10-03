from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
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
    storage_provider: Literal["local", "s3", "blob"] = "local"
    private_blob_read_write_token: str = ""
    private_file_writes_paused: bool = False
    media_base_url: str = "http://localhost:8010/media"
    legacy_media_base_urls: list[str] = [
        "https://studyhubai-bar8.onrender.com/media", "https://nexamin.id.vn/media",
    ]
    max_upload_bytes: int = Field(default=25 * 1024 * 1024, ge=1, le=50 * 1024 * 1024)
    upload_concurrency: int = Field(default=2, ge=1, le=4)
    upload_body_timeout_seconds: float = Field(default=120, ge=0.1, le=300)
    document_archive_max_bytes: int = Field(default=48 * 1024 * 1024, ge=1)
    document_archive_max_member_bytes: int = Field(default=16 * 1024 * 1024, ge=1)
    document_archive_max_entries: int = Field(default=2048, ge=1, le=4096)
    document_archive_max_ratio: int = Field(default=200, ge=1)
    document_max_pages: int = Field(default=500, ge=1, le=2000)
    document_max_text_bytes: int = Field(default=1024 * 1024, ge=1, le=4 * 1024 * 1024)
    document_max_chunks: int = Field(default=4000, ge=1, le=8000)
    document_parser_memory_mib: int = Field(default=256, ge=128, le=512)
    document_parser_cpu_seconds: int = Field(default=15, ge=1, le=60)
    document_parser_timeout_seconds: float = Field(default=20, ge=0.1, le=120)
    document_parser_concurrency: int = Field(default=1, ge=1, le=2)

    llm_provider: Literal["local", "gemini", "openai-compatible"] = "gemini"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    gemini_daily_user_limit: int = Field(default=5, ge=0)
    openai_compatible_base_url: str = ""
    openai_compatible_api_key: str = ""
    openai_compatible_model: str = ""
    embedding_dimensions: int = 768
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8010/api/v1/auth/google/callback"
    public_site_url: str = "http://localhost:5173"
    resend_api_key: str = ""
    mail_from_email: str = ""

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

    @model_validator(mode="after")
    def secure_production_configuration(self) -> "Settings":
        if self.app_env == "production":
            if self.jwt_secret == "development-secret-change-before-production-123456":
                raise ValueError("JWT_SECRET must not use the published development key in production")
            if "*" in self.cors_origins:
                raise ValueError("CORS origins must be explicit in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
