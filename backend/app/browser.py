import logging
from pathlib import Path

from browser_use import Browser  # Browser is an alias for BrowserSession in 0.12+

logger = logging.getLogger(__name__)

AUTH_STATE_PATH = Path(__file__).parent.parent / "data" / "auth.json"

# Single persistent browser shared by all agents for the session
_browser: Browser | None = None
_session_url: str = ""


async def start_session(url: str) -> dict:
    """Spawn a headed browser and navigate to url so the user can log in.

    The browser stays alive for the entire session. Auth state is persisted
    to AUTH_STATE_PATH via export_storage_state() so agents reload it.
    """
    global _browser, _session_url

    _session_url = url
    AUTH_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)

    if _browser is not None:
        try:
            await _browser.stop()
        except Exception:
            pass

    storage_state = str(AUTH_STATE_PATH) if AUTH_STATE_PATH.exists() else None
    _browser = Browser(headless=False, storage_state=storage_state)
    await _browser.start()

    # Navigate to the target URL so the user can log in
    await _browser.new_page(url)

    logger.info("Auth browser opened at %s", url)
    return {"status": "ready", "message": "Browser opened. Please log in manually."}


def get_browser() -> Browser:
    """Return the persistent browser session used by all agents."""
    if _browser is None:
        raise RuntimeError("No active browser session. POST /api/auth first.")
    return _browser


def is_active() -> bool:
    return _browser is not None


def session_url() -> str:
    return _session_url


async def close_session() -> None:
    """Export auth state to disk, then close the browser."""
    global _browser, _session_url
    if _browser:
        try:
            await _browser.export_storage_state(AUTH_STATE_PATH)
            logger.info("Auth state saved to %s", AUTH_STATE_PATH)
        except Exception as e:
            logger.warning("Could not export storage state: %s", e)
        try:
            await _browser.stop()
        except Exception:
            logger.warning("Error closing browser")
        _browser = None
        _session_url = ""
        logger.info("Browser session closed")
