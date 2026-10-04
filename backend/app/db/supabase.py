from supabase import Client, create_client

from app.core.config import get_settings


def get_supabase_client() -> Client:
    """Create an isolated backend-only client using the service-role key.

    Supabase auth operations can update a client's in-memory authorization
    state. Do not share one client between browser-token verification/login and
    server-side database writes, otherwise a write may accidentally run under
    the user's RLS role rather than the service role.
    """
    settings = get_settings()
    settings.validate_supabase()
    return create_client(settings.supabase_url, settings.supabase_key)