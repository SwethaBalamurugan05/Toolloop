from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import get_current_user_id
from app.db.supabase import get_supabase_client
from app.schemas.models import LoanResponse
from app.services.database import database_error, require_write_key
from app.services.loan_service import mark_loan_returned

router = APIRouter(prefix="/api/loans", tags=["loans"])


@router.get("/me", response_model=list[LoanResponse])
def list_my_loans(user_id: UUID = Depends(get_current_user_id)):
    try:
        return get_supabase_client().table("loans").select("*").eq("borrower_id", str(user_id)).in_("status", ["borrowed", "overdue"]).order("due_date").execute().data
    except Exception as error:
        raise database_error(error) from error


@router.post("/{loan_id}/return", response_model=LoanResponse)
def return_loan(loan_id: UUID, user_id: UUID = Depends(get_current_user_id)):
    require_write_key()
    try:
        return mark_loan_returned(get_supabase_client(), user_id=user_id, loan_id=loan_id)
    except HTTPException:
        raise
    except Exception as error:
        raise database_error(error) from error