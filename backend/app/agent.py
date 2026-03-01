"""Browser Use agent runners for task verification and runtime execution."""
import ast
import asyncio
import io
import json
import logging
import sys
from typing import Any

from browser_use import Agent, Browser
from browser_use.code_use import CodeAgent, create_namespace
from browser_use.code_use.views import CellType, ExecutionStatus
from browser_use.filesystem.file_system import FileSystem
from browser_use.llm import ChatAnthropic, ChatBrowserUse

from app.config import settings
from app.models import Task, VerifiedTask

logger = logging.getLogger(__name__)

MAX_CONCURRENT = 3


def _make_browser_use_llm() -> ChatBrowserUse:
    """Fast LLM for browser navigation. CodeAgent requires ChatBrowserUse."""
    return ChatBrowserUse(
        api_key=settings.browser_use_api_key,
    )


def _make_anthropic_llm() -> ChatAnthropic:
    """Stronger LLM for structured JSON output (agent slow-path fallback)."""
    return ChatAnthropic(
        model=settings.anthropic_model,
        api_key=settings.anthropic_api_key,
        temperature=0.0,
    )


async def _make_browser(profile_id: str) -> Browser:
    """Create a fresh BrowserSession for a single agent run.

    Before creating the agent browser, snapshot the live auth browser's current
    cookies to disk so the agent inherits the authenticated session — no explicit
    'save auth' step required from the user.
    """
    from app.browser import auth_state_path, _browser as auth_browser

    state_path = auth_state_path(profile_id)

    if auth_browser is not None:
        try:
            await auth_browser.export_storage_state(state_path)
            logger.debug("Exported auth state for agent use")
        except Exception as e:
            logger.debug("Could not export auth state: %s", e)

    storage_state = str(state_path) if state_path.exists() else None
    return Browser(headless=True, storage_state=storage_state)


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


async def _exec_cell(code: str, namespace: dict) -> None:
    """Execute a single Python code cell in the given namespace.

    Mirrors CodeAgent's _execute_code() logic: wraps cells containing `await`
    in an async function so top-level await works, then merges any new local
    variables back into the shared namespace so subsequent cells can use them.
    """
    namespace["_current_cell_code"] = code

    old_stdout = sys.stdout
    sys.stdout = io.StringIO()
    try:
        try:
            tree = ast.parse(code, mode="exec")
            has_await = any(
                isinstance(node, (ast.Await, ast.AsyncWith, ast.AsyncFor))
                for node in ast.walk(tree)
            )
        except SyntaxError:
            has_await = False

        if has_await:
            assigned_names: set[str] = set()
            try:
                for node in ast.walk(tree):
                    if isinstance(node, ast.Assign):
                        for target in node.targets:
                            if isinstance(target, ast.Name):
                                assigned_names.add(target.id)
                    elif (
                        isinstance(node, ast.AugAssign)
                        and isinstance(node.target, ast.Name)
                    ):
                        assigned_names.add(node.target.id)
            except Exception:
                pass

            existing_vars = {name for name in assigned_names if name in namespace}
            global_decl = (
                f"    global {', '.join(sorted(existing_vars))}\n"
                if existing_vars
                else ""
            )
            indented = "\n".join(
                "    " + line if line.strip() else line for line in code.split("\n")
            )
            wrapped = (
                "async def __exec__():\n"
                f"{global_decl}{indented}\n"
                "    return locals()\n\n"
                "__exec_coro__ = __exec__()\n"
            )

            exec(compile(wrapped, "<cell>", "exec"), namespace, namespace)  # noqa: S102
            coro = namespace.pop("__exec_coro__", None)
            namespace.pop("__exec__", None)
            if coro:
                result_locals = await coro
                if result_locals:
                    for k, v in result_locals.items():
                        if not k.startswith("_"):
                            namespace[k] = v
        else:
            exec(compile(code, "<cell>", "exec"), namespace, namespace)  # noqa: S102
    finally:
        sys.stdout = old_stdout


