import logging
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException

from app.agent import verify_tasks as agent_verify_tasks
from app.llm import generate_ui as llm_generate_ui
from app.llm import plan_tasks as llm_plan_tasks
from app.llm import refine_ui as llm_refine_ui
from app.models import (
    GenerateUIRequest,
    GenerateUIResponse,
    PlanTasksRequest,
    RefineUIRequest,
    TaskPlan,
    VerifyTasksRequest,
    VerifyTasksResponse,
)
from app.registry import (
    load_dashboard,
    save_dashboard,
    save_instruction,
    save_profile_meta,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/plan", response_model=TaskPlan)
async def plan(req: PlanTasksRequest) -> TaskPlan:
    """Call Claude to decompose the user prompt into a structured task plan."""
    try:
        return await llm_plan_tasks(req.url, req.prompt)
    except Exception as e:
        logger.exception("Task planning failed")
        raise HTTPException(status_code=502, detail=f"Planning failed: {e}")


@router.post("/verify", response_model=VerifyTasksResponse)
async def verify(req: VerifyTasksRequest) -> VerifyTasksResponse:
    """Run Browser Use agents in parallel to verify tasks and write results to registry."""
    profile_id = req.profile_id

    try:
        verified = await agent_verify_tasks(req.tasks, req.url, profile_id)
    except Exception as e:
        logger.exception("Task verification failed")
        raise HTTPException(status_code=502, detail=f"Verification failed: {e}")

    parsed = urlparse(req.url)
    site_name = parsed.netloc.replace("www.", "")
    save_profile_meta(
        profile_id,
        {
            "url": req.url,
            "site_name": site_name,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    )

    for task in verified:
        save_instruction(
            profile_id,
            {
                "name": task.id,
                "description": task.description,
                "instructions": task.instructions,
                "output_schema": task.output_schema,
                "sample_output": task.sample_output,
                "display_hint": task.display_hint,
                "type": task.type,
            },
        )

    return VerifyTasksResponse(profile_id=profile_id, verified_tasks=verified)


@router.post("/generate", response_model=GenerateUIResponse)
async def generate(req: GenerateUIRequest) -> GenerateUIResponse:
    """Call Claude to generate the React component from verified tasks."""
    try:
        code = await llm_generate_ui(req.verified_tasks, req.layout_hint)
        save_dashboard(
            req.profile_id,
            {
                "name": req.profile_id,
                "component_code": code,
                "verified_tasks": [t.model_dump() for t in req.verified_tasks],
                "layout_hint": req.layout_hint,
                "chat_history": [],
                "url": req.url,
                "prompt": req.prompt,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        return GenerateUIResponse(component_code=code)
    except Exception as e:
        logger.exception("UI generation failed")
        raise HTTPException(status_code=502, detail=f"Generation failed: {e}")


@router.post("/refine", response_model=GenerateUIResponse)
async def refine(req: RefineUIRequest) -> GenerateUIResponse:
    """Call Claude to refine the React component based on user feedback."""
    try:
        code = await llm_refine_ui(req)
        existing = load_dashboard(req.profile_id) or {}
        updated_history = req.chat_history + [req.refinement]
        save_dashboard(
            req.profile_id,
            {
                "name": existing.get("name", req.profile_id),
                "component_code": code,
                "verified_tasks": [t.model_dump() for t in req.verified_tasks],
                "layout_hint": req.layout_hint,
                "chat_history": updated_history,
                "url": existing.get("url", ""),
                "prompt": existing.get("prompt", ""),
                "created_at": existing.get("created_at", ""),
            },
        )
        return GenerateUIResponse(component_code=code)
    except Exception as e:
        logger.exception("UI refinement failed")
        raise HTTPException(status_code=502, detail=f"Refinement failed: {e}")
