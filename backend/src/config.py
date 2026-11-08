from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class AppConfig(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENVIRONMENT: str = "local"
    DB_PATH: str = "data/salary.db"
    PORT: int = 8000
    CORS_ORIGINS: list[str] = ["*"]

    @property
    def database_url(self) -> str:
        if self.DB_PATH == ":memory:":
            return "sqlite+aiosqlite:///:memory:"
        path = Path(self.DB_PATH)
        if not path.is_absolute():
            path = Path.cwd() / path
        return f"sqlite+aiosqlite:///{path}"


settings = AppConfig()

