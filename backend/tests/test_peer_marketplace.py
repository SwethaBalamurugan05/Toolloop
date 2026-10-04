from uuid import uuid4

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.dependencies import get_current_user_id
from app.main import app
from app.routers import requests

client = TestClient(app)
RENTER_ID = uuid4()
OWNER_ID = uuid4()


def setup_function():
    app.dependency_overrides.clear()


def teardown_function():
    app.dependency_overrides.clear()


def authenticated_as(user_id):
    app.dependency_overrides[get_current_user_id] = lambda: user_id


def test_owner_request_list_uses_authenticated_owner_id(monkeypatch):
    authenticated_as(OWNER_ID)
    captured = {}

    class Query:
        def select(self, *_args): return self
        def eq(self, field, value): captured[field] = value; return self
        def order(self, *_args, **_kwargs): return self
        def execute(self): return type('Response', (), {'data': []})()

    monkeypatch.setattr(requests, 'get_supabase_client', lambda: type('Db', (), {'table': lambda _self, _name: Query()})())
    response = client.get('/api/requests/for-my-equipment')
    assert response.status_code == 200
    assert captured['owner_id'] == str(OWNER_ID)


def test_owner_approval_uses_authenticated_user_not_client_owner(monkeypatch):
    authenticated_as(OWNER_ID)
    request_id = uuid4()
    captured = {}
    monkeypatch.setattr(requests, 'require_write_key', lambda: None)
    monkeypatch.setattr(requests, 'get_supabase_client', lambda: object())
    monkeypatch.setattr(requests, 'approve_request', lambda _db, rid, oid: captured.update({'request_id': rid, 'owner_id': oid}) or {
        'id': str(request_id), 'request_number': 1, 'requester_id': str(RENTER_ID), 'owner_id': str(OWNER_ID), 'equipment_id': str(uuid4()),
        'start_date': '2026-10-10', 'return_date': '2026-10-11', 'quantity': 1, 'purpose': 'Peer marketplace testing',
        'rental_days': 1, 'price_per_day': '2.00', 'total_cost': '2.00', 'status': 'approved', 'created_at': '2026-10-03T00:00:00+00:00', 'updated_at': '2026-10-03T00:00:00+00:00',
    })
    response = client.patch(f'/api/requests/{request_id}/approve', json={'owner_id': str(uuid4())})
    assert response.status_code == 200
    assert captured == {'request_id': request_id, 'owner_id': OWNER_ID}


def test_self_rental_is_rejected(monkeypatch):
    authenticated_as(OWNER_ID)
    equipment_id = uuid4()

    class EquipmentQuery:
        def select(self, *_args): return self
        def eq(self, *_args): return self
        def execute(self): return type('Response', (), {'data': [{'id': str(equipment_id), 'owner_id': str(OWNER_ID), 'price_per_day': '2.00', 'borrowing_limit_days': 3, 'available_units': 5}]})()

    monkeypatch.setattr(requests, 'get_supabase_client', lambda: type('Db', (), {'table': lambda _self, _name: EquipmentQuery()})())
    monkeypatch.setattr(requests, 'require_write_key', lambda: None)
    response = client.post('/api/requests', json={'equipment_id': str(equipment_id), 'start_date': '2026-10-10', 'return_date': '2026-10-11', 'quantity': 1, 'purpose': 'Peer marketplace testing'})
    assert response.status_code == 403
    assert response.json()['detail'] == 'You cannot request your own equipment.'