import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException
from app.config import settings
from app.models import CreateProfileRequest, RunRequest
from app.services.generator import generate_ui

router = APIRouter()


def _profile_dir(profile_id: str) -> Path:
    return settings.profiles_dir / profile_id


def _chat_path(profile_id: str) -> Path:
    return _profile_dir(profile_id) / "ui-generation-chat.json"


def _ui_path(profile_id: str) -> Path:
    return _profile_dir(profile_id) / "generated-ui.jsx"


def _load_chat(profile_id: str) -> dict:
    path = _chat_path(profile_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Profile {profile_id} not found")
    return json.loads(path.read_text())


def _save_chat(chat: dict):
    profile_dir = _profile_dir(chat["id"])
    profile_dir.mkdir(parents=True, exist_ok=True)
    _chat_path(chat["id"]).write_text(json.dumps(chat, indent=2))


def _save_ui(profile_id: str, code: str):
    _ui_path(profile_id).write_text(code)


def _load_ui(profile_id: str) -> str | None:
    path = _ui_path(profile_id)
    if not path.exists():
        return None
    return path.read_text()


def _build_messages(chat: dict, current_ui: str | None) -> list[dict]:
    """Build the message list for the LLM: all user messages + latest UI as one assistant message."""
    messages = []
    user_messages = chat["messages"]

    if current_ui and len(user_messages) > 1:
        # First user message (original prompt)
        messages.append(user_messages[0])
        # Latest generated UI as the assistant's response
        messages.append({"role": "assistant", "content": current_ui})
        # Remaining user messages (feedback)
        for msg in user_messages[1:]:
            messages.append(msg)
    else:
        # First message or no UI yet — just send user messages
        messages.extend(user_messages)

    return messages


@router.get("/profiles")
async def list_profiles():
    """List all saved profiles."""
    return []


@router.post("/profiles")
async def create_profile(req: CreateProfileRequest):
    """Create a new profile by profiling a URL."""
    return {"profile_id": "placeholder", "status": "not_implemented"}


@router.get("/profiles/{profile_id}")
async def get_profile(profile_id: str):
    """Get a profile's chat history and latest component code."""
    chat = _load_chat(profile_id)
    component_code = _load_ui(profile_id)
    return {
        "session_id": chat["id"],
        "url": chat.get("url", ""),
        "messages": chat["messages"],
        "component_code": component_code,
        "created_at": chat.get("created_at"),
        "updated_at": chat.get("updated_at"),
    }


@router.post("/run")
async def run(req: RunRequest):
    """Generate a React component. Creates or continues a profile session."""
    if not settings.dedalus_api_key:
        raise HTTPException(status_code=500, detail="DEDALUS_API_KEY is not configured")

    # Load existing profile or create a new one
    if req.session_id:
        chat = _load_chat(req.session_id)
        current_ui = _load_ui(req.session_id)
    else:
        chat = {
            "id": uuid.uuid4().hex,
            "url": req.url,
            "messages": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": None,
        }
        current_ui = None

    # Append the new user message
    chat["messages"].append({"role": "user", "content": req.prompt})

    # Build the LLM messages: user history + latest UI only
    llm_messages = _build_messages(chat, current_ui)

    try:
        component_code = await generate_ui(llm_messages)
    except Exception as e:
        # Remove the failed user message so chat stays clean
        chat["messages"].pop()
        raise HTTPException(status_code=502, detail=f"LLM generation failed: {e}")

    chat["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Save chat (user messages only) and generated UI separately
    _save_chat(chat)
    _save_ui(chat["id"], component_code)

    return {
        "session_id": chat["id"],
        "component_code": component_code,
    }
