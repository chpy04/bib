from enum import Enum
from typing import Any

from pydantic import BaseModel


class TaskType(str, Enum):
    DATA_READ = "DATA_READ"
    ACTION = "ACTION"


class DecomposedTask(BaseModel):
    name: str
    type: TaskType
    description: str


class DecomposerOutput(BaseModel):
    tasks: list[DecomposedTask]


class OutputSchema(BaseModel):
    fields: dict[str, str]  # field_name -> type ("string", "int", "url", ...)
    is_list: bool
    sample_data: Any


class TaskProfile(BaseModel):
    name: str
    type: TaskType
    description: str
    agent_prompt: str  # prompt template, {param} placeholders for actions
    input_params: list[str] | None = None
    output_schema: OutputSchema


class SiteProfile(BaseModel):
    profile_id: str
    base_url: str
    name: str
    description: str
    tasks: list[TaskProfile]
    auth_configured: bool = False


class DiscoveryResult(BaseModel):
    """Structured output from browser-use Agent during discovery.
    Pydantic validates this at runtime — required fields enforced, types checked.
    """
    extracted_data: Any
    agent_prompt_used: str
    suggested_fields: dict[str, str]
    is_list: bool
