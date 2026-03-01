import logging
import uuid

from fastapi import APIRouter, HTTPException

from app.agent import verify_tasks as agent_verify_tasks
from app.llm import generate_ui as llm_generate_ui, plan_tasks as llm_plan_tasks, refine_ui as llm_refine_ui
from app.models import (
    GenerateUIRequest,
    GenerateUIResponse,
    PlanTasksRequest,
    RefineUIRequest,
    TaskPlan,
    VerifiedTask,
    VerifyTasksRequest,
    VerifyTasksResponse,
)
from app.registry import save_instruction

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
    try:
        verified = await agent_verify_tasks(req.tasks, req.url)
    except Exception as e:
        logger.exception("Task verification failed")
        raise HTTPException(status_code=502, detail=f"Verification failed: {e}")

    profile_id = str(uuid.uuid4())

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
        return GenerateUIResponse(component_code=code)
    except Exception as e:
        logger.exception("UI generation failed")
        raise HTTPException(status_code=502, detail=f"Generation failed: {e}")


@router.post("/refine", response_model=GenerateUIResponse)
async def refine(req: RefineUIRequest) -> GenerateUIResponse:
    """Call Claude to refine the React component based on user feedback."""
    try:
        code = await llm_refine_ui(req)
        return GenerateUIResponse(component_code=code)
    except Exception as e:
        logger.exception("UI refinement failed")
        raise HTTPException(status_code=502, detail=f"Refinement failed: {e}")
