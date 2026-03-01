import json
import logging

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.models import CreateProfileRequest
from app.profiler.models import SiteProfile
from app.services.profiler import profile_site

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/profiles")
async def list_profiles() -> list[SiteProfile]:
    """List all saved profiles."""
    profiles: list[SiteProfile] = []
    profiles_dir = settings.profiles_dir
    if not profiles_dir.exists():
        return profiles

    for child in sorted(profiles_dir.iterdir()):
        profile_file = child / "site_profile.json"
        if profile_file.exists():
            try:
                data = json.loads(profile_file.read_text())
                profiles.append(SiteProfile(**data))
            except Exception:
                logger.exception("Failed to load profile from %s", profile_file)
    return profiles


@router.post("/profiles")
async def create_profile(req: CreateProfileRequest) -> SiteProfile:
    """Create a new profile by profiling a URL."""
    profile = await profile_site(req.url, req.request)
    return profile


@router.get("/profiles/{profile_id}")
async def get_profile(profile_id: str) -> SiteProfile:
    """Get a specific profile config."""
    profile_file = settings.profiles_dir / profile_id / "site_profile.json"
    if not profile_file.exists():
        raise HTTPException(status_code=404, detail="Profile not found")

    data = json.loads(profile_file.read_text())
    return SiteProfile(**data)
