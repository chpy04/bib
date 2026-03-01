import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from app.config import settings
from app.models import CreateProfileRequest, RunRequest
from app.services.generator import generate_ui

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


@router.post("/run")
async def run(req: RunRequest):
    """Generate a React component from a URL and prompt using Dedalus Labs LLM."""
    if not settings.dedalus_api_key:
        raise HTTPException(status_code=500, detail="DEDALUS_API_KEY is not configured")

    try:
        component_code = await generate_ui(req.url, req.prompt)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM generation failed: {e}")

    # Save the generation result
    generation_id = uuid.uuid4().hex[:12]
    record = {
        "id": generation_id,
        "url": req.url,
        "prompt": req.prompt,
        "component_code": component_code,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    settings.profiles_dir.mkdir(parents=True, exist_ok=True)
    output_path = settings.profiles_dir / f"{generation_id}.json"
    output_path.write_text(json.dumps(record, indent=2))

    return {"component_code": component_code}
