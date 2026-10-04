from app.db import supabase


def test_supabase_client_is_not_shared_between_operations(monkeypatch):
    created_clients = []

    def fake_create_client(_url, _key):
        client = object()
        created_clients.append(client)
        return client

    monkeypatch.setattr(supabase, "create_client", fake_create_client)

    first_client = supabase.get_supabase_client()
    second_client = supabase.get_supabase_client()

    assert first_client is not second_client
    assert created_clients == [first_client, second_client]