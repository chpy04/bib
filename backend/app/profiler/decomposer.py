import logging

from app.config import settings
from app.profiler.models import DecomposerOutput
from app.profiler.prompts import DECOMPOSER_SYSTEM, DECOMPOSER_USER

logger = logging.getLogger(__name__)


def _make_llm():
    """Return a LangChain LLM based on the configured LLM_PROVIDER."""
    provider = settings.llm_provider.lower()
    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=settings.anthropic_model,
            api_key=settings.anthropic_api_key,
            temperature=0.0,
        )
    # Default: OpenAI
    from langchain_openai import ChatOpenAI
    return ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        temperature=0.0,
    )


class TaskDecomposer:
    def __init__(self) -> None:
        self.llm = _make_llm()

    async def decompose(self, url: str, user_request: str) -> DecomposerOutput:
        structured_llm = self.llm.with_structured_output(DecomposerOutput)
        user_msg = DECOMPOSER_USER.format(url=url, user_request=user_request)

        result = await structured_llm.ainvoke([
            {"role": "system", "content": DECOMPOSER_SYSTEM},
            {"role": "user", "content": user_msg},
        ])

        logger.info("Decomposed into %d tasks", len(result.tasks))
        return result
