import httpx
from app.config import settings

SYSTEM_PROMPT = """\
You are a React component generator. You output ONLY valid JavaScript code for a single React component. No markdown, no explanation, no code fences.

Rules:
- Export the component as: export default function App() { ... }
- React is available as a global (e.g. React.useState, React.useEffect). Do NOT import React.
- Tailwind CSS classes are available for all styling. Use them freely.
- The following shadcn/ui components are available as globals (no imports needed):
  Button, Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter
- Do NOT use any import statements. Everything you need is already loaded.
- Use React.useState, React.useEffect, React.useRef etc. (not destructured imports).
- Output ONLY the component code. No commentary before or after.\
"""


async def generate_ui(url: str, user_prompt: str) -> str:
    """
    Call Dedalus Labs API to generate a React component from a user prompt.
    Returns the component source code as a string.
    """
    if url:
        user_message = f"User request: {user_prompt}"
    else:
        user_message = user_prompt

    request_body = {
        "model": "anthropic/claude-sonnet-4-20250514",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.7,
        "max_tokens": 4096,
    }

    print(f"[generator] Calling Dedalus Labs API — model={request_body['model']}")
    print(f"[generator] User message: {user_message}")

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
        # Remove first line (```jsx or ```) and last line (```)
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        code = "\n".join(lines)

    code = code.strip()
    print(f"[generator] Generated {len(code)} chars of component code")
    return code
