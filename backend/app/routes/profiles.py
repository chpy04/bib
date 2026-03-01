import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.models import CreateProfileRequest, RunRequest
from app.profiler.models import SiteProfile
from app.services.auth import (
    has_active_session,
    has_saved_auth,
    start_auth_session,
    stop_auth_session,
)
from app.services.generator import generate_ui
from app.services.profiler import profile_site

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Session helpers (UI-generation chat storage)
# ---------------------------------------------------------------------------

def _profile_dir(session_id: str) -> Path:
    return settings.profiles_dir / session_id


def _chat_path(session_id: str) -> Path:
    return _profile_dir(session_id) / "ui-generation-chat.json"


def _ui_path(session_id: str) -> Path:
    return _profile_dir(session_id) / "generated-ui.jsx"


def _load_chat(session_id: str) -> dict:
    path = _chat_path(session_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return json.loads(path.read_text())


def _save_chat(chat: dict) -> None:
    d = _profile_dir(chat["id"])
    d.mkdir(parents=True, exist_ok=True)
    _chat_path(chat["id"]).write_text(json.dumps(chat, indent=2))


def _save_ui(session_id: str, code: str) -> None:
    _ui_path(session_id).write_text(code)


def _load_ui(session_id: str) -> str | None:
    path = _ui_path(session_id)
    return path.read_text() if path.exists() else None


def _build_messages(chat: dict, current_ui: str | None) -> list[dict]:
    """Build the LLM message list: user history interleaved with the latest generated UI."""
    user_messages = chat["messages"]
    if current_ui and len(user_messages) > 1:
        return [
            user_messages[0],
            {"role": "assistant", "content": current_ui},
            *user_messages[1:],
        ]
    return list(user_messages)


# ---------------------------------------------------------------------------
# Profile list & create
# ---------------------------------------------------------------------------

@router.get("/profiles")
async def list_profiles() -> list[SiteProfile]:
    """List all saved site profiles."""
    profiles: list[SiteProfile] = []
    profiles_dir = settings.profiles_dir
    if not profiles_dir.exists():
        return profiles

    for child in sorted(profiles_dir.iterdir()):
        profile_file = child / "site_profile.json"
        if profile_file.exists():
            try:
                data = json.loads(profile_file.read_text())
                profile = SiteProfile(**data)
                profile.auth_configured = (child / "auth_state.json").exists()
                profiles.append(profile)
            except Exception:
                logger.exception("Failed to load profile from %s", profile_file)
    return profiles


@router.post("/profiles")
async def create_profile(req: CreateProfileRequest) -> SiteProfile:
    """Create a profile stub for a URL (no discovery yet)."""
    profiles_dir = settings.profiles_dir
    if profiles_dir.exists():
        for child in profiles_dir.iterdir():
            profile_file = child / "site_profile.json"
            if profile_file.exists():
                try:
                    data = json.loads(profile_file.read_text())
                    if data.get("base_url") == req.url:
                        profile = SiteProfile(**data)
                        profile.auth_configured = (child / "auth_state.json").exists()
                        return profile
                except Exception:
                    logger.exception("Failed to load profile from %s", profile_file)
                    continue

    profile = SiteProfile(
        profile_id=str(uuid.uuid4()),
        base_url=req.url,
        name=f"Profile for {req.url}",
        description=req.request,
        tasks=[],
    )

    profile_dir = settings.profiles_dir / profile.profile_id
    profile_dir.mkdir(parents=True, exist_ok=True)
    profile_path = profile_dir / "site_profile.json"
    profile_path.write_text(json.dumps(profile.model_dump(), indent=2))
    return profile


# ---------------------------------------------------------------------------
# Profiler-based discovery
# ---------------------------------------------------------------------------

@router.post("/profiles/{profile_id}/discover")
async def discover_profile(profile_id: str) -> SiteProfile:
    """Run the profiler pipeline (decompose + discover) for an existing profile."""
    profile_file = settings.profiles_dir / profile_id / "site_profile.json"
    if not profile_file.exists():
        raise HTTPException(status_code=404, detail="Profile not found")

    data = json.loads(profile_file.read_text())
    existing = SiteProfile(**data)

    profile = await profile_site(existing.base_url, existing.description)
    profile.auth_configured = has_saved_auth(profile_id)
    return profile


# ---------------------------------------------------------------------------
# Profile get — handles both site profiles and UI-generation sessions
# ---------------------------------------------------------------------------

@router.get("/profiles/{profile_id}")
async def get_profile(profile_id: str):
    """Get a profile or session.

    - If it's a UI-generation session (has ui-generation-chat.json), returns
      {session_id, url, component_code, messages, created_at, updated_at}.
    - Otherwise returns a SiteProfile JSON.
    """
    # Try session format first
    chat_file = _chat_path(profile_id)
    if chat_file.exists():
        chat = json.loads(chat_file.read_text())
        return {
            "session_id": chat["id"],
            "url": chat.get("url", ""),
            "messages": chat["messages"],
            "component_code": _load_ui(profile_id),
            "created_at": chat.get("created_at"),
            "updated_at": chat.get("updated_at"),
        }

    # Fall back to site profile
    profile_file = settings.profiles_dir / profile_id / "site_profile.json"
    if not profile_file.exists():
        raise HTTPException(status_code=404, detail="Profile not found")

    data = json.loads(profile_file.read_text())
    profile = SiteProfile(**data)
    profile.auth_configured = (
        settings.profiles_dir / profile_id / "auth_state.json"
    ).exists()
    return profile


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@router.post("/profiles/{profile_id}/auth")
async def begin_auth(profile_id: str):
    """Open a browser for the user to manually log in."""
    profile_file = settings.profiles_dir / profile_id / "site_profile.json"
    if not profile_file.exists():
        raise HTTPException(status_code=404, detail="Profile not found")

    if has_active_session(profile_id):
        raise HTTPException(status_code=409, detail="Auth session already active")

    data = json.loads(profile_file.read_text())
    profile = SiteProfile(**data)

    await start_auth_session(profile_id, profile.base_url)
    return {"status": "started", "profile_id": profile_id}


@router.delete("/profiles/{profile_id}/auth")
async def finish_auth(profile_id: str):
    """Close the auth browser and save cookies."""
    stopped = await stop_auth_session(profile_id)
    if not stopped:
        raise HTTPException(status_code=404, detail="No active auth session")

    return {
        "status": "completed",
        "profile_id": profile_id,
        "auth_saved": has_saved_auth(profile_id),
    }


@router.get("/profiles/{profile_id}/auth")
async def auth_status(profile_id: str):
    """Check auth state for a profile."""
    return {
        "profile_id": profile_id,
        "active_session": has_active_session(profile_id),
        "has_saved_auth": has_saved_auth(profile_id),
    }


# ---------------------------------------------------------------------------
# Run — main scrape + UI generation endpoint
# ---------------------------------------------------------------------------

@router.post("/run")
async def run(req: RunRequest):
    """Scrape a URL and generate a React dashboard component.

    New session (no session_id): runs the profiler pipeline to extract real data,
    then asks the LLM to generate a React component that displays it.

    Feedback iteration (session_id provided): re-generates the component
    using the existing scraped data plus the new feedback prompt.

    Returns: { session_id, component_code }
    """
    # --- Feedback / iteration path ---
    if req.session_id:
        chat = _load_chat(req.session_id)
        current_ui = _load_ui(req.session_id)
        chat["messages"].append({"role": "user", "content": req.prompt})
        llm_messages = _build_messages(chat, current_ui)
        try:
            component_code = await generate_ui(llm_messages)
        except Exception as e:
            chat["messages"].pop()
            raise HTTPException(status_code=502, detail=f"LLM generation failed: {e}")
        chat["updated_at"] = datetime.now(timezone.utc).isoformat()
        _save_chat(chat)
        _save_ui(chat["id"], component_code)
        return {"session_id": chat["id"], "component_code": component_code}

    # --- New session: run profiler then generate UI ---
    if not req.url:
        raise HTTPException(status_code=422, detail="url is required for a new session")

    logger.info("Starting run: url=%s prompt=%s", req.url, req.prompt[:80])

    # Step 1: Run the profiler pipeline (decompose + browser discover + sample data)
    try:
        profile = await profile_site(req.url, req.prompt)
    except Exception as e:
        logger.exception("Profiler failed for url=%s", req.url)
        raise HTTPException(status_code=502, detail=f"Profiler failed: {e}")

    # Step 2: Build endpoint documentation for each discovered task.
    # Each entry includes the endpoint path, schema, AND the initial data already
    # scraped by the profiler — so the LLM initialises state with real data immediately.
    endpoint_docs: list[str] = []
    for task in profile.tasks:
        lines = [
            f"## {task.name}",
            f"Description: {task.description}",
            f"Endpoint: GET /api/data/{task.name}",
        ]
        if task.output_schema:
            returns_label = "Returns a list. Each item has:" if task.output_schema.is_list else "Returns an object with:"
            lines.append(returns_label)
            for field, field_type in task.output_schema.fields.items():
                lines.append(f"  - {field}: {field_type}")
            if task.output_schema.sample_data is not None:
                lines.append(
                    "Initial data (USE THIS as the initial useState value so data displays "
                    "immediately — then fetch the endpoint in useEffect to refresh):"
                )
                lines.append(json.dumps(task.output_schema.sample_data, indent=2))
        endpoint_docs.append("\n".join(lines))

    # Step 3: Build the initial user message with endpoint + data context for the LLM
    if endpoint_docs:
        user_content = (
            f"User request: {req.prompt}\n"
            f"Target site: {req.url}\n\n"
            "Data endpoints discovered for this site. For each endpoint below, "
            "initialize state with the provided Initial data so the dashboard shows "
            "content immediately. Then fetch the endpoint in a useEffect to refresh "
            "with live data in the background.\n\n"
            + "\n\n".join(endpoint_docs)
        )
    else:
        user_content = (
            f"User request: {req.prompt}\n"
            f"Target site: {req.url}\n\n"
            "No data endpoints were discovered for this site. "
            "Build a placeholder dashboard that explains what was requested."
        )

    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    chat = {
        "id": session_id,
        "url": req.url,
        "profile_id": profile.profile_id,
        "messages": [{"role": "user", "content": user_content}],
        "created_at": now,
        "updated_at": None,
    }

    # Step 4: Generate the React UI
    llm_messages = _build_messages(chat, None)
    try:
        component_code = await generate_ui(llm_messages)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"UI generation failed: {e}")

    chat["updated_at"] = datetime.now(timezone.utc).isoformat()
    _save_chat(chat)
    _save_ui(session_id, component_code)

    logger.info("Run complete: session_id=%s", session_id)
    return {"session_id": session_id, "component_code": component_code}
