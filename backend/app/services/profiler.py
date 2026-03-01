import json
import logging

from app.config import settings
from app.profiler.models import SiteProfile, TaskProfile, TaskType
from app.profiler.pipeline import ProfilerPipeline
from app.services.auth import auth_state_path, has_saved_auth
from app.services.browser_agent import load_registry, save_registry

logger = logging.getLogger(__name__)


def _find_existing_profile_id(url: str) -> str | None:
    """Find an existing profile whose base_url matches the given URL."""
    profiles_dir = settings.profiles_dir
    if not profiles_dir.exists():
        return None

    for child in profiles_dir.iterdir():
        profile_file = child / "site_profile.json"
        if profile_file.exists():
            try:
                data = json.loads(profile_file.read_text())
                if data.get("base_url") == url:
                    return data.get("profile_id")
            except Exception:
                continue
    return None


def _task_profile_to_instruction(task: TaskProfile, profile_id: str) -> dict:
    """
    Convert a TaskProfile from the profiler into a flat instruction registry entry.

    Maps:
      TaskProfile.name          → instruction key
      TaskProfile.agent_prompt  → instructions (what the agent runs at runtime)
      TaskProfile.output_schema → output_schema (fields + is_list + sample_data)
      TaskProfile.type          → type ("data" or "action")
      profile_id                → profile_id (tells runtime which auth to use)
    """
    # Convert OutputSchema to a simple dict the runtime can use
    # Use the fields dict as the schema shape; wrap in a list if is_list
    schema = task.output_schema.fields if task.output_schema else {}
    if task.output_schema and task.output_schema.is_list:
        schema = [schema]

    return {
        "name": task.name,
        "profile_id": profile_id,
        "description": task.description,
        "instructions": task.agent_prompt,
        "output_schema": schema,
        "sample_data": task.output_schema.sample_data if task.output_schema else None,
        "display_hint": "card_list" if (task.output_schema and task.output_schema.is_list) else "value",
        "type": "data" if task.type == TaskType.DATA_READ else "action",
    }


def _write_tasks_to_registry(profile: SiteProfile) -> None:
    """
    Write all tasks from a SiteProfile into the instruction registry.
    Existing entries with the same name are overwritten so re-discovery
    always reflects the latest agent_prompt and schema.
    """
    try:
        registry = load_registry()
    except (FileNotFoundError, json.JSONDecodeError):
        registry = {}

    added = []
    for task in profile.tasks:
        entry = _task_profile_to_instruction(task, profile.profile_id)
        registry[task.name] = entry
        added.append(task.name)

    save_registry(registry)
    logger.info(
        "Wrote %d tasks to instruction registry for profile %s: %s",
        len(added),
        profile.profile_id,
        added,
    )


async def profile_site(url: str, user_request: str) -> SiteProfile:
    """Run the profiler pipeline and persist the result to disk.

    After saving the SiteProfile, each discovered task is written into
    the instruction registry so GET /api/data/{instruction_name} can
    execute them using the correct profile auth.

    If a profile already exists for this URL, it is updated in place
    (preserving its profile_id and auth_state.json).
    """
    existing_id = _find_existing_profile_id(url)

    # Use saved auth state if the profile has one
    storage_state = None
    if existing_id and has_saved_auth(existing_id):
        storage_state = str(auth_state_path(existing_id))

    pipeline = ProfilerPipeline()
    profile = await pipeline.run(
        url, user_request, storage_state=storage_state, profile_id=existing_id
    )

    # Persist SiteProfile to disk
    profile_dir = settings.profiles_dir / profile.profile_id
    profile_dir.mkdir(parents=True, exist_ok=True)
    profile_path = profile_dir / "site_profile.json"
    profile_path.write_text(json.dumps(profile.model_dump(), indent=2))
    logger.info("Saved profile to %s", profile_path)

    # Bridge: write discovered tasks into the instruction registry
    _write_tasks_to_registry(profile)

    return profile
