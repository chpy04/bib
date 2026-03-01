import asyncio
import time
from fastapi import WebSocket


class StateManager:
    def __init__(self):
        self.states: dict[str, dict] = {}
        self.clients: dict[str, list[WebSocket]] = {}

    def add_client(self, profile_id: str, ws: WebSocket):
        self.clients.setdefault(profile_id, []).append(ws)

    def remove_client(self, profile_id: str, ws: WebSocket):
        if profile_id in self.clients:
            self.clients[profile_id] = [c for c in self.clients[profile_id] if c is not ws]

    def update_state(self, profile_id: str, new_data: dict):
        self.states[profile_id] = {
            **self.states.get(profile_id, {}),
            **new_data,
            "_timestamp": time.time(),
        }
        asyncio.create_task(self._broadcast(profile_id))

    async def _broadcast(self, profile_id: str):
        state = self.states.get(profile_id, {})
        dead = []
        for ws in self.clients.get(profile_id, []):
            try:
                await ws.send_json({"type": "state_update", "data": state})
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.clients[profile_id].remove(ws)


state_manager = StateManager()
