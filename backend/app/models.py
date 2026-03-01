from pydantic import BaseModel, Field
from typing import Any


class FetcherDef(BaseModel):
    id: str
    type: str  # "javascript" or "agent_task"
    description: str
    code: str | None = None            # For JS fetchers
    task_template: str | None = None   # For agent fetchers
    target_field: str


class ProfileConfig(BaseModel):
    profile_id: str
    url: str
    name: str
    description: str
    data_schema: dict[str, Any] = Field(alias="schema")  # JSON Schema for the data shape
    fetchers: list[FetcherDef] = []
    component_code: str | None = None  # Generated React component as string


class CreateProfileRequest(BaseModel):
    url: str
    request: str  # Natural language description of what user wants


class RunRequest(BaseModel):
    url: str = ""
    prompt: str


class WSMessage(BaseModel):
    type: str
    data: dict[str, Any] | None = None
    interval: float | None = None
    action: dict[str, Any] | None = None
    message: str | None = None
