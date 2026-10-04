from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import get_current_user_id
from app.db.supabase import get_supabase_client
from app.schemas.models import CreateRequest, LoanResponse, OwnerRequestResponse, RejectRequestInput, RentalRequestResponse, RequestStatusUpdate
from app.services.database import database_error, not_found, require_write_key
from app.services.loan_service import mark_loan_returned
from app.services.request_review_service import approve_request, reject_request

router = APIRouter(prefix="/api/requests", tags=["rental requests"])


def _request_row(row: dict) -> dict:
    equipment = row.pop("equipment", None) or {}
    owner = row.pop("owner", None) or {}
    renter = row.pop("renter", None) or {}
    return {
        **row,
        "equipment_name": equipment.get("name"),
        "owner_name": owner.get("full_name") or owner.get("display_name") or owner.get("email"),
        "requester_name": renter.get("full_name") or renter.get("display_name") or renter.get("email"),
        "requester_email": renter.get("email"),
        "equipment_icon_key": equipment.get("icon_key"),
        "equipment_card_color": equipment.get("card_color"),
    }


REQUEST_SELECT = "*, equipment(name,icon_key,card_color), owner:profiles!rental_requests_owner_id_fkey(full_name,display_name,email), renter:profiles!rental_requests_requester_id_fkey(full_name,display_name,email)"


@router.post("", response_model=RentalRequestResponse, status_code=201)
def create_request(payload: CreateRequest, user_id: UUID = Depends(get_current_user_id)):
    require_write_key()
    if payload.start_date < date.today():
        raise HTTPException(status_code=422, detail="Start date cannot be in the past.")
    try:
        db = get_supabase_client()
        equipment_result = db.table("equipment").select("*").eq("id", str(payload.equipment_id)).eq("is_active", True).execute()
        if not equipment_result.data:
            raise not_found("Equipment")
        equipment = equipment_result.data[0]
        if str(equipment["owner_id"]) == str(user_id):
            raise HTTPException(status_code=403, detail="You cannot request your own equipment.")
        rental_days = (payload.return_date - payload.start_date).days
        if rental_days > equipment["borrowing_limit_days"]:
            raise HTTPException(status_code=422, detail=f"Borrowing limit is {equipment['borrowing_limit_days']} days.")
        if payload.quantity > equipment["available_units"]:
            raise HTTPException(status_code=422, detail=f"Only {equipment['available_units']} unit(s) are available.")
        price_per_day = Decimal(str(equipment["price_per_day"]))
        total_cost = price_per_day * rental_days * payload.quantity
        data = {
            "requester_id": str(user_id), "owner_id": equipment["owner_id"], "equipment_id": str(payload.equipment_id),
            "start_date": payload.start_date.isoformat(), "return_date": payload.return_date.isoformat(),
            "quantity": payload.quantity, "purpose": payload.purpose.strip(), "rental_days": rental_days,
            "price_per_day": str(price_per_day), "total_cost": str(total_cost), "status": "pending",
        }
        response = db.table("rental_requests").insert(data).execute()
        return _request_row(db.table("rental_requests").select(REQUEST_SELECT).eq("id", response.data[0]["id"]).execute().data[0])
    except HTTPException:
        raise
    except Exception as error:
        raise database_error(error) from error


@router.get("/me", response_model=list[RentalRequestResponse])
def list_my_requests(user_id: UUID = Depends(get_current_user_id)):
    try:
        rows = get_supabase_client().table("rental_requests").select(REQUEST_SELECT).eq("requester_id", str(user_id)).order("created_at", desc=True).execute().data or []
        return [_request_row(row) for row in rows]
    except Exception as error:
        raise database_error(error) from error


@router.get("/for-my-equipment", response_model=list[OwnerRequestResponse])
def list_requests_for_my_equipment(user_id: UUID = Depends(get_current_user_id)):
    try:
        rows = get_supabase_client().table("rental_requests").select(REQUEST_SELECT).eq("owner_id", str(user_id)).order("created_at", desc=True).execute().data or []
        return [_request_row(row) for row in rows]
    except Exception as error:
        raise database_error(error) from error


@router.get("/{request_id}", response_model=RentalRequestResponse)
def get_my_request(request_id: UUID, user_id: UUID = Depends(get_current_user_id)):
    try:
        response = get_supabase_client().table("rental_requests").select(REQUEST_SELECT).eq("id", str(request_id)).eq("requester_id", str(user_id)).execute()
        if not response.data:
            raise not_found("Rental request")
        return _request_row(response.data[0])
    except HTTPException:
        raise
    except Exception as error:
        raise database_error(error) from error


@router.patch("/{request_id}/approve", response_model=RentalRequestResponse)
def approve_owner_request(request_id: UUID, user_id: UUID = Depends(get_current_user_id)):
    require_write_key()
    try:
        return approve_request(get_supabase_client(), request_id, user_id)
    except HTTPException:
        raise
    except Exception as error:
        raise database_error(error) from error


@router.patch("/{request_id}/reject", response_model=RentalRequestResponse)
def reject_owner_request(request_id: UUID, payload: RejectRequestInput, user_id: UUID = Depends(get_current_user_id)):
    require_write_key()
    try:
        return reject_request(get_supabase_client(), request_id, user_id, payload.rejection_reason.strip() if payload.rejection_reason else None)
    except HTTPException:
        raise
    except Exception as error:
        raise database_error(error) from error


@router.patch("/{request_id}", response_model=RentalRequestResponse)
def update_my_request(request_id: UUID, payload: RequestStatusUpdate, user_id: UUID = Depends(get_current_user_id)):
    require_write_key()
    try:
        existing = get_supabase_client().table("rental_requests").select("id,status").eq("id", str(request_id)).eq("requester_id", str(user_id)).execute()
        if not existing.data:
            raise not_found("Rental request")
        if existing.data[0]["status"] != "pending":
            raise HTTPException(status_code=409, detail="Only pending requests can be cancelled.")
        response = get_supabase_client().table("rental_requests").update({"status": payload.status}).eq("id", str(request_id)).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as error:
        raise database_error(error) from error


@router.put("/{request_id}/return", response_model=LoanResponse)
def return_request_equipment(request_id: UUID, user_id: UUID = Depends(get_current_user_id)):
    """Compatibility endpoint: return a loan by its originating request ID.

    The React app uses /api/loans/{loan_id}/return, but this endpoint supports
    the Assignment 3 request-oriented API contract without bypassing ownership
    checks or exposing another user's records.
    """
    require_write_key()
    try:
        return mark_loan_returned(get_supabase_client(), user_id=user_id, request_id=request_id)
    except HTTPException:
        raise
    except Exception as error:
        raise database_error(error) from error