"""Claude API calls for task planning and UI generation."""
import json
import logging
from pathlib import Path

from langchain_anthropic import ChatAnthropic

from app.config import settings
from app.models import Task, TaskPlan, VerifiedTask, RefineUIRequest

logger = logging.getLogger(__name__)

_PROMPTS_DIR = Path(__file__).parent / "prompts"


def _load_prompt(name: str) -> str:
    """Load a prompt from the prompts directory by name (without extension)."""
    return (_PROMPTS_DIR / f"{name}.md").read_text().strip()


async def plan_tasks(url: str, prompt: str) -> TaskPlan:
    """Call Claude to decompose user prompt into a structured task plan."""
    llm = ChatAnthropic(
        model=settings.anthropic_model,
        api_key=settings.anthropic_api_key,
        temperature=0.0,
        max_tokens=2048,
    )

    user_content = _load_prompt("task-planning-user").format(url=url, prompt=prompt)
    logger.info("[llm] Planning tasks for url=%s", url)

    result = await llm.ainvoke([
        {"role": "system", "content": _load_prompt("task-planning")},
        {"role": "user", "content": user_content},
    ])

    raw = result.content if isinstance(result.content, str) else str(result.content)
    raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    data = json.loads(raw)
    logger.info("[llm] Planned %d task(s)", len(data.get("tasks", [])))
    return TaskPlan(**data)



async def generate_ui(verified_tasks: list[VerifiedTask], layout_hint: str) -> str:
    """Call Claude to generate the GeneratedPage React component."""
    llm = ChatAnthropic(
        model=settings.anthropic_model,
        api_key=settings.anthropic_api_key,
        temperature=0.7,
        max_tokens=4096,
    )

    task_docs = [
        {
            "id": t.id,
            "description": t.description,
            "type": t.type,
            "display_hint": t.display_hint,
            "sample_data": t.sample_output,
        }
        for t in verified_tasks
    ]

    user_content = _load_prompt("ui-generation-user").format(
        layout_hint=layout_hint,
        verified_tasks_json=json.dumps(task_docs, indent=2),
    )

    logger.info("[llm] Generating UI for %d task(s)", len(verified_tasks))

    result = await llm.ainvoke([
        {"role": "system", "content": _load_prompt("ui-generation")},
        {"role": "user", "content": user_content},
    ])

    code = result.content if isinstance(result.content, str) else str(result.content)
    code = (
        code.strip()
        .removeprefix("```jsx")
        .removeprefix("```tsx")
        .removeprefix("```javascript")
        .removeprefix("```js")
        .removeprefix("```")
        .removesuffix("```")
        .strip()
    )

    logger.info("[llm] Generated %d chars of component code", len(code))
    return code


async def refine_ui(req: RefineUIRequest) -> str:
    """Call Claude to refine the GeneratedPage component based on user feedback."""
    llm = ChatAnthropic(
        model=settings.anthropic_model,
        api_key=settings.anthropic_api_key,
        temperature=0.7,
        max_tokens=4096,
    )

    task_docs = [
        {
            "id": t.id,
            "description": t.description,
            "type": t.type,
            "display_hint": t.display_hint,
            "sample_data": t.sample_output,
        }
        for t in req.verified_tasks
    ]

    chat_history_formatted = "\n".join(
        f"{i + 1}. {msg}" for i, msg in enumerate(req.chat_history)
    )

    user_content = _load_prompt("ui-refinement-user").format(
        layout_hint=req.layout_hint,
        verified_tasks_json=json.dumps(task_docs, indent=2),
        chat_history_formatted=chat_history_formatted,
        current_code=req.current_code,
        refinement=req.refinement,
    )

    logger.info("[llm] Refining UI with %d previous messages", len(req.chat_history))

    result = await llm.ainvoke([
        {"role": "system", "content": _load_prompt("ui-generation")},
        {"role": "user", "content": user_content},
    ])

    code = result.content if isinstance(result.content, str) else str(result.content)
    code = (
        code.strip()
        .removeprefix("```jsx")
        .removeprefix("```tsx")
        .removeprefix("```javascript")
        .removeprefix("```js")
        .removeprefix("```")
        .removesuffix("```")
        .strip()
    )

    logger.info("[llm] Refined component: %d chars", len(code))
    return code
