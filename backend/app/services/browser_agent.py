import json
import logging
from pathlib import Path
from typing import Any

from app.config import settings
from browser_use import Agent, Browser
from browser_use.llm import ChatAnthropic, ChatOpenAI
from pydantic import BaseModel, RootModel, ValidationError

logger = logging.getLogger(__name__)

# Global auth fallback path (legacy — used when no profile_id is present)
AUTH_STATE_PATH = Path(__file__).parent.parent.parent / "data" / "auth.json"


# ---------------------------------------------------------------------------
# Registry helpers
# ---------------------------------------------------------------------------

def load_registry() -> dict:
    registry_path: Path = settings.instructions_file
    with registry_path.open("r", encoding="utf-8") as registry_file:
        return json.load(registry_file)


def save_registry(registry: dict) -> None:
    registry_path: Path = settings.instructions_file
    registry_path.parent.mkdir(parents=True, exist_ok=True)
    registry_path.write_text(json.dumps(registry, indent=2))


def get_instruction(name: str) -> dict:
    registry = load_registry()
    if name not in registry:
        raise KeyError(f"Instruction '{name}' not found in registry")
    return registry[name]


# ---------------------------------------------------------------------------
# LLM factory
# ---------------------------------------------------------------------------

def create_llm() -> ChatOpenAI | ChatAnthropic:
    if settings.llm_provider == "anthropic":
        return ChatAnthropic(
            model=settings.anthropic_model,
            api_key=settings.anthropic_api_key,
        )
    return ChatOpenAI(model=settings.openai_model, api_key=settings.openai_api_key)


# ---------------------------------------------------------------------------
# Browser factory
# ---------------------------------------------------------------------------

def create_browser(profile_id: str | None = None) -> Browser:
    """
    Priority 1 — profile-specific auth state (profiles/{profile_id}/auth_state.json)
    Priority 2 — global auth state fallback (data/auth.json)
    Priority 3 — connect to existing Chrome via CDP URL
    Priority 4 — launch fresh headless browser (no auth, public sites only)
    """
    if profile_id:
        profile_auth = settings.profiles_dir / profile_id / "auth_state.json"
        if profile_auth.exists():
            return Browser(storage_state=str(profile_auth))

    if AUTH_STATE_PATH.exists():
        return Browser(storage_state=str(AUTH_STATE_PATH))

    if settings.cdp_url:
        return Browser(cdp_url=settings.cdp_url)

    return Browser()


# ---------------------------------------------------------------------------
# Pydantic model builder from output schema
# ---------------------------------------------------------------------------

def _sanitize_model_name(name: str) -> str:
    cleaned = "".join(ch if ch.isalnum() else "_" for ch in name)
    cleaned = cleaned.strip("_") or "OutputModel"
    if cleaned[0].isdigit():
        cleaned = f"M_{cleaned}"
    return cleaned


def _primitive_type(value: str) -> Any:
    mapping = {
        "string": str,
        "number": float,
        "integer": int,
        "boolean": bool,
        "object": dict,
        "array": list,
    }
    return mapping.get(value.lower(), Any)


def _schema_to_type(model_name: str, schema: Any) -> Any:
    if isinstance(schema, str):
        return _primitive_type(schema)

    if isinstance(schema, list):
        item_schema = schema[0] if schema else Any
        return list[_schema_to_type(f"{model_name}Item", item_schema)]

    if isinstance(schema, dict):
        if "type" in schema:
            schema_type = schema.get("type")

            if schema_type == "object":
                properties = schema.get("properties", {})
                required = set(schema.get("required", properties.keys()))
                fields: dict[str, tuple[Any, Any]] = {}
                for field_name, field_schema in properties.items():
                    field_type = _schema_to_type(
                        f"{model_name}_{field_name}", field_schema
                    )
                    if field_name in required:
                        fields[field_name] = (field_type, ...)
                    else:
                        fields[field_name] = (field_type | None, None)
                return _build_model(model_name, fields)

            if schema_type == "array":
                item_type = _schema_to_type(
                    f"{model_name}Item", schema.get("items", Any)
                )
                return list[item_type]

            if isinstance(schema_type, str):
                return _primitive_type(schema_type)

        fields = {
            key: (_schema_to_type(f"{model_name}_{key}", value), ...)
            for key, value in schema.items()
        }
        return _build_model(model_name, fields)

    return Any


