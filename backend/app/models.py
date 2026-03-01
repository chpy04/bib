from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


# ── Auth ─────────────────────────────────────────────────────────────────────

class StartAuthRequest(BaseModel):
    url: str


# ── Task planning ─────────────────────────────────────────────────────────────

class PlanTasksRequest(BaseModel):
    url: str
    prompt: str


class Task(BaseModel):
    id: str
    description: str
    output_schema: dict[str, Any]   # JSON Schema object
    display_hint: str               # "card_list" | "table" | "value" | "button"
    type: str                       # "data" | "action"


class TaskPlan(BaseModel):
    tasks: list[Task]
    layout_hint: str


# ── Task verification ─────────────────────────────────────────────────────────

class VerifyTasksRequest(BaseModel):
    url: str
    tasks: list[Task]


class VerifiedTask(BaseModel):
    id: str
    description: str
    output_schema: dict[str, Any]
    display_hint: str
    type: str
    instructions: str        # step-by-step instructions from agent action history
    sample_output: Any


# ── UI generation ─────────────────────────────────────────────────────────────

class GenerateUIRequest(BaseModel):
    verified_tasks: list[VerifiedTask]
    layout_hint: str


class GenerateUIResponse(BaseModel):
    component_code: str


# ── Runtime data / action ─────────────────────────────────────────────────────

class DataResponse(BaseModel):
    instruction_name: str
    data: Any
    success: bool
    error: Optional[str] = None


class ActionResponse(BaseModel):
    success: bool
    data: Optional[dict[str, Any]] = None
    error: Optional[str] = None
