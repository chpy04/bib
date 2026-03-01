import logging

from langchain_anthropic import ChatAnthropic

from app.config import settings
from app.profiler.models import DecomposerOutput
from app.profiler.prompts import DECOMPOSER_SYSTEM, DECOMPOSER_USER

logger = logging.getLogger(__name__)


class TaskDecomposer:
    def __init__(self) -> None:
        self.llm = ChatAnthropic(
            model="claude-sonnet-4-20250514",
            api_key=settings.anthropic_api_key,
            temperature=0.0,
        )

    async def decompose(self, url: str, user_request: str) -> DecomposerOutput:
        structured_llm = self.llm.with_structured_output(DecomposerOutput)
        user_msg = DECOMPOSER_USER.format(url=url, user_request=user_request)

        result = await structured_llm.ainvoke([
            {"role": "system", "content": DECOMPOSER_SYSTEM},
            {"role": "user", "content": user_msg},
        ])

        logger.info("Decomposed into %d tasks", len(result.tasks))
        return result
