import asyncio
import json
import logging
from pathlib import Path

from browser_use import Agent, Browser

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


def _make_llm():
    """Return a Browser Use LLM based on the configured LLM_PROVIDER."""
    provider = settings.llm_provider.lower()
    if provider == "anthropic":
        from browser_use import ChatAnthropic
        return ChatAnthropic(
            model=settings.anthropic_model,
            api_key=settings.anthropic_api_key,
            temperature=0.0,
        )
    from browser_use import ChatOpenAI
    return ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        temperature=0.0,
    )


# Keys from the prompt schema that the LLM sometimes erroneously puts inside suggested_fields
_SUGGESTED_FIELDS_META_KEYS = frozenset({
    "extracted_data_json", "agent_prompt_used", "suggested_fields", "is_list",
})


def _parse_discovery_result(raw: str) -> DiscoveryResult | None:
    """
    Parse the agent's final_result() string into a DiscoveryResult.

    The agent is prompted to return a JSON object. We strip markdown fences,
    attempt to parse the JSON, then clean up suggested_fields defensively.
    Returns None if parsing or construction fails unrecoverably.
    """
    if not raw:
        return None

    # Strip markdown fences the LLM sometimes adds
    cleaned = (
        raw.strip()
        .removeprefix("```json")
        .removeprefix("```")
        .removesuffix("```")
        .strip()
    )

    # Primary parse attempt
    data: dict | None = None
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        # The output may be truncated (agent hit a character limit on done()).
        # Try progressively patching the truncated string by closing open braces.
        for closing in ("}", "}}", "}}}", "}}}}", "}", "]}", "]}}", "]}}}"):
            try:
                data = json.loads(cleaned + closing)
                logger.warning(
                    "Discovery result JSON was truncated; recovered by appending %r", closing
                )
                break
            except json.JSONDecodeError:
                continue

    if not isinstance(data, dict):
        logger.warning("Could not parse discovery result as JSON: %s", cleaned[:300])
        return None

    # Validate required fields are present
    required = {"extracted_data_json", "agent_prompt_used", "suggested_fields", "is_list"}
    missing = required - set(data.keys())
    if missing:
        logger.warning("Discovery result missing fields: %s", missing)
        return None

    # Clean suggested_fields: keep only flat string-typed entries that aren't meta-keys.
    # The LLM sometimes puts the prompt's own top-level keys in here, or nests objects.
    raw_fields = data.get("suggested_fields") or {}
    suggested_fields: dict[str, str] = {
        k: v
        for k, v in raw_fields.items()
        if k not in _SUGGESTED_FIELDS_META_KEYS and isinstance(v, str)
    }
    if not suggested_fields:
        logger.warning(
            "suggested_fields was empty or all invalid after filtering (raw keys: %s)",
            list(raw_fields.keys())[:10],
        )
        # Don't abort — an empty schema is still useful for generating the instruction

    try:
        return DiscoveryResult(
            extracted_data_json=str(data["extracted_data_json"]),
            agent_prompt_used=str(data["agent_prompt_used"]),
            suggested_fields=suggested_fields,
            is_list=bool(data["is_list"]),
        )
    except Exception as e:
        logger.warning("Failed to construct DiscoveryResult: %s", e)
        return None


class FlowDiscoverer:
    def __init__(self) -> None:
        self.llm = _make_llm()
        self._semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    async def discover_all(
        self,
        url: str,
        tasks: list[DecomposedTask],
        storage_state: str | Path | None = None,
    ) -> list[TaskProfile]:
        coros = [self._discover_one(url, task, storage_state) for task in tasks]
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

    async def _discover_one(
        self,
        url: str,
        task: DecomposedTask,
        storage_state: str | Path | None = None,
    ) -> TaskProfile | None:
        async with self._semaphore:
            browser = Browser(
                headless=False,
                storage_state=str(storage_state) if storage_state else None,
                user_data_dir=None,
            )
            try:
                prompt = DISCOVERER_TASK.format(
                    url=url, task_description=task.description
                )

                # No output_model_schema — OpenAI strict mode rejects complex
                # schemas with dict fields. We parse final_result() as JSON instead.
                agent = Agent(
                    task=prompt,
                    llm=self.llm,
                    browser=browser,
                    max_steps=15,
                    max_failures=3,
                )

                history = await agent.run()

                raw = history.final_result()
                if not raw:
                    logger.warning("Empty result for task %s", task.name)
                    return None

                result = _parse_discovery_result(raw)
                if result is None:
                    logger.warning("Could not parse discovery result for task %s", task.name)
                    return None

                # Parse the JSON string back into a Python object for storage
                try:
                    extracted_data = json.loads(result.extracted_data_json)
                except (json.JSONDecodeError, TypeError):
                    logger.warning(
                        "Could not parse extracted_data_json for task %s, storing raw string",
                        task.name,
                    )
                    extracted_data = result.extracted_data_json

                input_params: list[str] | None = None
                if task.type.value == "ACTION":
                    input_params = list(result.suggested_fields.keys()) or None

                logger.info(
                    "Successfully discovered task %s with %d suggested fields",
                    task.name,
                    len(result.suggested_fields),
                )

                return TaskProfile(
                    name=task.name,
                    type=task.type,
                    description=task.description,
                    agent_prompt=result.agent_prompt_used,
                    input_params=input_params,
                    output_schema=OutputSchema(
                        fields=result.suggested_fields,
                        is_list=result.is_list,
                        sample_data=extracted_data,
                    ),
                )
            except Exception:
                logger.exception("Error discovering task %s", task.name)
                raise
            finally:
                try:
                    await browser.stop()
                except Exception:
                    logger.warning("Failed to stop browser for task %s", task.name)
