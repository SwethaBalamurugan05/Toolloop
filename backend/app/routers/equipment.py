from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import get_current_user_id
from app.db.supabase import get_supabase_client
from app.schemas.models import CategoryResponse, EquipmentInput, EquipmentResponse, EquipmentUpdate
from app.services.database import database_error, not_found, require_write_key

router = APIRouter(prefix="/api/equipment", tags=["equipment"])


def _equipment_row(row: dict) -> dict:
    category = row.pop("categories", None) or {}
    owner = row.pop("profiles", None) or {}
    return {
        **row,
        "category_name": category.get("name"),
        "owner_name": owner.get("full_name") or owner.get("display_name") or owner.get("email"),
    }


@router.get("", response_model=list[EquipmentResponse])
def list_equipment(
    category: str | None = None,
    q: str | None = Query(default=None, min_length=1),
    user_id: UUID = Depends(get_current_user_id),
):
    try:
        query = get_supabase_client().table("equipment").select(
            "*, categories(name), profiles!equipment_owner_id_fkey(full_name,display_name,email)"
        ).eq("is_active", True).neq("owner_id", str(user_id))
        if category:
            category_row = get_supabase_client().table("categories").select("id").eq("slug", category.lower()).execute()
            if not category_row.data:
                return []
            query = query.eq("category_id", category_row.data[0]["id"])
        if q:
            query = query.ilike("name", f"%{q.strip()}%")
        rows = query.order("name").execute().data
        return [_equipment_row(row) for row in rows]
    except Exception as error:
        raise database_error(error) from error


@router.get("/categories", response_model=list[CategoryResponse])
def list_categories():
    try:
        return get_supabase_client().table("categories").select("id,name,slug").order("name").execute().data or []
    except Exception as error:
        raise database_error(error) from error


@router.get("/mine", response_model=list[EquipmentResponse])
def list_my_equipment(user_id: UUID = Depends(get_current_user_id)):
    try:
        rows = get_supabase_client().table("equipment").select(
            "*, categories(name), profiles!equipment_owner_id_fkey(full_name,display_name,email)"
        ).eq("owner_id", str(user_id)).order("created_at", desc=True).execute().data or []
        return [_equipment_row(row) for row in rows]
    except Exception as error:
        raise database_error(error) from error


@router.get("/mine/{equipment_id}", response_model=EquipmentResponse)
def get_my_equipment(equipment_id: UUID, user_id: UUID = Depends(get_current_user_id)):
    try:
        response = get_supabase_client().table("equipment").select(
            "*, categories(name), profiles!equipment_owner_id_fkey(full_name,display_name,email)"
        ).eq("id", str(equipment_id)).eq("owner_id", str(user_id)).execute()
        if not response.data:
            raise not_found("Equipment")
        return _equipment_row(response.data[0])
    except HTTPException:
        raise
    except Exception as error:
        raise database_error(error) from error


@router.post("", response_model=EquipmentResponse, status_code=201)
def create_equipment(payload: EquipmentInput, user_id: UUID = Depends(get_current_user_id)):
    require_write_key()
    try:
        db = get_supabase_client()
        category = db.table("categories").select("id").eq("id", str(payload.category_id)).execute()
        if not category.data:
            raise HTTPException(status_code=422, detail="Select a valid category.")
        data = payload.model_dump(mode="json")
        data.update({"owner_id": str(user_id), "available_units": payload.total_units, "is_active": True})
        response = db.table("equipment").insert(data).execute()
        row = response.data[0]
        row["category_name"] = db.table("categories").select("name").eq("id", str(payload.category_id)).execute().data[0]["name"]
        row["owner_name"] = db.table("profiles").select("full_name,display_name,email").eq("id", str(user_id)).execute().data[0].get("full_name")
        return row
    except HTTPException:
        raise
    except Exception as error:
        if "duplicate key" in str(error).lower():
            raise HTTPException(status_code=409, detail="You already have equipment listed with this name.") from error
        raise database_error(error) from error


@router.get("/{equipment_id}", response_model=EquipmentResponse)
def get_equipment(equipment_id: UUID):
    try:
        response = get_supabase_client().table("equipment").select("*, categories(name), profiles!equipment_owner_id_fkey(full_name,display_name,email)").eq("id", str(equipment_id)).eq("is_active", True).execute()
        if not response.data:
            raise not_found("Equipment")
        return _equipment_row(response.data[0])
    except HTTPException:
        raise
    except Exception as error:
        raise database_error(error) from error


@router.put("/{equipment_id}", response_model=EquipmentResponse)
def update_equipment(equipment_id: UUID, payload: EquipmentUpdate, user_id: UUID = Depends(get_current_user_id)):
    require_write_key()
    try:
        db = get_supabase_client()
        existing = db.table("equipment").select("id,total_units,available_units").eq("id", str(equipment_id)).eq("owner_id", str(user_id)).execute()
        if not existing.data:
            raise not_found("Equipment")
        reserved_units = int(existing.data[0]["total_units"]) - int(existing.data[0]["available_units"])
        if payload.total_units < reserved_units:
            raise HTTPException(status_code=422, detail=f"Total quantity cannot be below {reserved_units} unit(s) currently on loan.")
        data = payload.model_dump(mode="json")
        data["available_units"] = payload.total_units - reserved_units
        response = db.table("equipment").update(data).eq("id", str(equipment_id)).eq("owner_id", str(user_id)).execute()
        row = response.data[0]
        return _equipment_row(db.table("equipment").select("*, categories(name), profiles!equipment_owner_id_fkey(full_name,display_name,email)").eq("id", row["id"]).execute().data[0])
    except HTTPException:
        raise
    except Exception as error:
        raise database_error(error) from error


@router.delete("/{equipment_id}", status_code=204)
def deactivate_equipment(equipment_id: UUID, user_id: UUID = Depends(get_current_user_id)):
    require_write_key()
    try:
        response = get_supabase_client().table("equipment").update({"is_active": False}).eq("id", str(equipment_id)).eq("owner_id", str(user_id)).execute()
        if not response.data:
            raise not_found("Equipment")
    except HTTPException:
        raise
    except Exception as error:
        raise database_error(error) from error