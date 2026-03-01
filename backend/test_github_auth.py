"""Standalone test: bypass app infrastructure, hit GitHub directly via browser-use."""

import asyncio
import os

import pyotp
from browser_use import Agent, Browser, ChatBrowserUse, Controller
from dotenv import load_dotenv

load_dotenv()

GITHUB_USERNAME = os.environ["GITHUB_USERNAME"]
GITHUB_PASSWORD = os.environ["GITHUB_PASSWORD"]
GITHUB_TOTP_SECRET = os.environ["GITHUB_TOTP_SECRET"]

controller = Controller()


@controller.action("Get GitHub 2FA code")
async def get_2fa_code():
    """Generate a fresh TOTP code for GitHub authentication."""
    totp = pyotp.TOTP(GITHUB_TOTP_SECRET)
    code = totp.now()
    return f"The 2FA code is: {code}"


async def main():
    llm = ChatBrowserUse()
    browser = Browser(headless=False)
    agent = Agent(
        task=(
            f"Login to GitHub:\n"
            f"1. Go to https://github.com/login\n"
            f"2. Enter username: {GITHUB_USERNAME}\n"
            f"3. Enter password: {GITHUB_PASSWORD}\n"
            f"4. When prompted for 2FA, click the 'Use your authenticator app' option/button\n"
            f"5. Use the get_2fa_code action to get the authentication code\n"
            f"6. NEVER try to read or extract 2FA codes from the page\n"
            f"7. ALWAYS use the get_2fa_code action to get the authentication code\n"
            f"8. Enter the returned code into the 2FA/TOTP input field\n"
            f"9. Confirm login is successful\n"
            f"10. Go to https://github.com/{GITHUB_USERNAME}?tab=repositories\n"
            f"11. Extract the list of all repository names"
        ),
        llm=llm,
        browser=browser,
        controller=controller,
    )
    history = await agent.run()
    print("RESULT:", history.final_result())
    print("SUCCESS:", history.is_successful())
    print("ERRORS:", history.errors())


if __name__ == "__main__":
    asyncio.run(main())
