import asyncio
import logging

from browser_use import Browser

from app.config import settings

logger = logging.getLogger(__name__)

# URL patterns indicating a login/auth page
AUTH_URL_PATTERNS = [
    "login",
    "signin",
    "sign-in",
    "sign_in",
    "auth",
    "sso",
    "oauth",
    "accounts",
]

# DOM selectors indicating auth is available or required
AUTH_DOM_SELECTORS = [
    'input[type="password"]',
    'form[action*="login"]',
    'form[action*="signin"]',
    'a[href*="login"]',
    'a[href*="signin"]',
    'a[href*="sign_in"]',
    'button[class*="login"]',
    'button[class*="signin"]',
]

POLL_INTERVAL = 3  # seconds between checks
POLL_TIMEOUT = 120  # max wait for user to log in


class AuthHandler:
    def __init__(self, profile_id: str) -> None:
        self.profile_id = profile_id
        self.auth_path = settings.profiles_dir / profile_id / "auth.json"

    @property
    def has_saved_auth(self) -> bool:
        return self.auth_path.exists()

    async def detect_auth_needed(self, browser: Browser) -> bool:
        """Check if current page has auth signals (login links, password fields, etc.)."""
        page = await browser.get_current_page()
        url = (await page.get_url()).lower()

        # Check if we were redirected to a login page
        if any(pattern in url for pattern in AUTH_URL_PATTERNS):
            return True

        # Check DOM for auth elements
        for selector in AUTH_DOM_SELECTORS:
            elements = await page.get_elements_by_css_selector(selector)
            if elements:
                return True

        return False

    async def wait_for_login(self, browser: Browser) -> None:
        """Poll until auth signals disappear (user finished logging in)."""
        logger.info("Auth required — please log in in the browser window")
        elapsed = 0
        while elapsed < POLL_TIMEOUT:
            await asyncio.sleep(POLL_INTERVAL)
            elapsed += POLL_INTERVAL
            if not await self.detect_auth_needed(browser):
                await asyncio.sleep(3)  # stabilization — let cookies settle
                break
        else:
            raise TimeoutError(f"Login timed out after {POLL_TIMEOUT}s")

        # Save auth state for future runs
        self.auth_path.parent.mkdir(parents=True, exist_ok=True)
        await browser.export_storage_state(output_path=str(self.auth_path))
        logger.info("Auth state saved to %s", self.auth_path)

    async def check_and_handle(self, browser: Browser) -> None:
        """Detect auth signals and wait for login if needed."""
        if await self.detect_auth_needed(browser):
            await self.wait_for_login(browser)
