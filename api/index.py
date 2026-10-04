"""Vercel serverless entrypoint for the ToolLoop FastAPI application."""

from pathlib import Path
import sys

BACKEND_DIRECTORY = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIRECTORY))

from app.main import app  # noqa: E402

__all__ = ["app"]