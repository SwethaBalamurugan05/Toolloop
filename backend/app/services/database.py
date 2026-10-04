import logging

from fastapi import HTTPException, status

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def database_error(error: Exception) -> HTTPException:
    # Keep internal Supabase/PostgreSQL details out of browser responses while
    # retaining the exception and traceback in the FastAPI server log.
    logger.exception("Supabase database operation failed: %s", error)
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="The database is temporarily unavailable. Please try again.",
    )


def require_write_key() -> None:
    if not get_settings().has_service_role_key():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Backend SUPABASE_KEY must be configured with the server-only Supabase service_role key for database writes.",
        )


def not_found(resource: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{resource} not found.")