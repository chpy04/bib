from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.state import state_manager
import json

router = APIRouter()


@router.websocket("/ws/{profile_id}")
async def websocket_endpoint(websocket: WebSocket, profile_id: str):
    await websocket.accept()
    state_manager.add_client(profile_id, websocket)
    try:
        # Send current state immediately on connect
        current = state_manager.states.get(profile_id, {})
        await websocket.send_json({"type": "state_update", "data": current})

        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            # TODO: handle start_polling, stop_polling, run_action
            await websocket.send_json({"type": "ack", "received": msg["type"]})
    except WebSocketDisconnect:
        state_manager.remove_client(profile_id, websocket)
