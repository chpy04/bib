"""Standalone test: bypass app infrastructure, hit AWS Console directly via browser-use."""

import asyncio
import os
import re
import time

import requests
from browser_use import Agent, Browser, ChatBrowserUse, Controller
from dotenv import load_dotenv

load_dotenv()

AWS_EMAIL = os.environ["AWS_EMAIL"]
AWS_PASSWORD = os.environ["AWS_PASSWORD"]
AGENTMAIL_API_KEY = os.environ["AGENTMAIL_API_KEY"]

controller = Controller()


@controller.action("Get AWS verification code from email")
async def get_aws_verification_code():
    """Fetch the latest AWS verification code from AgentMail."""
    time.sleep(5)

    headers = {"Authorization": f"Bearer {AGENTMAIL_API_KEY}"}

    response = requests.get(
        f"https://api.agentmail.to/v0/inboxes/{AWS_EMAIL}/messages",
        headers=headers,
    )
    messages = response.json().get("messages", [])

    if not messages:
        return "No emails found yet. Try again in a few seconds."

    latest = messages[0]
    message_id = latest["message_id"]

    msg_response = requests.get(
        f"https://api.agentmail.to/v0/inboxes/{AWS_EMAIL}/messages/{message_id}",
        headers=headers,
    )
    msg_data = msg_response.json()

    body = msg_data.get("text", "") or msg_data.get("html", "") or ""
    subject = msg_data.get("subject", "")

    code_match = re.search(r"\b(\d{6})\b", subject + " " + body)

    if code_match:
        return code_match.group(1)

    return f"Could not find a code. Subject: {subject}, Body preview: {body[:200]}"


async def main():
    llm = ChatBrowserUse()
    browser = Browser(headless=False)
    agent = Agent(
        task=(
            f"Login to AWS Console:\n"
            f"1. Go to https://aws.amazon.com/console/\n"
            f"2. Click 'Sign In'\n"
            f"3. Select 'Root user' sign-in option\n"
            f"4. Enter email: {AWS_EMAIL}\n"
            f"5. Click Next\n"
            f"6. Enter password: {AWS_PASSWORD}\n"
            f"7. Click 'Sign in'\n"
            f"8. When prompted for email verification code, use the get_aws_verification_code action\n"
            f"9. NEVER try to read or guess the verification code\n"
            f"10. ALWAYS use the get_aws_verification_code action to get the code\n"
            f"11. Enter the returned code into the verification input field\n"
            f"12. Click 'Verify' or submit the code\n"
            f"13. Confirm login is successful and you are on the AWS Console dashboard"
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
