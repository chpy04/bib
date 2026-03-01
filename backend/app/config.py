from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    dedalus_api_key: str = ""
    browser_use_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    profiles_dir: Path = Path(__file__).parent.parent / "profiles"
    llm_provider: str = "openai"
    openai_model: str = "gpt-4o"
    anthropic_model: str = "claude-sonnet-4-20250514"
    cdp_url: str = ""
    instructions_file: Path = Path(__file__).parent.parent / "data" / "instructions.json"

    class Config:
        env_file = ".env"


settings = Settings()
