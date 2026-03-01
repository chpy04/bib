from fastapi import APIRouter
from app.models import CreateProfileRequest

router = APIRouter()


@router.get("/profiles")
async def list_profiles():
    """List all saved profiles."""
    # TODO: scan profiles/ directory and return list
    return []


@router.post("/profiles")
async def create_profile(req: CreateProfileRequest):
    """Create a new profile by profiling a URL."""
    # TODO: run profiling agent, generate UI, save profile
    return {"profile_id": "placeholder", "status": "not_implemented"}


@router.get("/profiles/{profile_id}")
async def get_profile(profile_id: str):
    """Get a specific profile config."""
    # TODO: load from profiles/{profile_id}/profile.json
    return {"profile_id": profile_id, "status": "not_implemented"}


@router.get("/profiles/{profile_id}/component")
async def get_component(profile_id: str):
    """Get the generated React component code."""
    # TODO: return component_code from profile
    return {"component_code": None, "status": "not_implemented"}
