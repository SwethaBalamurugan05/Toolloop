from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.core.config import get_settings
from app.core.dependencies import get_bearer_token, get_current_user_id
from app.db.supabase import get_supabase_client
from app.schemas.models import LoginInput, LoginResponse, SignupInput, SignupResponse
from app.services.database import database_error, not_found, require_write_key

router = APIRouter(prefix="/api/auth", tags=["authentication"])


def profile_for_user(db, user_id: str):
    response = db.table("profiles").select("*").eq("id", user_id).execute()
    if not response.data:
        raise not_found("Profile")
    return response.data[0]


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginInput):
    try:
        auth_response = get_supabase_client().auth.sign_in_with_password({"email": payload.email, "password": payload.password})
        if not auth_response.session or not auth_response.user:
            raise HTTPException(status_code=401, detail="Invalid username or password.")
        profile = profile_for_user(get_supabase_client(), str(auth_response.user.id))
        return {
            "access_token": auth_response.session.access_token,
            "refresh_token": auth_response.session.refresh_token,
            "expires_at": auth_response.session.expires_at,
            "user": profile,
        }
    except HTTPException:
        raise
    except Exception as error:
        # Supabase intentionally does not disclose whether the email exists.
        message = str(error).lower()
        if "invalid login" in message or "invalid credentials" in message:
            raise HTTPException(status_code=401, detail="Invalid username or password.") from error
        raise database_error(error) from error


@router.post("/signup", response_model=SignupResponse, status_code=201)
def signup(payload: SignupInput):
    """Create a Supabase Auth account and its linked public profile.

    Supabase Auth owns password hashing/storage. The server only writes profile
    metadata keyed by the Auth user ID returned by Supabase.
    """
    try:
        require_write_key()
        db = get_supabase_client()
        existing_profile = db.table("profiles").select("id").eq("email", payload.email.lower()).execute()
        if existing_profile.data:
            raise HTTPException(status_code=409, detail="An account with this email already exists. Please log in.")

        auth_response = db.auth.sign_up({
            "email": payload.email.lower(),
            "password": payload.password,
            "options": {"data": {"full_name": payload.full_name.strip(), "display_name": payload.full_name.strip()}},
        })
        if not auth_response.user:
            raise HTTPException(status_code=503, detail="Unable to create your account. Please try again.")

        # Supabase may return an empty identities list for an existing account
        # when email enumeration protection is enabled.
        if getattr(auth_response.user, "identities", None) == []:
            raise HTTPException(status_code=409, detail="An account with this email already exists. Please log in.")

        profile_data = {
            "id": str(auth_response.user.id),
            "email": payload.email.lower(),
            "full_name": payload.full_name.strip(),
            "display_name": payload.full_name.strip(),
        }
        # auth.sign_up() may attach the new user's session to ``db``. Use a
        # separate service-role client so this upsert cannot run under the new
        # user's RLS context.
        profile_db = get_supabase_client()
        profile_db.table("profiles").upsert(profile_data).execute()
        profile = profile_for_user(profile_db, str(auth_response.user.id))
        session = auth_response.session
        return {
            "access_token": session.access_token if session else "",
            "refresh_token": session.refresh_token if session else None,
            "expires_at": session.expires_at if session else None,
            "user": profile,
            "requires_email_confirmation": session is None,
        }
    except HTTPException:
        raise
    except Exception as error:
        message = str(error).lower()
        if "already registered" in message or "already exists" in message or "user already" in message:
            raise HTTPException(status_code=409, detail="An account with this email already exists. Please log in.") from error
        raise database_error(error) from error


@router.post("/logout", status_code=204)
def logout(_user_id: UUID = Depends(get_current_user_id), token: str = Depends(get_bearer_token)):
    """Invalidate the active Supabase Auth session, then let the browser clear its cached token."""
    try:
        settings = get_settings()
        response = httpx.post(
            f"{settings.supabase_url}/auth/v1/logout",
            headers={"apikey": settings.supabase_key, "Authorization": f"Bearer {token}"},
            json={"scope": "local"},
            timeout=8.0,
        )
        response.raise_for_status()
    except Exception:
        # Client-side token removal still guarantees ToolLoop's local logout and
        # protected-route redirect if Supabase session revocation is unavailable.
        pass