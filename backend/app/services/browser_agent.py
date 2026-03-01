import json
from pathlib import Path

from app.config import settings
from browser_use import Agent, Browser
from browser_use.llm import ChatOpenAI, ChatAnthropic


def load_registry() -> dict:
    registry_path: Path = settings.instructions_file
    with registry_path.open("r", encoding="utf-8") as registry_file:
        return json.load(registry_file)


def get_instruction(name: str) -> dict:
    registry = load_registry()
    return registry[name]


def create_llm():
    if settings.llm_provider == "anthropic":
        return ChatAnthropic(
            model="claude-sonnet-4-20250514",
            api_key=settings.anthropic_api_key,
        )

    return ChatOpenAI(model="gpt-4o", api_key=settings.openai_api_key)


async def run_instruction(instruction_name: str) -> dict:
    instruction = get_instruction(instruction_name)

    task_string = f"""
{instruction["instructions"]}

IMPORTANT: Return ONLY a JSON response matching this schema:
{json.dumps(instruction["output_schema"], indent=2)}

Do not include any explanatory text. Only return valid JSON.
"""

    if settings.cdp_url:
        browser = Browser(cdp_url=settings.cdp_url)
    else:
        browser = Browser()

    agent = Agent(
        task=task_string,
        llm=create_llm(),
        browser=browser,
        max_steps=15,
        max_failures=3,
    )
    history = await agent.run()

    if not history.is_done() or history.has_errors():
        return {
            "instruction_name": instruction_name,
            "data": None,
            "success": False,
            "error": "Agent failed to complete task",
        }

    final_result = history.final_result() or ""

    try:
        parsed_data = json.loads(final_result)
    except (TypeError, json.JSONDecodeError):
        return {
            "instruction_name": instruction_name,
            "data": {"raw": final_result},
            "success": True,
            "warning": "Output was not valid JSON",
        }

    return {
        "instruction_name": instruction_name,
        "data": parsed_data,
        "success": True,
    }
