import json
import logging
from datetime import datetime, timezone

from app.config import settings

logger = logging.getLogger(__name__)


def _instructions_path(profile_id: str):
    return settings.profiles_dir / profile_id / "instructions.json"


def _meta_path(profile_id: str):
    return settings.profiles_dir / profile_id / "meta.json"


def save_profile_meta(profile_id: str, meta: dict) -> None:
    path = _meta_path(profile_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(meta, indent=2))


def load_profile_meta(profile_id: str) -> dict:
    path = _meta_path(profile_id)
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def list_profiles() -> list[dict]:
    """Scan profiles_dir and return metadata for each profile."""
    profiles_dir = settings.profiles_dir
    if not profiles_dir.exists():
        return []
    results = []
    for entry in sorted(profiles_dir.iterdir()):
        if not entry.is_dir():
            continue
        profile_id = entry.name
        meta = load_profile_meta(profile_id)
        instructions = load_registry(profile_id)
        results.append(
            {
                "id": profile_id,
                "url": meta.get("url", ""),
                "site_name": meta.get("site_name", ""),
                "created_at": meta.get("created_at", ""),
                "tool_count": len(instructions),
            }
        )
    return results


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


def _cache_path(profile_id: str):
    return settings.profiles_dir / profile_id / "cache.json"


def _load_cache(profile_id: str) -> dict:
    path = _cache_path(profile_id)
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _save_cache(profile_id: str, cache: dict) -> None:
    path = _cache_path(profile_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, indent=2, default=str))


def save_cached_data(profile_id: str, instruction_name: str, data: object) -> None:
    """Persist scraped data into cache.json keyed by instruction name."""
    cache = _load_cache(profile_id)
    cache[instruction_name] = {
        "data": data,
        "cached_at": datetime.now(timezone.utc).isoformat(),
    }
    _save_cache(profile_id, cache)


def get_cached_data(profile_id: str, instruction_name: str) -> dict | None:
    """Return {data, cached_at} if cache exists, else None."""
    cache = _load_cache(profile_id)
    entry = cache.get(instruction_name)
    if entry is None:
        return None
    return {"data": entry["data"], "cached_at": entry.get("cached_at")}


# ── Dashboard persistence ────────────────────────────────────────────────────


def _dashboard_path(profile_id: str):
    return settings.profiles_dir / profile_id / "dashboard.json"


def save_dashboard(profile_id: str, data: dict) -> None:
    path = _dashboard_path(profile_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, default=str))


def load_dashboard(profile_id: str) -> dict | None:
    path = _dashboard_path(profile_id)
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def list_dashboards() -> list[dict]:
    """Scan all profile dirs for dashboard.json and return summaries."""
    results = []
    if not settings.profiles_dir.exists():
        return results
    for d in sorted(settings.profiles_dir.iterdir()):
        if not d.is_dir():
            continue
        dash_path = d / "dashboard.json"
        if not dash_path.exists():
            continue
        try:
            with dash_path.open("r", encoding="utf-8") as f:
                data = json.load(f)
            results.append({
                "profile_id": d.name,
                "name": data.get("name", d.name),
                "url": data.get("url", ""),
                "prompt": data.get("prompt", ""),
                "created_at": data.get("created_at", ""),
            })
        except (json.JSONDecodeError, OSError):
            continue
    return results
