from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.profiles import router as profiles_router
from app.routes.ws import router as ws_router
from app.routes.instructions import router as instructions_router

app = FastAPI(title="BiB - Browser in Browser")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profiles_router, prefix="/api")
app.include_router(ws_router)
app.include_router(instructions_router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
