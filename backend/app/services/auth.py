import logging
from pathlib import Path

from browser_use import Browser

from app.config import settings

logger = logging.getLogger(__name__)

# In-memory registry of active auth sessions: profile_id -> Browser
_active_sessions: dict[str, Browser] = {}


def auth_state_path(profile_id: str) -> Path:
    """Get the path to a profile's auth state file."""
    return settings.profiles_dir / profile_id / "auth_state.json"


async def start_auth_session(profile_id: str, base_url: str) -> None:
    """Open a visible browser for manual authentication.

    Uses browser-use's storage_state to auto-load existing cookies on startup
    and auto-save cookies on shutdown.
    """
    if profile_id in _active_sessions:
        raise RuntimeError(f"Auth session already active for profile {profile_id}")

    path = auth_state_path(profile_id)
    path.parent.mkdir(parents=True, exist_ok=True)

    browser = Browser(
        headless=False,
        storage_state=str(path),
        user_data_dir=None,
    )

    await browser.start()

    page = await browser.get_current_page()
    await page.goto(base_url)

    _active_sessions[profile_id] = browser
    logger.info("Auth session started for profile %s at %s", profile_id, base_url)


async def stop_auth_session(profile_id: str) -> bool:
    """Close the auth browser. Cookies are auto-saved by StorageStateWatchdog on stop.

    Returns True if a session was stopped, False if none was active.
    """
    browser = _active_sessions.pop(profile_id, None)
    if browser is None:
        return False

    await browser.stop()
    logger.info("Auth session stopped for profile %s", profile_id)
    return True


def has_active_session(profile_id: str) -> bool:
    return profile_id in _active_sessions


def has_saved_auth(profile_id: str) -> bool:
    return auth_state_path(profile_id).exists()
