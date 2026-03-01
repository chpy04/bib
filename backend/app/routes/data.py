import asyncio
import logging

from fastapi import APIRouter, HTTPException, Query

from app.agent import run_instruction
from app.registry import get_cached_data, get_instruction, list_dashboards, list_instructions, load_dashboard, save_cached_data

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/dashboards")
async def dashboards():
    """List all saved dashboards."""
    return list_dashboards()


@router.get("/dashboards/{profile_id}")
async def dashboard_detail(profile_id: str):
    """Load a saved dashboard by profile_id."""
    data = load_dashboard(profile_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    data["profile_id"] = profile_id
    return data


@router.get("/instructions")
async def instructions(profile_id: str = Query(...)):
    """List all entries in the instruction registry."""
    return list_instructions(profile_id)


@router.get("/data/{instruction_name}")
async def get_data(
    instruction_name: str,
    profile_id: str = Query(...),
    refresh: bool = Query(False),
):
    """Return cached data for an instruction, or re-scrape when refresh=true."""
    if get_instruction(profile_id, instruction_name) is None:
        raise HTTPException(
            status_code=404,
            detail=f"Instruction '{instruction_name}' not found",
        )

    # Serve from cache unless the caller explicitly asks for a refresh.
    # Skip empty cache (e.g. [] from a failed verification) and re-fetch.
    if not refresh:
        cached = get_cached_data(profile_id, instruction_name)
        if cached is not None and cached["data"]:
            return {
                "instruction_name": instruction_name,
                "data": cached["data"],
                "cached_at": cached["cached_at"],
                "success": True,
            }

    result = await run_instruction(instruction_name, profile_id)
    if not result["success"]:
        raise HTTPException(
            status_code=502,
            detail=result.get("error", "Instruction execution failed"),
        )

    # Cache the fresh result
    save_cached_data(profile_id, instruction_name, result["data"])

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
                save_cached_data(profile_id, instr["name"], res["data"])

    return {"success": True, "data": fresh_data}
