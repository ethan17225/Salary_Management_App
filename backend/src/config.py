from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class AppConfig(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENVIRONMENT: str = "local"
    DB_PATH: str = "data/salary.db"
    PORT: int = 8000
    CORS_ORIGINS: list[str] = ["*"]
    # Local LLM fallback for paystub parsing; disabled automatically when the file is absent.
    QWEN_MODEL_PATH: str = "/opt/models/qwen2.5-0.5b-instruct-q4_k_m.gguf"

    @property
    def database_url(self) -> str:
        if self.DB_PATH == ":memory:":
            return "sqlite+aiosqlite:///:memory:"
        path = Path(self.DB_PATH)
        if not path.is_absolute():
            path = Path.cwd() / path
        return f"sqlite+aiosqlite:///{path}"


settings = AppConfig()

