import asyncio
import logging

from browser_use import Agent, Browser, ChatAnthropic

from app.config import settings
from app.profiler.models import (
    DecomposedTask,
    DiscoveryResult,
    OutputSchema,
    TaskProfile,
)
from app.profiler.prompts import DISCOVERER_TASK

logger = logging.getLogger(__name__)

MAX_CONCURRENT = 3


class FlowDiscoverer:
    def __init__(self) -> None:
        self.llm = ChatAnthropic(
            model="claude-sonnet-4-20250514",
            api_key=settings.anthropic_api_key,
            temperature=0.0,
        )
        self._semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    async def discover_all(
        self, url: str, tasks: list[DecomposedTask]
    ) -> list[TaskProfile]:
        coros = [self._discover_one(url, task) for task in tasks]
        results = await asyncio.gather(*coros, return_exceptions=True)

        profiles: list[TaskProfile] = []
        for task, result in zip(tasks, results):
            if isinstance(result, Exception):
                logger.error("Discovery failed for task %s: %s", task.name, result)
                continue
            if result is not None:
                profiles.append(result)

        logger.info("Discovered %d/%d tasks", len(profiles), len(tasks))
        return profiles

    async def _discover_one(self, url: str, task: DecomposedTask) -> TaskProfile | None:
        async with self._semaphore:
            browser = Browser(headless=False)
            try:
                prompt = DISCOVERER_TASK.format(
                    url=url, task_description=task.description
                )

                agent = Agent(
                    task=prompt,
                    llm=self.llm,
                    browser=browser,
                    output_model_schema=DiscoveryResult,
                )

                history = await agent.run()
                result: DiscoveryResult | None = history.structured_output

                if result is None:
                    logger.warning("No structured output for task %s", task.name)
                    return None

                input_params: list[str] | None = None
                if task.type.value == "ACTION":
                    input_params = list(result.suggested_fields.keys()) or None

                return TaskProfile(
                    name=task.name,
                    type=task.type,
                    description=task.description,
                    agent_prompt=result.agent_prompt_used,
                    input_params=input_params,
                    output_schema=OutputSchema(
                        fields=result.suggested_fields,
                        is_list=result.is_list,
                        sample_data=result.extracted_data,
                    ),
                )
            except Exception:
                logger.exception("Error discovering task %s", task.name)
                raise
            finally:
                await browser.stop()
