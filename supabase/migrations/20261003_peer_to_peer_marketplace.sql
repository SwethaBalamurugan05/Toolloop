-- ToolLoop peer-to-peer marketplace migration.
-- Run once in Supabase SQL Editor after the existing ToolLoop migrations.
-- Existing catalogue rows are assigned to the real profile swetha@gmail.com.

do $$
declare
  v_legacy_owner uuid;
begin
  select id into v_legacy_owner from public.profiles where lower(email) = 'swetha@gmail.com';
  if v_legacy_owner is null then
    raise exception 'Cannot migrate legacy equipment: profile swetha@gmail.com does not exist.';
  end if;

  alter table public.equipment add column if not exists owner_id uuid references public.profiles(id) on delete restrict;
  update public.equipment set owner_id = v_legacy_owner where owner_id is null;
  alter table public.equipment alter column owner_id set not null;

  alter table public.rental_requests add column if not exists owner_id uuid references public.profiles(id) on delete restrict;
  update public.rental_requests r set owner_id = e.owner_id from public.equipment e
    where r.equipment_id = e.id and r.owner_id is null;
  alter table public.rental_requests alter column owner_id set not null;
end;
$$;

alter table public.equipment add column if not exists image_url text;
alter table public.equipment drop constraint if exists equipment_name_key;
create unique index if not exists equipment_owner_name_key on public.equipment(owner_id, lower(name));
create index if not exists equipment_owner_id_idx on public.equipment(owner_id);
create index if not exists rental_requests_owner_created_idx on public.rental_requests(owner_id, created_at desc);

-- All accounts are ordinary peer-to-peer users. Replace the legacy Auth trigger
-- before removing the obsolete role field retained by older migrations.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))
  ) on conflict (id) do update set email = excluded.email, full_name = excluded.full_name, display_name = excluded.display_name;
  return new;
end;
$$;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop function if exists public.approve_rental_request(uuid, uuid);
drop function if exists public.reject_rental_request(uuid, uuid, text);
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles drop column if exists role;

create or replace function public.enforce_rental_request_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner_id uuid;
begin
  select owner_id into v_owner_id from public.equipment where id = new.equipment_id;
  if v_owner_id is null then raise exception 'Equipment owner is required.' using errcode = '23514'; end if;
  if new.owner_id <> v_owner_id then raise exception 'Request owner must match equipment owner.' using errcode = '23514'; end if;
  if new.requester_id = v_owner_id then raise exception 'You cannot request your own equipment.' using errcode = '23514'; end if;
  return new;
end;
$$;

drop trigger if exists rental_requests_enforce_owner on public.rental_requests;
create trigger rental_requests_enforce_owner before insert or update of equipment_id, requester_id, owner_id
  on public.rental_requests for each row execute procedure public.enforce_rental_request_owner();

-- Ownership-aware request decisions with row locks to prevent double approval
-- and inventory overbooking.
create or replace function public.approve_owner_rental_request(p_request_id uuid, p_owner_id uuid)
returns public.rental_requests language plpgsql security definer set search_path = public as $$
declare v_request public.rental_requests%rowtype; v_equipment public.equipment%rowtype;
begin
  select * into v_request from public.rental_requests where id = p_request_id for update;
  if not found then raise exception 'Rental request not found.' using errcode = 'P0002'; end if;
  if v_request.owner_id <> p_owner_id then raise exception 'Equipment owner authorization is required.' using errcode = '42501'; end if;
  if v_request.status <> 'pending' then raise exception 'This request has already been processed.' using errcode = 'P0001'; end if;
  select * into v_equipment from public.equipment where id = v_request.equipment_id for update;
  if not found or not v_equipment.is_active or v_equipment.owner_id <> p_owner_id then raise exception 'Equipment ownership could not be verified.' using errcode = '42501'; end if;
  if v_equipment.available_units < v_request.quantity then raise exception 'Insufficient equipment is available for this request.' using errcode = 'P0001'; end if;
  update public.equipment set available_units = available_units - v_request.quantity where id = v_equipment.id;
  update public.rental_requests set status = 'approved', reviewed_by = p_owner_id, reviewed_at = timezone('utc', now()), rejection_reason = null
    where id = p_request_id returning * into v_request;
  insert into public.loans (request_id, borrower_id, equipment_id, quantity, due_date, status)
    values (v_request.id, v_request.requester_id, v_request.equipment_id, v_request.quantity, v_request.return_date, 'borrowed');
  return v_request;
end;
$$;

create or replace function public.reject_owner_rental_request(p_request_id uuid, p_owner_id uuid, p_rejection_reason text default null)
returns public.rental_requests language plpgsql security definer set search_path = public as $$
declare v_request public.rental_requests%rowtype; v_equipment public.equipment%rowtype;
begin
  select * into v_request from public.rental_requests where id = p_request_id for update;
  if not found then raise exception 'Rental request not found.' using errcode = 'P0002'; end if;
  if v_request.owner_id <> p_owner_id then raise exception 'Equipment owner authorization is required.' using errcode = '42501'; end if;
  if v_request.status <> 'pending' then raise exception 'This request has already been processed.' using errcode = 'P0001'; end if;
  select * into v_equipment from public.equipment where id = v_request.equipment_id;
  if not found or v_equipment.owner_id <> p_owner_id then raise exception 'Equipment ownership could not be verified.' using errcode = '42501'; end if;
  update public.rental_requests set status = 'rejected', reviewed_by = p_owner_id, reviewed_at = timezone('utc', now()),
    rejection_reason = nullif(trim(coalesce(p_rejection_reason, '')), '')
    where id = p_request_id returning * into v_request;
  return v_request;
end;
$$;

revoke all on function public.approve_owner_rental_request(uuid, uuid) from public, anon, authenticated;
revoke all on function public.reject_owner_rental_request(uuid, uuid, text) from public, anon, authenticated;

-- Direct Supabase access remains constrained; FastAPI performs validated writes
-- with its server-only key and the RPCs above enforce transactional ownership.
drop policy if exists "equipment_read_active_authenticated" on public.equipment;
create policy "equipment_read_active_authenticated" on public.equipment for select to authenticated using (is_active = true or owner_id = auth.uid());
drop policy if exists "equipment_manage_own" on public.equipment;
create policy "equipment_manage_own" on public.equipment for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "requests_select_related" on public.rental_requests;
create policy "requests_select_related" on public.rental_requests for select to authenticated using (requester_id = auth.uid() or owner_id = auth.uid());
drop policy if exists "requests_select_own" on public.rental_requests;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());