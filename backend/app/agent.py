"""Browser Use agent runners for task verification and runtime execution."""
import asyncio
import json
import logging
from typing import Any

from browser_use import Agent, Browser
from browser_use.llm import ChatAnthropic, ChatBrowserUse

from app.config import settings
from app.models import Task, VerifiedTask

logger = logging.getLogger(__name__)

MAX_CONCURRENT = 3


def _make_browser_use_llm() -> ChatBrowserUse:
    """Fast LLM for browser navigation (verify step)."""
    return ChatBrowserUse(
        api_key=settings.browser_use_api_key,
    )


def _make_anthropic_llm() -> ChatAnthropic:
    """Stronger LLM for structured JSON output (data fetch step)."""
    return ChatAnthropic(
        model=settings.anthropic_model,
        api_key=settings.anthropic_api_key,
        temperature=0.0,
    )


async def _make_browser() -> Browser:
    """Create a fresh BrowserSession for a single agent run.

    Before creating the agent browser, snapshot the live auth browser's current
    cookies to disk so the agent inherits the authenticated session — no explicit
    'save auth' step required from the user.
    """
    from app.browser import AUTH_STATE_PATH, _browser as auth_browser

    if auth_browser is not None:
        try:
            await auth_browser.export_storage_state(AUTH_STATE_PATH)
            logger.debug("Exported auth state for agent use")
        except Exception as e:
            logger.debug("Could not export auth state: %s", e)

    storage_state = str(AUTH_STATE_PATH) if AUTH_STATE_PATH.exists() else None
    return Browser(headless=False, storage_state=storage_state)


def _format_instructions(history) -> str:
    """Convert agent action history to reusable step-by-step instructions string."""
    steps = []
    try:
        for i, action in enumerate(history.model_actions(), 1):
            steps.append(f"Step {i}: {action}")
    except Exception:
        pass
    if steps:
        return "\n".join(steps)
    try:
        return history.final_result() or "Navigate to the site and extract the required data."
    except Exception:
        return "Navigate to the site and extract the required data."


def _parse_result(raw: str) -> Any:
    """Strip markdown fences and parse JSON from agent final result."""
    cleaned = (
        raw.strip()
        .removeprefix("```json")
        .removeprefix("```")
        .removesuffix("```")
        .strip()
    )
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return cleaned


async def verify_task(task: Task, url: str) -> VerifiedTask | None:
    """Run a Browser Use agent to verify a single task and capture sample data."""
    schema_json = json.dumps(task.output_schema, indent=2)
    task_prompt = (
        f"Navigate to {url} and perform the following task:\n"
        f"{task.description}\n\n"
        f"Return ONLY a JSON response matching this schema:\n{schema_json}\n\n"
        "Do not include any explanatory text. Only return valid JSON."
    )

    browser = await _make_browser()
    try:
        agent = Agent(
            task=task_prompt,
            llm=_make_browser_use_llm(),
            browser=browser,
            max_failures=3,
        )
        history = await agent.run(max_steps=20)
    except Exception as e:
        logger.error("Agent failed for task '%s': %s", task.id, e)
        return None
    finally:
        try:
            await browser.stop()
        except Exception:
            pass

    raw = history.final_result()
    if not raw:
        logger.warning("No result returned for task '%s'", task.id)
        return None

    sample_output = _parse_result(raw)
    instructions = _format_instructions(history)

    logger.info("Verified task '%s'", task.id)
    return VerifiedTask(
        id=task.id,
        description=task.description,
        output_schema=task.output_schema,
        display_hint=task.display_hint,
        type=task.type,
        instructions=instructions,
        sample_output=sample_output,
    )


async def verify_tasks(tasks: list[Task], url: str) -> list[VerifiedTask]:
    """Verify all tasks in parallel (up to MAX_CONCURRENT at once)."""
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    async def _bounded(task: Task) -> VerifiedTask | None:
        async with semaphore:
            return await verify_task(task, url)

    results = await asyncio.gather(*[_bounded(t) for t in tasks], return_exceptions=True)

    verified: list[VerifiedTask] = []
    for task, result in zip(tasks, results):
        if isinstance(result, Exception):
            logger.error("Verification exception for task '%s': %s", task.id, result)
        elif result is not None:
            verified.append(result)

    logger.info("Verified %d / %d tasks", len(verified), len(tasks))
    return verified


async def run_instruction(instruction_name: str, profile_id: str) -> dict[str, Any]:
    """Execute a named instruction from the registry."""
    from app.registry import get_instruction

    instruction = get_instruction(profile_id, instruction_name)
    if instruction is None:
        return {
            "instruction_name": instruction_name,
            "data": None,
            "success": False,
            "error": f"Instruction '{instruction_name}' not found in registry",
        }

    schema_json = json.dumps(instruction.get("output_schema", {}), indent=2)
    task_prompt = (
        f"Follow these instructions exactly:\n"
        f"{instruction['instructions']}\n\n"
        f"Return ONLY a JSON response matching this schema:\n{schema_json}\n\n"
        "Do not include any explanatory text. Only return valid JSON."
    )

    browser = await _make_browser()
    try:
        agent = Agent(
            task=task_prompt,
            llm=_make_anthropic_llm(),
            browser=browser,
            max_failures=3,
        )
        history = await agent.run(max_steps=20)
    except Exception as e:
        logger.error("Agent failed for instruction '%s': %s", instruction_name, e)
        return {
            "instruction_name": instruction_name,
            "data": None,
            "success": False,
            "error": f"Agent execution error: {e}",
        }
    finally:
        try:
            await browser.stop()
        except Exception:
            pass

    raw = history.final_result()
    if not raw:
        return {
            "instruction_name": instruction_name,
            "data": None,
            "success": False,
            "error": "Agent returned no output",
        }

    data = _parse_result(raw)
    if isinstance(data, str):
        return {
            "instruction_name": instruction_name,
            "data": None,
            "success": False,
            "error": "Output was not valid JSON",
        }

    return {"instruction_name": instruction_name, "data": data, "success": True}
