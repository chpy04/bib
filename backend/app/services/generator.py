from pathlib import Path

import httpx
from app.config import settings

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def load_prompt(name: str) -> str:
    """Load a prompt from the prompts directory by filename (without extension)."""
    path = PROMPTS_DIR / f"{name}.md"
    return path.read_text().strip()


async def generate_ui(messages: list[dict]) -> str:
    """
    Call Dedalus Labs API to generate a React component.
    Takes the full conversation history (with system prompt prepended).
    Returns the component source code as a string.
    """
    system_prompt = load_prompt("ui-generation")
    full_messages = [{"role": "system", "content": system_prompt}] + messages

    request_body = {
        "model": "anthropic/claude-sonnet-4-20250514",
        "messages": full_messages,
        "temperature": 0.7,
        "max_tokens": 4096,
    }

    print(f"[generator] Calling Dedalus Labs API — model={request_body['model']}, {len(messages)} message(s)")
    print(f"[generator] Latest user message: {messages[-1]['content']}")

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.dedaluslabs.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.dedalus_api_key}",
                "Content-Type": "application/json",
            },
            json=request_body,
        )

    print(f"[generator] Response status: {response.status_code}")

    if response.status_code != 200:
        print(f"[generator] Error: {response.text}")
        response.raise_for_status()

    data = response.json()

    code = data["choices"][0]["message"]["content"]

    # Strip markdown fences if the model included them despite instructions
    if code.startswith("```"):
        lines = code.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        code = "\n".join(lines)

    code = code.strip()
    print(f"[generator] Generated {len(code)} chars of component code")
    return code