def _build_model(
    model_name: str, fields: dict[str, tuple[Any, Any]]
) -> type[BaseModel]:
    annotations: dict[str, Any] = {}
    namespace: dict[str, Any] = {}
    for field_name, (field_type, default_value) in fields.items():
        annotations[field_name] = field_type
        if default_value is not ...:
            namespace[field_name] = default_value
    namespace["__annotations__"] = annotations
    return type(_sanitize_model_name(model_name), (BaseModel,), namespace)


def build_output_model(instruction_name: str, output_schema: Any) -> type[BaseModel]:
    model_type = _schema_to_type(f"{instruction_name}_output", output_schema)
    if isinstance(model_type, type) and issubclass(model_type, BaseModel):
        return model_type
    root_base = RootModel[model_type]
    return type(
        _sanitize_model_name(f"{instruction_name}_output_root"), (root_base,), {}
    )


# ---------------------------------------------------------------------------
# Core execution
# ---------------------------------------------------------------------------

async def run_instruction(instruction_name: str) -> dict:
    """
    Execute a named instruction from the registry via a Browser Use agent.
    Automatically uses the profile-specific auth state if the instruction
    has a profile_id, falling back to global auth or no auth.
    """
    instruction = get_instruction(instruction_name)

    # Use profile-specific auth if available
    profile_id: str | None = instruction.get("profile_id")
    browser = create_browser(profile_id=profile_id)

    output_model = build_output_model(instruction_name, instruction["output_schema"])

    task_string = (
        f"{instruction['instructions']}\n\n"
        f"IMPORTANT: Return ONLY a JSON response matching this schema:\n"
        f"{json.dumps(instruction['output_schema'], indent=2)}\n\n"
        f"Do not include any explanatory text. Only return valid JSON."
    )

    try:
        agent = Agent(
            task=task_string,
            llm=create_llm(),
            browser=browser,
            output_model_schema=output_model,
            max_steps=15,
            max_failures=3,
        )
        history = await agent.run()
    except Exception as e:
        return {
            "instruction_name": instruction_name,
            "data": None,
            "success": False,
            "error": f"Agent execution error: {str(e)}",
        }
    finally:
        try:
            await browser.stop()
        except Exception:
            logger.warning("Failed to stop browser for instruction %s", instruction_name)

    if not history.is_done():
        return {
            "instruction_name": instruction_name,
            "data": None,
            "success": False,
            "error": "Agent did not complete within the step limit",
        }

    # Path 1: structured output enforced by output_model_schema
    structured = history.structured_output
    if structured is not None:
        try:
            data = structured.model_dump() if isinstance(structured, BaseModel) else structured
            return {"instruction_name": instruction_name, "data": data, "success": True}
        except Exception:
            logger.warning("Failed to serialize structured output for %s, falling back to raw result", instruction_name)

    # Path 2: fallback — parse final_result() string as JSON
    raw = history.final_result()
    if raw is None:
        return {
            "instruction_name": instruction_name,
            "data": None,
            "success": False,
            "error": "Agent completed but returned no output",
        }

    cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()

    try:
        parsed_data = json.loads(cleaned)
    except (TypeError, json.JSONDecodeError):
        return {
            "instruction_name": instruction_name,
            "data": None,
            "success": False,
            "error": "Output was not valid JSON",
        }

    try:
        validated = output_model.model_validate(parsed_data)
        return {
            "instruction_name": instruction_name,
            "data": validated.model_dump(),
            "success": True,
        }
    except ValidationError as exc:
        return {
            "instruction_name": instruction_name,
            "data": None,
            "success": False,
            "error": "Output failed schema validation",
            "detail": str(exc),
        }
