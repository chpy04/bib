import json
from pathlib import Path
from typing import Any

from app.config import settings
from browser_use import Agent, Browser
from browser_use.llm import ChatAnthropic, ChatOpenAI
from pydantic import BaseModel, RootModel, ValidationError


def load_registry() -> dict:
    registry_path: Path = settings.instructions_file
    with registry_path.open("r", encoding="utf-8") as registry_file:
        return json.load(registry_file)


def get_instruction(name: str) -> dict:
    registry = load_registry()
    return registry[name]


def create_llm() -> ChatOpenAI | ChatAnthropic:
    if settings.llm_provider == "anthropic":
        return ChatAnthropic(
            model="claude-sonnet-4-20250514",
            api_key=settings.anthropic_api_key,
        )

    return ChatOpenAI(model="gpt-4o", api_key=settings.openai_api_key)


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


def build_output_model(instruction_name: str, output_schema: Any) -> type[BaseModel]:
    model_type = _schema_to_type(f"{instruction_name}_output", output_schema)
    if isinstance(model_type, type) and issubclass(model_type, BaseModel):
        return model_type

    root_base = RootModel[model_type]
    return type(
        _sanitize_model_name(f"{instruction_name}_output_root"), (root_base,), {}
    )


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


async def run_instruction(instruction_name: str) -> dict:
    instruction = get_instruction(instruction_name)
    output_model = build_output_model(instruction_name, instruction["output_schema"])

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
            "data": None,
            "success": False,
            "error": "Output was not valid JSON",
        }

    try:
        validated = output_model.model_validate(parsed_data)
    except ValidationError as exc:
        return {
            "instruction_name": instruction_name,
            "data": None,
            "success": False,
            "error": "Output failed schema validation",
            "detail": str(exc),
        }

    return {
        "instruction_name": instruction_name,
        "data": validated.model_dump(),
        "success": True,
    }
