"""Convenience FastAPI entrypoint for `python -m uvicorn main:app`.

The application code lives in app/ to keep routes, schemas, configuration and
Supabase access separate.
"""

from app.main import app

__all__ = ["app"]