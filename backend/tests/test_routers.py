from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import get_current_user_id
from app.main import app
from app.routers import auth, equipment, loans, requests


client = TestClient(app)
TEST_USER_ID = uuid4()


@pytest.fixture(autouse=True)
def clear_dependency_overrides():
    """Keep authentication overrides isolated to the tests that need them."""
    yield
    app.dependency_overrides.clear()


def authenticate_test_request():
    app.dependency_overrides[get_current_user_id] = lambda: TEST_USER_ID


def test_invalid_equipment_id_returns_422():
    response = client.get("/api/equipment/not-a-uuid")
    assert response.status_code == 422


@pytest.mark.parametrize("origin", ["http://localhost:5173", "http://127.0.0.1:5173"])
def test_local_vite_origins_are_allowed(origin):
    response = client.options(
        "/api/auth/signup",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


def test_missing_equipment_returns_404(monkeypatch):
    class EmptyQuery:
        def select(self, *_args): return self
        def eq(self, *_args): return self
        def execute(self): return type("Response", (), {"data": []})()

    class FakeSupabase:
        def table(self, _name): return EmptyQuery()

    monkeypatch.setattr(equipment, "get_supabase_client", lambda: FakeSupabase())
    response = client.get(f"/api/equipment/{uuid4()}")
    assert response.status_code == 404


def test_my_equipment_detail_scopes_lookup_to_authenticated_owner(monkeypatch):
    authenticate_test_request()
    equipment_id = uuid4()
    captured = {}

    class Query:
        def select(self, *_args): return self
        def eq(self, field, value): captured[field] = value; return self
        def execute(self): return type("Response", (), {"data": []})()

    monkeypatch.setattr(equipment, "get_supabase_client", lambda: type("Db", (), {"table": lambda _self, _name: Query()})())
    response = client.get(f"/api/equipment/mine/{equipment_id}")
    assert response.status_code == 404
    assert captured == {"id": str(equipment_id), "owner_id": str(TEST_USER_ID)}


def test_database_failure_returns_503(monkeypatch):
    authenticate_test_request()
    monkeypatch.setattr(equipment, "get_supabase_client", lambda: (_ for _ in ()).throw(RuntimeError("database offline")))
    response = client.get("/api/equipment")
    assert response.status_code == 503
    assert response.json()["detail"] == "The database is temporarily unavailable. Please try again."


def test_marketplace_equipment_excludes_authenticated_owner(monkeypatch):
    authenticate_test_request()
    captured = {}

    class Query:
        def select(self, *_args): return self
        def eq(self, field, value): captured[field] = value; return self
        def neq(self, field, value): captured[field] = value; return self
        def order(self, *_args, **_kwargs): return self
        def execute(self): return type("Response", (), {"data": []})()

    monkeypatch.setattr(equipment, "get_supabase_client", lambda: type("Db", (), {"table": lambda _self, _name: Query()})())
    response = client.get("/api/equipment")

    assert response.status_code == 200
    assert captured == {"is_active": True, "owner_id": str(TEST_USER_ID)}


def test_request_update_invalid_id_returns_422():
    authenticate_test_request()
    response = client.patch("/api/requests/not-a-uuid", json={"status": "cancelled"})
    assert response.status_code == 422


def test_loan_return_invalid_id_returns_422():
    authenticate_test_request()
    response = client.post("/api/loans/not-a-uuid/return")
    assert response.status_code == 422


def test_login_returns_supabase_session_and_profile(monkeypatch):
    user_id = uuid4()

    class FakeAuth:
        def sign_in_with_password(self, credentials):
            assert credentials == {"email": "member@toolloop.com", "password": "Secret1"}
            session = type("Session", (), {"access_token": "access-token", "refresh_token": "refresh-token", "expires_at": 1790000000})()
            user = type("User", (), {"id": user_id})()
            return type("AuthResponse", (), {"session": session, "user": user})()

    class ProfileQuery:
        def select(self, *_args): return self
        def eq(self, *_args): return self
        def execute(self):
            return type("Response", (), {"data": [{"id": str(user_id), "email": "member@toolloop.com", "full_name": "Member", "display_name": "Member", "created_at": "2026-09-30T00:00:00+00:00", "updated_at": "2026-09-30T00:00:00+00:00"}]})()

    class FakeSupabase:
        auth = FakeAuth()
        def table(self, table_name):
            assert table_name == "profiles"
            return ProfileQuery()

    monkeypatch.setattr(auth, "get_supabase_client", lambda: FakeSupabase())
    response = client.post("/api/auth/login", json={"email": "member@toolloop.com", "password": "Secret1"})

    assert response.status_code == 200
    assert response.json()["access_token"] == "access-token"
    assert response.json()["user"]["id"] == str(user_id)


def test_invalid_login_returns_401(monkeypatch):
    class FakeAuth:
        def sign_in_with_password(self, _credentials):
            raise RuntimeError("Invalid login credentials")

    class FakeSupabase:
        auth = FakeAuth()

    monkeypatch.setattr(auth, "get_supabase_client", lambda: FakeSupabase())
    response = client.post("/api/auth/login", json={"email": "member@toolloop.com", "password": "wrong-password"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid username or password."


def test_signup_creates_supabase_auth_account_and_linked_profile(monkeypatch):
    user_id = uuid4()
    captured = {"signup": None, "profile": None}

    class AuthResponse:
        user = type("User", (), {"id": user_id, "identities": [object()]})()
        session = type("Session", (), {"access_token": "new-access", "refresh_token": "new-refresh", "expires_at": 1790000000})()

    class FakeAuth:
        def sign_up(self, credentials):
            captured["signup"] = credentials
            return AuthResponse()

    class ProfileQuery:
        def __init__(self, mode): self.mode = mode
        def select(self, *_args): return self
        def eq(self, *_args): return self
        def upsert(self, data):
            captured["profile"] = data
            return self
        def execute(self):
            if self.mode == "existing": return type("Response", (), {"data": []})()
            return type("Response", (), {"data": [{"id": str(user_id), "email": "new@toolloop.com", "full_name": "New User", "display_name": "New User", "created_at": "2026-09-30T00:00:00+00:00", "updated_at": "2026-09-30T00:00:00+00:00"}]})()

    class FakeSupabase:
        auth = FakeAuth()
        def table(self, table_name):
            # The signup endpoint first checks for an existing profile, then
            # upserts the profile and finally reads it back.
            return ProfileQuery("existing") if table_name == "profiles" and captured["profile"] is None else ProfileQuery("profile")

    monkeypatch.setattr(auth, "get_supabase_client", lambda: FakeSupabase())
    monkeypatch.setattr(auth, "require_write_key", lambda: None)
    response = client.post("/api/auth/signup", json={"full_name": "New User", "email": "new@toolloop.com", "password": "Secret1"})

    assert response.status_code == 201
    assert captured["signup"]["email"] == "new@toolloop.com"
    assert captured["profile"]["id"] == str(user_id)
    assert "role" not in captured["profile"]
    assert response.json()["access_token"] == "new-access"


def test_signup_uses_fresh_service_client_for_profile_write(monkeypatch):
    user_id = uuid4()
    captured = {"profile": None}

    class AuthResponse:
        user = type("User", (), {"id": user_id, "identities": [object()]})()
        session = type("Session", (), {"access_token": "new-access", "refresh_token": "new-refresh", "expires_at": 1790000000})()

    class AuthClient:
        def __init__(self):
            self.auth = self
            self.signed_up = False

        def table(self, _table_name):
            if self.signed_up:
                raise AssertionError("Profile writes must use a fresh service-role client after sign_up.")
            return type("ExistingProfileQuery", (), {
                "select": lambda self, *_args: self,
                "eq": lambda self, *_args: self,
                "execute": lambda self: type("Response", (), {"data": []})(),
            })()

        def sign_up(self, _credentials):
            self.signed_up = True
            return AuthResponse()

    class ProfileQuery:
        def __init__(self):
            self.upserted = False

        def upsert(self, data):
            captured["profile"] = data
            self.upserted = True
            return self

        def select(self, *_args): return self
        def eq(self, *_args): return self
        def execute(self):
            if self.upserted:
                return type("Response", (), {"data": []})()
            return type("Response", (), {"data": [{
                "id": str(user_id), "email": "fresh@toolloop.com", "full_name": "Fresh User", "display_name": "Fresh User",
                "created_at": "2026-10-04T00:00:00+00:00", "updated_at": "2026-10-04T00:00:00+00:00",
            }]})()

    class ProfileClient:
        def table(self, table_name):
            assert table_name == "profiles"
            return ProfileQuery()

    clients = iter([AuthClient(), ProfileClient()])
    monkeypatch.setattr(auth, "get_supabase_client", lambda: next(clients))
    monkeypatch.setattr(auth, "require_write_key", lambda: None)

    response = client.post("/api/auth/signup", json={"full_name": "Fresh User", "email": "fresh@toolloop.com", "password": "Secret1"})

    assert response.status_code == 201
    assert captured["profile"]["id"] == str(user_id)


def test_signup_rejects_existing_email(monkeypatch):
    class ExistingProfileQuery:
        def select(self, *_args): return self
        def eq(self, *_args): return self
        def execute(self): return type("Response", (), {"data": [{"id": str(uuid4())}]})()

    class FakeSupabase:
        def table(self, table_name):
            assert table_name == "profiles"
            return ExistingProfileQuery()

    monkeypatch.setattr(auth, "get_supabase_client", lambda: FakeSupabase())
    monkeypatch.setattr(auth, "require_write_key", lambda: None)
    response = client.post("/api/auth/signup", json={"full_name": "Existing User", "email": "member@toolloop.com", "password": "Secret1"})

    assert response.status_code == 409
    assert response.json()["detail"] == "An account with this email already exists. Please log in."


def test_request_insert_uses_authenticated_user_id_not_client_user_id(monkeypatch):
    authenticate_test_request()
    captured_insert = {}
    equipment_id = uuid4()
    owner_id = uuid4()
    created_request_id = uuid4()

    class EquipmentQuery:
        def select(self, *_args): return self
        def eq(self, *_args): return self
        def execute(self):
            return type("Response", (), {"data": [{"id": str(equipment_id), "owner_id": str(owner_id), "price_per_day": "2.00", "borrowing_limit_days": 3, "available_units": 5}]})()

    class RequestInsertQuery:
        def insert(self, data):
            captured_insert.update(data)
            return self
        def execute(self):
            return type("Response", (), {"data": [{
                "id": str(created_request_id), "request_number": 1, "requester_id": str(TEST_USER_ID), "owner_id": str(owner_id), "equipment_id": str(equipment_id),
                "start_date": "2026-10-10", "return_date": "2026-10-11", "quantity": 2, "purpose": "University project work",
                "rental_days": 1, "price_per_day": "2.00", "total_cost": "4.00", "status": "pending",
                "created_at": "2026-09-30T00:00:00+00:00", "updated_at": "2026-09-30T00:00:00+00:00",
            }]})()

    class JoinedRequestQuery:
        def select(self, *_args): return self
        def eq(self, *_args): return self
        def execute(self):
            return type("Response", (), {"data": [{
                "id": str(created_request_id), "request_number": 1, "requester_id": str(TEST_USER_ID), "owner_id": str(owner_id), "equipment_id": str(equipment_id),
                "start_date": "2026-10-10", "return_date": "2026-10-11", "quantity": 2, "purpose": "University project work",
                "rental_days": 1, "price_per_day": "2.00", "total_cost": "4.00", "status": "pending",
                "created_at": "2026-09-30T00:00:00+00:00", "updated_at": "2026-09-30T00:00:00+00:00",
                "equipment": {"name": "Test equipment", "icon_key": "wrench", "card_color": "#F2F2F2"}, "owner": {"full_name": "Equipment Owner"}, "renter": {"full_name": "Test User", "email": "test@example.com"},
            }]})()

    class FakeSupabase:
        request_calls = 0
        def table(self, table_name):
            if table_name == "equipment": return EquipmentQuery()
            self.request_calls += 1
            return RequestInsertQuery() if self.request_calls == 1 else JoinedRequestQuery()

    monkeypatch.setattr(requests, "get_supabase_client", lambda: FakeSupabase())
    monkeypatch.setattr(requests, "require_write_key", lambda: None)
    response = client.post("/api/requests", json={
        "equipment_id": str(equipment_id), "start_date": "2026-10-10", "return_date": "2026-10-11",
        "quantity": 2, "purpose": "University project work", "user_id": str(uuid4()),
    })

    assert response.status_code == 201
    assert captured_insert["requester_id"] == str(TEST_USER_ID)
    assert captured_insert["owner_id"] == str(owner_id)
    assert "user_id" not in captured_insert