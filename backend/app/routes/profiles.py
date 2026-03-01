import json
import logging
import uuid

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.models import CreateProfileRequest
from app.profiler.models import SiteProfile
from app.services.auth import (
    has_active_session,
    has_saved_auth,
    start_auth_session,
    stop_auth_session,
)
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
                profile = SiteProfile(**data)
                profile.auth_configured = (child / "auth_state.json").exists()
                profiles.append(profile)
            except Exception:
                logger.exception("Failed to load profile from %s", profile_file)
    return profiles


@router.post("/profiles")
async def create_profile(req: CreateProfileRequest) -> SiteProfile:
    """Create a profile stub for a URL (no discovery yet)."""
    # Check if a profile already exists for this URL
    profiles_dir = settings.profiles_dir
    if profiles_dir.exists():
        for child in profiles_dir.iterdir():
            profile_file = child / "site_profile.json"
            if profile_file.exists():
                try:
                    data = json.loads(profile_file.read_text())
                    if data.get("base_url") == req.url:
                        profile = SiteProfile(**data)
                        profile.auth_configured = (child / "auth_state.json").exists()
                        return profile
                except Exception:
                    continue

    profile = SiteProfile(
        profile_id=str(uuid.uuid4()),
        base_url=req.url,
        name=f"Profile for {req.url}",
        description=req.request,
        tasks=[],
    )

    profile_dir = settings.profiles_dir / profile.profile_id
    profile_dir.mkdir(parents=True, exist_ok=True)
    profile_path = profile_dir / "site_profile.json"
    profile_path.write_text(json.dumps(profile.model_dump(), indent=2))

    return profile


@router.post("/profiles/{profile_id}/discover")
async def discover_profile(profile_id: str) -> SiteProfile:
    """Run the profiler pipeline (decompose + discover) for an existing profile."""
    profile_file = settings.profiles_dir / profile_id / "site_profile.json"
    if not profile_file.exists():
        raise HTTPException(status_code=404, detail="Profile not found")

    data = json.loads(profile_file.read_text())
    existing = SiteProfile(**data)

    profile = await profile_site(existing.base_url, existing.description)
    profile.auth_configured = has_saved_auth(profile_id)
    return profile


@router.get("/profiles/{profile_id}")
async def get_profile(profile_id: str) -> SiteProfile:
    """Get a specific profile config."""
    profile_file = settings.profiles_dir / profile_id / "site_profile.json"
    if not profile_file.exists():
        raise HTTPException(status_code=404, detail="Profile not found")

    data = json.loads(profile_file.read_text())
    profile = SiteProfile(**data)
    profile.auth_configured = (
        settings.profiles_dir / profile_id / "auth_state.json"
    ).exists()
    return profile


@router.post("/profiles/{profile_id}/auth")
async def begin_auth(profile_id: str):
    """Open a browser for the user to manually log in."""
    profile_file = settings.profiles_dir / profile_id / "site_profile.json"
    if not profile_file.exists():
        raise HTTPException(status_code=404, detail="Profile not found")

    if has_active_session(profile_id):
        raise HTTPException(status_code=409, detail="Auth session already active")

    data = json.loads(profile_file.read_text())
    profile = SiteProfile(**data)

    await start_auth_session(profile_id, profile.base_url)
    return {"status": "started", "profile_id": profile_id}


@router.delete("/profiles/{profile_id}/auth")
async def finish_auth(profile_id: str):
    """Close the auth browser and save cookies."""
    stopped = await stop_auth_session(profile_id)
    if not stopped:
        raise HTTPException(status_code=404, detail="No active auth session")

    return {
        "status": "completed",
        "profile_id": profile_id,
        "auth_saved": has_saved_auth(profile_id),
    }


@router.get("/profiles/{profile_id}/auth")
async def auth_status(profile_id: str):
    """Check auth state for a profile."""
    return {
        "profile_id": profile_id,
        "active_session": has_active_session(profile_id),
        "has_saved_auth": has_saved_auth(profile_id),
    }
