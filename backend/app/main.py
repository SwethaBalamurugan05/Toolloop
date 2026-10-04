from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import auth, equipment, loans, profiles, requests

settings = get_settings()
app = FastAPI(title="ToolLoop API", version="1.0.0")
local_vite_origins = {"http://localhost:5173", "http://127.0.0.1:5173"}
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(local_vite_origins | set(settings.frontend_origins())),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(profiles.router)
app.include_router(equipment.router)
app.include_router(requests.router)
app.include_router(loans.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}