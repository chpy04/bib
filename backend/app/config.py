from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    minimax_api_key: str = ""
    browser_use_api_key: str = ""
    openai_api_key: str = ""
    profiles_dir: Path = Path(__file__).parent.parent / "profiles"
    anthropic_api_key: str = ""
    llm_provider: str = "openai"
    cdp_url: str = ""
    instructions_file: Path = Path(__file__).parent.parent / "data" / "instructions.json"

    class Config:
        env_file = ".env"


settings = Settings()
