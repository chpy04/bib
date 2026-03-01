from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.routes.auth import router as auth_router
from app.routes.data import router as data_router
from app.routes.tasks import router as tasks_router

app = FastAPI(title="BiB — Browser in Browser")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"[server] {request.method} {request.url.path}")
    response = await call_next(request)
    print(f"[server] {request.method} {request.url.path} -> {response.status_code}")
    return response


app.include_router(auth_router, prefix="/api")
app.include_router(tasks_router, prefix="/api")
app.include_router(data_router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
