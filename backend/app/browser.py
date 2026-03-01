import logging
from pathlib import Path

from browser_use import Browser  # Browser is an alias for BrowserSession in 0.12+

from app.config import settings

logger = logging.getLogger(__name__)


def auth_state_path(profile_id: str) -> Path:
    return settings.profiles_dir / profile_id / "auth.json"


# Single persistent browser shared by all agents for the session
_browser: Browser | None = None
_session_url: str = ""
_profile_id: str = ""


async def start_session(url: str, profile_id: str) -> dict:
    """Spawn a headed browser and navigate to url so the user can log in.

    The browser stays alive for the entire session. Auth state is persisted
    to the profile's auth.json via export_storage_state() so agents reload it.
    """
    global _browser, _session_url, _profile_id

    _session_url = url
    _profile_id = profile_id
    state_path = auth_state_path(profile_id)
    state_path.parent.mkdir(parents=True, exist_ok=True)

    if _browser is not None:
        try:
            await _browser.stop()
        except Exception:
            pass

    storage_state = str(state_path) if state_path.exists() else None
    _browser = Browser(headless=False, storage_state=storage_state)
    await _browser.start()

    # Navigate to the target URL so the user can log in
    await _browser.new_page(url)

    logger.info("Auth browser opened at %s (profile %s)", url, profile_id)
    return {"status": "ready", "message": "Browser opened. Please log in manually.", "profile_id": profile_id}


def get_browser() -> Browser:
    """Return the persistent browser session used by all agents."""
    if _browser is None:
        raise RuntimeError("No active browser session. POST /api/auth first.")
    return _browser


def get_profile_id() -> str:
    return _profile_id


def is_active() -> bool:
    return _browser is not None


def session_url() -> str:
    return _session_url


async def close_session() -> None:
    """Export auth state to disk, then close the browser."""
    global _browser, _session_url, _profile_id
    if _browser and _profile_id:
        state_path = auth_state_path(_profile_id)
        try:
            await _browser.export_storage_state(state_path)
            logger.info("Auth state saved to %s", state_path)
        except Exception as e:
            logger.warning("Could not export storage state: %s", e)
        try:
            await _browser.stop()
        except Exception:
            logger.warning("Error closing browser")
        _browser = None
        _session_url = ""
        _profile_id = ""
        logger.info("Browser session closed")
