from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    browser_use_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"
    instructions_file: Path = Path(__file__).parent.parent / "data" / "instructions.json"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
