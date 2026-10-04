from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import get_current_user_id
from app.db.supabase import get_supabase_client
from app.schemas.models import ProfileResponse, ProfileUpdate
from app.services.database import database_error, not_found

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


@router.get("/me", response_model=ProfileResponse)
def get_my_profile(user_id: UUID = Depends(get_current_user_id)):
    try:
        response = get_supabase_client().table("profiles").select("*").eq("id", str(user_id)).execute()
        if not response.data:
            raise not_found("Profile")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as error:
        raise database_error(error) from error


@router.patch("/me", response_model=ProfileResponse)
def update_my_profile(payload: ProfileUpdate, user_id: UUID = Depends(get_current_user_id)):
    try:
        response = get_supabase_client().table("profiles").update(payload.model_dump(exclude_none=True)).eq("id", str(user_id)).execute()
        if not response.data:
            raise not_found("Profile")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as error:
        raise database_error(error) from error