async def verify_task(task: Task, url: str, profile_id: str) -> VerifiedTask | None:
    """Run a CodeAgent to verify a single task, capture sample data and scraping code."""
    schema_json = json.dumps(task.output_schema, indent=2)
    task_prompt = (
        f"Navigate to {url} and perform the following task:\n"
        f"{task.description}\n\n"
        f"Return ONLY a JSON response matching this schema:\n{schema_json}\n\n"
        "Do not include any explanatory text. Only return valid JSON."
    )

    browser = await _make_browser(profile_id)
    agent: CodeAgent | None = None
    session = None
    try:
        await browser.start()
        agent = CodeAgent(
            task=task_prompt,
            llm=_make_browser_use_llm(),
            browser=browser,
            max_failures=3,
        )
        session = await agent.run(max_steps=30)
    except Exception as e:
        logger.error("CodeAgent failed for task '%s': %s", task.id, e)
        return None
    finally:
        try:
            await browser.stop()
        except Exception:
            pass

    raw = session.history.final_result()
    if not raw:
        logger.warning("No result returned for task '%s'", task.id)
        return None

    sample_output = _parse_result(raw)

    # Extract the successfully-executed code cells for deterministic re-use at refresh time.
    scraping_cells = [
        cell.source
        for cell in agent.session.cells
        if cell.status == ExecutionStatus.SUCCESS and cell.cell_type == CellType.CODE
    ]

    # Extract named JS block variables (e.g. extract_hn_stories) that Python cells reference.
    # CodeAgent stores these in namespace under their name, tracked via _code_block_vars.
    code_block_vars: set = agent.namespace.get("_code_block_vars", set())
    js_variables: dict[str, str] = {
        name: agent.namespace[name]
        for name in code_block_vars
        if name in agent.namespace and isinstance(agent.namespace[name], str)
    }

    # Build a human-readable instructions string from the cells.
    if scraping_cells:
        instructions = "\n\n".join(
            f"# Step {i + 1}\n{cell}" for i, cell in enumerate(scraping_cells)
        )
    else:
        instructions = _format_instructions(session.history)

    logger.info(
        "Verified task '%s' (%d code cells captured)", task.id, len(scraping_cells)
    )
    return VerifiedTask(
        id=task.id,
        description=task.description,
        output_schema=task.output_schema,
        display_hint=task.display_hint,
        type=task.type,
        instructions=instructions,
        sample_output=sample_output,
        scraping_cells=scraping_cells,
        js_variables=js_variables,
    )


async def verify_tasks(tasks: list[Task], url: str, profile_id: str) -> list[VerifiedTask]:
    """Verify all tasks in parallel (up to MAX_CONCURRENT at once)."""
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    async def _bounded(task: Task) -> VerifiedTask | None:
        async with semaphore:
            return await verify_task(task, url, profile_id)

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
    """Execute a named instruction from the registry.

    Fast path: re-execute the stored CodeAgent code cells directly (no LLM needed).
    Slow path: fall back to a full Browser Use agent if the fast path fails or no
    cells are stored (e.g. instructions created before this feature was added).
    """
    from app.registry import get_instruction

    instruction = get_instruction(profile_id, instruction_name)
    if instruction is None:
        return {
            "instruction_name": instruction_name,
            "data": None,
            "success": False,
            "error": f"Instruction '{instruction_name}' not found in registry",
        }

    scraping_cells: list[str] = instruction.get("scraping_cells") or []

    # ── Fast path: re-execute stored code cells ───────────────────────────────
    if scraping_cells:
        browser = await _make_browser(profile_id)
        try:
            await browser.start()
            namespace = create_namespace(browser, file_system=FileSystem(base_dir="./"))
            # Inject JS block variables that the Python cells reference.
            js_variables: dict[str, str] = instruction.get("js_variables") or {}
            namespace.update(js_variables)
            # Disable done() structural validation — we trust the stored cells.
            namespace["_consecutive_errors"] = 4

            for cell_code in scraping_cells:
                try:
                    await _exec_cell(cell_code, namespace)
                except Exception as cell_err:
                    logger.warning(
                        "Cell error during '%s' fast path: %s",
                        instruction_name,
                        cell_err,
                    )
                if namespace.get("_task_done"):
                    break

            raw = namespace.get("_task_result")
            if raw and namespace.get("_task_success", True) is not False:
                data = _parse_result(raw)
                # Treat empty list/dict as a failed extraction — fall through to agent.
                if not isinstance(data, str) and data:
                    logger.info(
                        "Fast path succeeded for instruction '%s'", instruction_name
                    )
                    return {
                        "instruction_name": instruction_name,
                        "data": data,
                        "success": True,
                    }

            logger.warning(
                "Fast path produced no valid output for '%s', falling back to agent",
                instruction_name,
            )
        except Exception as e:
            logger.warning(
                "Fast path failed for '%s', falling back to agent: %s",
                instruction_name,
                e,
            )
        finally:
            try:
                await browser.stop()
            except Exception:
                pass

    # ── Slow path: full browser agent ────────────────────────────────────────
    schema_json = json.dumps(instruction.get("output_schema", {}), indent=2)
    task_prompt = (
        f"Follow these instructions exactly:\n"
        f"{instruction['instructions']}\n\n"
        f"Return ONLY a JSON response matching this schema:\n{schema_json}\n\n"
        "Do not include any explanatory text. Only return valid JSON."
    )

    browser = await _make_browser(profile_id)
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
