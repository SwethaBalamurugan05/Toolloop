from uuid import UUID

from fastapi import HTTPException

from app.services.database import not_found


def mark_loan_returned(db, *, user_id: UUID, loan_id: UUID | None = None, request_id: UUID | None = None):
    """Return one active loan owned by the authenticated user.

    A caller may identify the loan directly or through its rental request. The
    API routers pass an authenticated user ID, so one user cannot return
    another user's equipment.
    """
    query = db.table("loans").select("*").eq("borrower_id", str(user_id))
    if loan_id:
        query = query.eq("id", str(loan_id))
    elif request_id:
        query = query.eq("request_id", str(request_id))
    else:
        raise ValueError("A loan ID or request ID is required.")

    result = query.execute()
    if not result.data:
        raise not_found("Loan")

    loan = result.data[0]
    try:
        response = db.rpc("return_loan_and_release_inventory", {"p_loan_id": loan["id"], "p_borrower_id": str(user_id)}).execute()
        return response.data[0] if isinstance(response.data, list) else response.data
    except Exception as error:
        message = str(error).lower()
        if "already been returned" in message:
            raise HTTPException(status_code=409, detail="This item has already been returned.") from error
        if "not found" in message:
            raise not_found("Loan") from error
        raise