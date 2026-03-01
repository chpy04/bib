from fastapi import APIRouter, HTTPException

from app.services.browser_agent import (
    AUTH_STATE_PATH,
    get_instruction,
    load_registry,
    run_instruction,
)

router = APIRouter()


@router.get("/instructions")
async def list_instructions() -> dict:
    """
    Return all entries in the instruction registry.
    Populated automatically after POST /api/profiles/{id}/discover.
    """
    try:
        return load_registry()
    except FileNotFoundError:
        raise HTTPException(
            status_code=500, detail={"error": "Instruction registry not found"}
        )


@router.get("/instructions/{instruction_name}")
async def get_instruction_detail(instruction_name: str) -> dict:
    """Return a single instruction entry by name."""
    try:
        return get_instruction(instruction_name)
    except KeyError:
        raise HTTPException(
            status_code=404,
            detail={"error": "Instruction not found", "instruction_name": instruction_name},
        )


@router.get("/auth/status")
async def global_auth_status() -> dict:
    """Check whether a global fallback auth state exists (data/auth.json)."""
    return {
        "authenticated": AUTH_STATE_PATH.exists(),
        "auth_file": str(AUTH_STATE_PATH) if AUTH_STATE_PATH.exists() else None,
        "note": "Per-profile auth is managed via /api/profiles/{id}/auth",
    }


@router.get("/data/{instruction_name}")
async def execute_instruction(instruction_name: str) -> dict:
    """
    Execute a named instruction via a Browser Use agent and return the result.
    Automatically uses the profile-specific auth state stored in
    profiles/{profile_id}/auth_state.json if the instruction has a profile_id.

    - 200: agent ran successfully
    - 404: instruction name not found in registry
    - 503: browser not available
    - 500: agent execution failed
    """
    try:
        result = await run_instruction(instruction_name)

        if not result["success"]:
            error_msg = result.get("error", "")
            if "connection" in error_msg.lower() or "browser" in error_msg.lower():
                raise HTTPException(
                    status_code=503,
                    detail={"error": "Browser not available", "detail": error_msg},
                )
            raise HTTPException(
                status_code=500,
                detail={"error": "Agent execution failed", "detail": error_msg},
            )

        return result

    except HTTPException:
        raise
    except KeyError:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "Instruction not found",
                "instruction_name": instruction_name,
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "Unexpected server error", "detail": str(e)},
        )
