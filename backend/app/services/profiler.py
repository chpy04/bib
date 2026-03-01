import json
import logging

from app.config import settings
from app.profiler.models import SiteProfile
from app.profiler.pipeline import ProfilerPipeline

logger = logging.getLogger(__name__)


async def profile_site(url: str, user_request: str) -> SiteProfile:
    """Run the profiler pipeline and persist the result to disk."""
    pipeline = ProfilerPipeline()
    profile = await pipeline.run(url, user_request)

    # Persist to disk
    profile_dir = settings.profiles_dir / profile.profile_id
    profile_dir.mkdir(parents=True, exist_ok=True)
    profile_path = profile_dir / "site_profile.json"
    profile_path.write_text(json.dumps(profile.model_dump(), indent=2))

    logger.info("Saved profile to %s", profile_path)
    return profile
