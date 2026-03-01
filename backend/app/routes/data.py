import asyncio
import logging

from fastapi import APIRouter, HTTPException, Query

from app.agent import run_instruction
from app.registry import get_instruction, list_instructions

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/instructions")
async def instructions(profile_id: str = Query(...)):
    """List all entries in the instruction registry."""
    return list_instructions(profile_id)


@router.get("/data/{instruction_name}")
async def get_data(instruction_name: str, profile_id: str = Query(...)):
    """Execute a named data instruction and return the result."""
    if get_instruction(profile_id, instruction_name) is None:
        raise HTTPException(
            status_code=404,
            detail=f"Instruction '{instruction_name}' not found",
        )

    result = await run_instruction(instruction_name, profile_id)
    if not result["success"]:
        raise HTTPException(
            status_code=502,
            detail=result.get("error", "Instruction execution failed"),
        )

    return result


@router.post("/action/{instruction_name}")
async def execute_action(instruction_name: str, profile_id: str = Query(...)):
    """Execute a named action instruction, then re-fetch all data instructions.

    Returns { success, data } where data is a dict of {instruction_name: fresh_data}.
    """
    if get_instruction(profile_id, instruction_name) is None:
        raise HTTPException(
            status_code=404,
            detail=f"Instruction '{instruction_name}' not found",
        )

    action_result = await run_instruction(instruction_name, profile_id)
    if not action_result["success"]:
        raise HTTPException(
            status_code=502,
            detail=action_result.get("error", "Action execution failed"),
        )

    # Re-fetch all data instructions in parallel
    all_instructions = list_instructions(profile_id)
    data_instructions = [i for i in all_instructions if i.get("type") == "data"]

    fresh_data: dict = {}
    if data_instructions:
        results = await asyncio.gather(
            *[run_instruction(i["name"], profile_id) for i in data_instructions],
            return_exceptions=True,
        )
        for instr, res in zip(data_instructions, results):
            if not isinstance(res, Exception) and res.get("success"):
                fresh_data[instr["name"]] = res["data"]

    return {"success": True, "data": fresh_data}
