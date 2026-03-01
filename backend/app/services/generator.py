import logging
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


def load_prompt(name: str) -> str:
    """Load a prompt from the prompts directory by filename (without extension)."""
    path = PROMPTS_DIR / f"{name}.md"
    return path.read_text().strip()


def _make_llm():
    provider = settings.llm_provider.lower()
    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=settings.anthropic_model,
            api_key=settings.anthropic_api_key,
            temperature=0.7,
        )
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        temperature=0.7,
    )


async def generate_ui(messages: list[dict]) -> str:
    """Generate a React component using the configured LLM.

    messages: list of {"role": "user"|"assistant", "content": str}
    Returns the generated component source code as a string.
    """
    system_prompt = load_prompt("ui-generation")
    full_messages = [{"role": "system", "content": system_prompt}] + messages

    logger.info(
        "[generator] Calling %s — %d message(s), latest: %s",
        settings.llm_provider,
        len(messages),
        messages[-1]["content"][:120] if messages else "",
    )

    llm = _make_llm()
    result = await llm.ainvoke(full_messages)
    code = result.content if isinstance(result.content, str) else str(result.content)

    # Strip markdown code fences if the LLM wraps the output despite instructions
    code = code.strip()
    if code.startswith("```"):
        lines = code.split("\n")
        lines = lines[1:]  # drop opening ```jsx / ```tsx line
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        code = "\n".join(lines).strip()

    logger.info("[generator] Generated %d chars of component code", len(code))
    return code
