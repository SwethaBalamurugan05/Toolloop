from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status

from app.db.supabase import get_supabase_client


def get_bearer_token(authorization: Annotated[str | None, Header()] = None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token.")
    return authorization.removeprefix("Bearer ").strip()


def get_current_user_id(token: Annotated[str, Depends(get_bearer_token)]) -> UUID:
    try:
        response = get_supabase_client().auth.get_user(token)
        user = response.user
        if not user:
            raise ValueError("No authenticated user.")
        return UUID(str(user.id))
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session.") from error

