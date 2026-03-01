import json
import logging

from app.config import settings
from app.profiler.models import SiteProfile
from app.profiler.pipeline import ProfilerPipeline
from app.services.auth import auth_state_path, has_saved_auth

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


async def profile_site(url: str, user_request: str) -> SiteProfile:
    """Run the profiler pipeline and persist the result to disk.

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

    # Persist to disk
    profile_dir = settings.profiles_dir / profile.profile_id
    profile_dir.mkdir(parents=True, exist_ok=True)
    profile_path = profile_dir / "site_profile.json"
    profile_path.write_text(json.dumps(profile.model_dump(), indent=2))

    logger.info("Saved profile to %s", profile_path)
    return profile
