from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppConfig(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENVIRONMENT: str = "local"
    DB_PATH: str = "data/salary.db"
    PORT: int = 8000
    CORS_ORIGINS: list[str] = ["*"]

    # Switch: "local" uses host Vision AI (Ollama Metal GPU); "docker" stays inside container
    OCR_RUNTIME: Literal["docker", "local"] = "docker"
    VISION_API_BASE_URL: str | None = None
    VISION_MODEL_NAME: str = "qwen2.5vl:3b"
    VISION_API_KEY: str = "ollama"
    VISION_TIMEOUT_SECONDS: float = 45.0

    # Local LLM fallback for paystub parsing; disabled automatically when the file is absent.
    QWEN_MODEL_PATH: str = "/opt/models/qwen2.5-0.5b-instruct-q4_k_m.gguf"
    MAX_SINGLE_PAYCHEQUE_WARN_CENTS: int = 2_500_000  # $25,000.00 outlier warning threshold

    @field_validator("OCR_RUNTIME", mode="before")
    @classmethod
    def normalize_ocr_runtime(cls, value: object) -> str:
        return str(value or "docker").strip().lower()

    @property
    def effective_vision_base_url(self) -> str | None:
        if self.OCR_RUNTIME != "local":
            return None
        url = (self.VISION_API_BASE_URL or "").strip()
        return url or "http://host.docker.internal:11434/v1"

    @property
    def database_url(self) -> str:
        if self.DB_PATH == ":memory:":
            return "sqlite+aiosqlite:///:memory:"
        path = Path(self.DB_PATH)
        if not path.is_absolute():
            path = Path.cwd() / path
        return f"sqlite+aiosqlite:///{path}"


settings = AppConfig()
