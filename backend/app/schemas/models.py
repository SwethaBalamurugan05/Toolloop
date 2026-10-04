from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, model_validator


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)


class ProfileResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str | None = None
    display_name: str | None = None
    created_at: datetime
    updated_at: datetime


class EquipmentResponse(BaseModel):
    id: UUID
    category_id: UUID
    name: str
    description: str
    price_per_day: Decimal
    condition: str
    location: str | None
    pickup_address: str | None
    last_inspected_on: date | None
    borrowing_limit_days: int
    total_units: int
    available_units: int
    icon_key: str
    card_color: str | None
    is_active: bool
    category_name: str | None = None
    owner_id: UUID
    owner_name: str | None = None
    image_url: str | None = None


class CategoryResponse(BaseModel):
    id: UUID
    name: str
    slug: str


class EquipmentInput(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=10, max_length=1000)
    category_id: UUID
    price_per_day: Decimal = Field(ge=0)
    condition: str = Field(min_length=2, max_length=80)
    location: str | None = Field(default=None, max_length=160)
    pickup_address: str | None = Field(default=None, max_length=240)
    borrowing_limit_days: int = Field(ge=1, le=365)
    total_units: int = Field(ge=1, le=10000)
    image_url: str | None = Field(default=None, max_length=2000)
    icon_key: str = Field(default="wrench", max_length=80)
    card_color: str | None = Field(default="#F2F2F2", max_length=32)


class EquipmentUpdate(EquipmentInput):
    is_active: bool = True


class CreateRequest(BaseModel):
    equipment_id: UUID
    start_date: date
    return_date: date
    quantity: int = Field(ge=1)
    purpose: str = Field(min_length=10, max_length=200)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.return_date <= self.start_date:
            raise ValueError("Return date must be after the start date.")
        return self


class RentalRequestResponse(BaseModel):
    id: UUID
    request_number: int
    requester_id: UUID
    equipment_id: UUID
    owner_id: UUID
    start_date: date
    return_date: date
    quantity: int
    purpose: str
    rental_days: int
    price_per_day: Decimal
    total_cost: Decimal
    status: Literal["pending", "approved", "rejected", "cancelled", "issued", "returned"]
    rejection_reason: str | None = None
    reviewed_at: datetime | None = None
    equipment_name: str | None = None
    owner_name: str | None = None
    created_at: datetime
    updated_at: datetime


class RequestStatusUpdate(BaseModel):
    status: Literal["cancelled"]


class RejectRequestInput(BaseModel):
    rejection_reason: str | None = Field(default=None, max_length=500)


class OwnerRequestResponse(RentalRequestResponse):
    requester_name: str
    requester_email: EmailStr
    equipment_name: str | None = None
    equipment_icon_key: str | None = None
    equipment_card_color: str | None = None
    reviewed_by: UUID | None = None
    reviewed_at: datetime | None = None


class OwnerRequestStatisticsResponse(BaseModel):
    total_requests: int
    pending_requests: int
    approved_requests: int
    rejected_requests: int


class LoanResponse(BaseModel):
    id: UUID
    request_id: UUID | None
    borrower_id: UUID
    equipment_id: UUID
    quantity: int
    borrowed_at: datetime
    due_date: date
    returned_at: datetime | None
    status: Literal["borrowed", "returned", "overdue"]
    created_at: datetime
    updated_at: datetime


class LoginInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class SignupInput(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    expires_at: int | None = None
    user: ProfileResponse


class SignupResponse(BaseModel):
    access_token: str | None = None
    refresh_token: str | None = None
    expires_at: int | None = None
    user: ProfileResponse
    requires_email_confirmation: bool = False