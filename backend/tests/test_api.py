from datetime import date

from fastapi import HTTPException

from app.core.config import Settings
from app.schemas.models import CreateRequest, EquipmentUpdate
from app.services.database import not_found, require_write_key


def test_request_schema_rejects_invalid_dates():
    try:
        CreateRequest(equipment_id="00000000-0000-0000-0000-000000000001", start_date=date(2026, 10, 10), return_date=date(2026, 10, 10), quantity=1, purpose="A valid request purpose")
        assert False, "Expected invalid dates to be rejected"
    except ValueError:
        assert True


def test_not_found_error_uses_404():
    error = not_found("Equipment")
    assert isinstance(error, HTTPException)
    assert error.status_code == 404
    assert error.detail == "Equipment not found."


def test_publishable_key_is_not_accepted_for_database_writes(monkeypatch):
    monkeypatch.setattr("app.services.database.get_settings", lambda: Settings(supabase_url="https://example.supabase.co", supabase_key="sb_publishable_example"))
    try:
        require_write_key()
        assert False, "Expected write guard to reject a publishable key"
    except HTTPException as error:
        assert error.status_code == 503


def test_service_role_key_is_accepted_for_database_writes(monkeypatch):
    monkeypatch.setattr("app.services.database.get_settings", lambda: Settings(supabase_url="https://example.supabase.co", supabase_key="sb_secret_server_only"))
    require_write_key()


def test_equipment_update_json_dump_serializes_category_uuid():
    category_id = "00000000-0000-0000-0000-000000000001"
    payload = EquipmentUpdate(
        name="Cordless Drill",
        description="A reliable drill for a range of home projects.",
        category_id=category_id,
        price_per_day="12.50",
        condition="Good",
        borrowing_limit_days=3,
        total_units=2,
    )

    data = payload.model_dump(mode="json")

    assert data["category_id"] == category_id
    assert data["price_per_day"] == "12.50"