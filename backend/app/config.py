from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    minimax_api_key: str = ""
    browser_use_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    profiles_dir: Path = Path(__file__).parent.parent / "profiles"

    class Config:
        env_file = ".env"


settings = Settings()
