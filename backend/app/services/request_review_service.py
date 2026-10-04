from uuid import UUID

from fastapi import HTTPException, status


def _translate_review_error(error: Exception) -> HTTPException:
    message = str(error)
    if "not found" in message.lower():
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rental request not found.")
    if "authorization is required" in message.lower() or "ownership could not be verified" in message.lower():
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only review requests for equipment you own.")
    if "already been processed" in message.lower() or "insufficient equipment" in message.lower():
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message)
    raise error


def approve_request(db, request_id: UUID, owner_id: UUID):
    try:
        response = db.rpc("approve_owner_rental_request", {"p_request_id": str(request_id), "p_owner_id": str(owner_id)}).execute()
        return response.data[0] if isinstance(response.data, list) else response.data
    except Exception as error:
        raise _translate_review_error(error) from error


def reject_request(db, request_id: UUID, owner_id: UUID, rejection_reason: str | None):
    try:
        response = db.rpc("reject_owner_rental_request", {
            "p_request_id": str(request_id),
            "p_owner_id": str(owner_id),
            "p_rejection_reason": rejection_reason,
        }).execute()
        return response.data[0] if isinstance(response.data, list) else response.data
    except Exception as error:
        raise _translate_review_error(error) from error