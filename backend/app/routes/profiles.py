import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agent import verify_task as agent_verify_task
from app.llm import plan_tasks as llm_plan_tasks
from app.registry import (
    list_instructions,
    list_profiles,
    load_profile_meta,
    save_instruction,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/profiles")
async def get_profiles():
    """List all profiles with metadata."""
    return list_profiles()


@router.get("/profiles/{profile_id}")
async def get_profile(profile_id: str):
    """Get a single profile's metadata and all its tools."""
    meta = load_profile_meta(profile_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Profile not found")
    tools = list_instructions(profile_id)
    return {**meta, "id": profile_id, "tools": tools}


class AddToolRequest(BaseModel):
    prompt: str


@router.post("/profiles/{profile_id}/tools")
async def add_tool(profile_id: str, req: AddToolRequest):
    """Plan and verify a single new tool, append it to an existing profile."""
    meta = load_profile_meta(profile_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Profile not found")

    url = meta["url"]

    try:
        plan = await llm_plan_tasks(url, req.prompt)
    except Exception as e:
        logger.exception("Planning failed for add_tool")
        raise HTTPException(status_code=502, detail=f"Planning failed: {e}")

    if not plan.tasks:
        raise HTTPException(
            status_code=422, detail="Could not plan any tasks from the prompt"
        )

    task = plan.tasks[0]

    try:
        verified = await agent_verify_task(task, url)
    except Exception as e:
        logger.exception("Verification failed for add_tool")
        raise HTTPException(status_code=502, detail=f"Verification failed: {e}")

    if verified is None:
        raise HTTPException(
            status_code=502, detail="Agent could not verify the task"
        )

    save_instruction(
        profile_id,
        {
            "name": verified.id,
            "description": verified.description,
            "instructions": verified.instructions,
            "output_schema": verified.output_schema,
            "sample_output": verified.sample_output,
            "display_hint": verified.display_hint,
            "type": verified.type,
        },
    )

    return {
        "id": verified.id,
        "description": verified.description,
        "instructions": verified.instructions,
        "output_schema": verified.output_schema,
        "sample_output": verified.sample_output,
        "display_hint": verified.display_hint,
        "type": verified.type,
    }
