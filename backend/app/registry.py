import json
import logging

from app.config import settings

logger = logging.getLogger(__name__)


def _instructions_path(profile_id: str):
    return settings.profiles_dir / profile_id / "instructions.json"


def load_registry(profile_id: str) -> dict:
    path = _instructions_path(profile_id)
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_registry(profile_id: str, registry: dict) -> None:
    path = _instructions_path(profile_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(registry, indent=2))


def get_instruction(profile_id: str, name: str) -> dict | None:
    return load_registry(profile_id).get(name)


def save_instruction(profile_id: str, instruction: dict) -> None:
    registry = load_registry(profile_id)
    registry[instruction["name"]] = instruction
    save_registry(profile_id, registry)


def list_instructions(profile_id: str) -> list[dict]:
    return list(load_registry(profile_id).values())
