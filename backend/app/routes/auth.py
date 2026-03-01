import logging

from fastapi import APIRouter, HTTPException

import app.browser as browser_session
from app.models import StartAuthRequest
from app.names import generate_name

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/auth")
async def start_auth(req: StartAuthRequest):
    """Spawn a headed browser and navigate to the target URL for manual login."""
    try:
        profile_id = generate_name()
        result = await browser_session.start_session(req.url, profile_id)
        return result
    except Exception as e:
        logger.exception("Failed to open browser")
        raise HTTPException(status_code=500, detail=f"Failed to open browser: {e}")


@router.delete("/auth")
async def stop_auth():
    """Close the browser and save auth state."""
    await browser_session.close_session()
    return {"status": "closed"}


@router.get("/auth")
async def auth_status():
    """Check whether a browser session is currently active."""
    return {
        "active": browser_session.is_active(),
        "url": browser_session.session_url(),
        "profile_id": browser_session.get_profile_id(),
    }
