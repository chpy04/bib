import logging
import uuid

from app.profiler.decomposer import TaskDecomposer
from app.profiler.discoverer import FlowDiscoverer
from app.profiler.models import SiteProfile

logger = logging.getLogger(__name__)


class ProfilerPipeline:
    def __init__(self) -> None:
        self.decomposer = TaskDecomposer()
        self.discoverer = FlowDiscoverer()

    async def run(self, url: str, user_request: str) -> SiteProfile:
        logger.info("Starting profiler pipeline for %s", url)

        decomposed = await self.decomposer.decompose(url, user_request)
        logger.info("Decomposed into %d tasks", len(decomposed.tasks))

        task_profiles = await self.discoverer.discover_all(url, decomposed.tasks)

        profile = SiteProfile(
            profile_id=str(uuid.uuid4()),
            base_url=url,
            name=f"Profile for {url}",
            description=user_request,
            tasks=task_profiles,
        )

        logger.info(
            "Pipeline complete: %d tasks profiled for %s",
            len(task_profiles),
            url,
        )
        return profile
