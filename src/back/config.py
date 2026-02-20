"""App config: DATABASE_URL defaults to SQLite for local testing."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )
    # Set DATABASE_URL in env to override (e.g. postgresql://...)
    database_url: str = "sqlite:///./data/events.db"
    # Log level: DEBUG, INFO, WARNING, ERROR
    log_level: str = "INFO"
    # Port for uvicorn (when run via run script)
    port: int = 8000
    # CORS origins: comma-separated, or "*" for allow all (default)
    cors_origins: str = "*"


def get_cors_origins_list() -> list[str]:
    raw = getattr(settings, "cors_origins", "*").strip()
    if not raw or raw == "*":
        return ["*"]
    return [o.strip() for o in raw.split(",") if o.strip()]


settings = Settings()
