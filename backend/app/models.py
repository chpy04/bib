from pydantic import BaseModel
from typing import Any


class CreateProfileRequest(BaseModel):
    url: str
    request: str  # Natural language description of what user wants


class RunRequest(BaseModel):
    prompt: str
    url: str = ""
    session_id: str | None = None


class WSMessage(BaseModel):
    type: str
    data: dict[str, Any] | None = None
    interval: float | None = None
    action: dict[str, Any] | None = None
    message: str | None = None
