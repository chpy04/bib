from fastapi import APIRouter, HTTPException
from app.services.browser_agent import load_registry, run_instruction

router = APIRouter()


@router.get("/instructions")
async def list_instructions():
    """List all available instructions."""
    try:
        return load_registry()
    except FileNotFoundError:
        raise HTTPException(
            status_code=500, detail={"error": "Instruction registry not found"}
        )


@router.get("/data/{instruction_name}")
async def execute_instruction(instruction_name: str):
    """Execute an instruction and return data."""
    try:
        return await run_instruction(instruction_name)
    except KeyError:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "Instruction not found",
                "instruction_name": instruction_name,
            },
        )
    except ConnectionError as e:
        raise HTTPException(
            status_code=503, detail={"error": "Browser not available", "detail": str(e)}
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "Agent execution failed", "detail": str(e)},
        )
