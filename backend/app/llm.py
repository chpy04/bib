"""Claude API calls for task planning and UI generation."""
import json
import logging

from langchain_anthropic import ChatAnthropic

from app.config import settings
from app.models import Task, TaskPlan, VerifiedTask

logger = logging.getLogger(__name__)

_PLAN_SYSTEM = """\
You are a task planner for a web automation system.

Given a target website URL and a user's description of what data and actions they want,
decompose the request into a list of discrete atomic tasks.

Return ONLY a JSON object with this exact structure — no explanation, no markdown:
{
  "tasks": [
    {
      "id": "snake_case_name",
      "description": "Plain English description of what to fetch or do",
      "output_schema": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "field_name": {"type": "string"}
          }
        }
      },
      "display_hint": "card_list",
      "type": "data"
    }
  ],
  "layout_hint": "Brief description of the suggested overall layout"
}

Rules:
- type "data" means the agent fetches information and returns JSON
- type "action" means the agent performs an action; use output_schema: {"type": "object", "properties": {}}
- display_hint: "card_list" for card grids, "table" for tabular data, "value" for single stats, "button" for actions
- Keep tasks atomic — one task per distinct data source or action
- id must be snake_case and unique, descriptive of the data (e.g. "open_pull_requests")
- output_schema must be a valid JSON Schema object
"""


async def plan_tasks(url: str, prompt: str) -> TaskPlan:
    """Call Claude to decompose user prompt into a structured task plan."""
    llm = ChatAnthropic(
        model=settings.anthropic_model,
        api_key=settings.anthropic_api_key,
        temperature=0.0,
        max_tokens=2048,
    )

    user_content = f"Target website: {url}\nUser request: {prompt}"
    logger.info("[llm] Planning tasks for url=%s", url)

    result = await llm.ainvoke([
        {"role": "system", "content": _PLAN_SYSTEM},
        {"role": "user", "content": user_content},
    ])

    raw = result.content if isinstance(result.content, str) else str(result.content)
    raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    data = json.loads(raw)
    logger.info("[llm] Planned %d task(s)", len(data.get("tasks", [])))
    return TaskPlan(**data)


_UI_SYSTEM = """\
You are an expert React developer building a live dashboard component.

You will receive a list of verified tasks with their sample data and display hints.
Generate a single React function called `GeneratedPage`.

Rules:
- NO import statements — React is available as the global `React` variable
- Use React.useState, React.useEffect etc. (no destructured imports)
- The component signature must be: function GeneratedPage(props) { ... }
  where props contains one key per task id (holding that task's data array/object),
  plus navigateTo(url) and executeAction(instructionName) functions
- Use Tailwind CSS utility classes for ALL styling (Tailwind CDN is loaded)
- Call props.navigateTo(url) for external links — do NOT use <a href>
- Call props.executeAction(name) for action buttons
- Render each task's data according to its display_hint:
    card_list → grid of cards with key details
    table     → clean table with headers
    value     → large stat or value display
    button    → button that calls executeAction
- Return ONLY the component function — no export, no explanation, no markdown fences
- Start with: function GeneratedPage(props) {

Example:
function GeneratedPage(props) {
  return (
    <div className="p-6 space-y-8">
      <section>
        <h2 className="text-xl font-bold mb-4">Repositories</h2>
        <div className="grid grid-cols-2 gap-4">
          {(props.github_repos || []).map((r, i) => (
            <div key={i} className="p-4 border rounded-lg">
              <h3 className="font-semibold">{r.name}</h3>
              <button onClick={() => props.navigateTo(r.url)} className="text-blue-500 text-sm mt-2">
                Open →
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
"""


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

    user_content = (
        f"Layout hint: {layout_hint}\n\n"
        f"Verified tasks:\n{json.dumps(task_docs, indent=2)}\n\n"
        "Generate the GeneratedPage component.\n"
        "The component receives props with keys named after each task id "
        "(e.g. props.github_repos), plus props.navigateTo and props.executeAction.\n"
        "Use the sample_data to understand the shape of each prop."
    )

    logger.info("[llm] Generating UI for %d task(s)", len(verified_tasks))

    result = await llm.ainvoke([
        {"role": "system", "content": _UI_SYSTEM},
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
