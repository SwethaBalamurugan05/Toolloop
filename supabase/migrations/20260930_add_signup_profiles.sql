-- ToolLoop signup/profile migration.
-- Run once in Supabase SQL Editor after the original schema.sql.
-- Passwords remain exclusively in Supabase Auth (auth.users).

alter table public.profiles
  add column if not exists full_name text;

update public.profiles
set full_name = coalesce(nullif(full_name, ''), nullif(display_name, ''), split_part(email, '@', 1))
where full_name is null or full_name = '';

alter table public.profiles
  alter column full_name set not null;

alter table public.profiles
  drop constraint if exists profiles_role_check;

update public.profiles set role = 'user' where role = 'member';

alter table public.profiles
  alter column role set default 'user',
  add constraint profiles_role_check check (role in ('user', 'admin'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, display_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    'user'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    display_name = excluded.display_name;
  return new;
end;
$$;

-- Keep RLS enabled. The trigger and FastAPI service role create profiles;
-- these policies permit users to read/update only their own profile.
alter table public.profiles enable row level security;
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated
  with check (id = auth.uid() and role = 'user');
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated
  using (id = auth.uid());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = 'user');