from functools import lru_cache
import base64
import json
import os

from dotenv import load_dotenv
from pydantic import BaseModel, Field

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))


class Settings(BaseModel):
    supabase_url: str = Field(default_factory=lambda: os.getenv("SUPABASE_URL", ""))
    supabase_key: str = Field(default_factory=lambda: os.getenv("SUPABASE_KEY", ""))
    frontend_origin: str = Field(default_factory=lambda: os.getenv("FRONTEND_ORIGIN", "http://localhost:5173"))

    def frontend_origins(self) -> list[str]:
        """Return an explicit, comma-separated browser-origin allowlist."""
        return [origin.strip().rstrip("/") for origin in self.frontend_origin.split(",") if origin.strip()]

    def validate_supabase(self) -> None:
        if not self.supabase_url or not self.supabase_key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be configured in backend/.env.")

    def has_service_role_key(self) -> bool:
        if self.supabase_key.startswith("sb_publishable_") or self.supabase_key.startswith("sb_anon_"):
            return False
        if self.supabase_key.startswith("sb_secret_"):
            return True
        # Legacy Supabase keys are JWTs. Inspect their unverified role claim only
        # to ensure we never mistake an anon key for a server key.
        try:
            payload = self.supabase_key.split(".")[1] + "==="
            return json.loads(base64.urlsafe_b64decode(payload))["role"] == "service_role"
        except (IndexError, KeyError, ValueError, json.JSONDecodeError):
            return False


@lru_cache
def get_settings() -> Settings:
    return Settings()