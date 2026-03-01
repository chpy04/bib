import json
import logging

from app.config import settings

logger = logging.getLogger(__name__)


def load_registry() -> dict:
    path = settings.instructions_file
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_registry(registry: dict) -> None:
    path = settings.instructions_file
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(registry, indent=2))


def get_instruction(name: str) -> dict | None:
    return load_registry().get(name)


def save_instruction(instruction: dict) -> None:
    registry = load_registry()
    registry[instruction["name"]] = instruction
    save_registry(registry)


def list_instructions() -> list[dict]:
    return list(load_registry().values())
