-- ToolLoop Assignment 3: Supabase PostgreSQL schema
-- Run this entire script in Supabase Dashboard > SQL Editor.
-- Authentication passwords are managed by Supabase Auth (auth.users), not this schema.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Shared utility: automatically maintain updated_at timestamps.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- User profile linked one-to-one to Supabase Auth.
-- A profile is automatically created whenever a user signs up through Supabase.
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  -- display_name is retained for Assignment 2 UI compatibility.
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

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
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Equipment catalogue.
-- icon_key and card_color preserve the Assignment 2 Lucide-icon UI without
-- storing React components in PostgreSQL.
-- -----------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null unique,
  description text not null,
  price_per_day numeric(10,2) not null check (price_per_day >= 0),
  condition text not null,
  location text,
  pickup_address text,
  last_inspected_on date,
  borrowing_limit_days integer not null check (borrowing_limit_days > 0),
  total_units integer not null check (total_units >= 0),
  available_units integer not null check (available_units >= 0 and available_units <= total_units),
  icon_key text not null,
  card_color text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists equipment_category_id_idx on public.equipment(category_id);
create index if not exists equipment_is_active_idx on public.equipment(is_active);

drop trigger if exists equipment_set_updated_at on public.equipment;
create trigger equipment_set_updated_at before update on public.equipment
  for each row execute procedure public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Requests and loans. FastAPI must calculate rental_days, price_per_day and
-- total_cost from trusted equipment data before writing rental_requests.
-- -----------------------------------------------------------------------------
create table if not exists public.rental_requests (
  id uuid primary key default gen_random_uuid(),
  request_number bigint generated always as identity unique,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete restrict,
  start_date date not null,
  return_date date not null,
  quantity integer not null check (quantity > 0),
  purpose text not null check (char_length(trim(purpose)) >= 10),
  rental_days integer not null check (rental_days > 0),
  price_per_day numeric(10,2) not null check (price_per_day >= 0),
  total_cost numeric(10,2) not null check (total_cost >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled', 'issued', 'returned')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (return_date > start_date),
  check (total_cost = price_per_day * rental_days * quantity)
);

create index if not exists rental_requests_requester_id_idx on public.rental_requests(requester_id);
create index if not exists rental_requests_equipment_id_idx on public.rental_requests(equipment_id);
create index if not exists rental_requests_status_idx on public.rental_requests(status);
create index if not exists rental_requests_reviewed_by_idx on public.rental_requests(reviewed_by);
create index if not exists rental_requests_created_at_idx on public.rental_requests(created_at desc);

drop trigger if exists rental_requests_set_updated_at on public.rental_requests;
create trigger rental_requests_set_updated_at before update on public.rental_requests
  for each row execute procedure public.set_updated_at();

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  request_id uuid unique references public.rental_requests(id) on delete set null,
  borrower_id uuid not null references public.profiles(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  borrowed_at timestamptz not null default timezone('utc', now()),
  due_date date not null,
  returned_at timestamptz,
  status text not null default 'borrowed' check (status in ('borrowed', 'returned', 'overdue')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((status = 'returned' and returned_at is not null) or (status <> 'returned'))
);

create index if not exists loans_borrower_id_idx on public.loans(borrower_id);
create index if not exists loans_equipment_id_idx on public.loans(equipment_id);
create index if not exists loans_status_idx on public.loans(status);

drop trigger if exists loans_set_updated_at on public.loans;
create trigger loans_set_updated_at before update on public.loans
  for each row execute procedure public.set_updated_at();

-- Administrative request decisions and returns are atomic so concurrent
-- approvals cannot overbook inventory or process a pending request twice.
create or replace function public.approve_rental_request(p_request_id uuid, p_admin_id uuid)
returns public.rental_requests
language plpgsql security definer set search_path = public
as $$
declare v_request public.rental_requests%rowtype; v_equipment public.equipment%rowtype;
begin
  if not exists (select 1 from public.profiles where id = p_admin_id and role = 'admin') then raise exception 'Administrator authorization is required.' using errcode = '42501'; end if;
  select * into v_request from public.rental_requests where id = p_request_id for update;
  if not found then raise exception 'Rental request not found.' using errcode = 'P0002'; end if;
  if v_request.status <> 'pending' then raise exception 'This request has already been processed.' using errcode = 'P0001'; end if;
  select * into v_equipment from public.equipment where id = v_request.equipment_id for update;
  if not found or not v_equipment.is_active then raise exception 'Equipment is no longer available.' using errcode = 'P0002'; end if;
  if v_equipment.available_units < v_request.quantity then raise exception 'Insufficient equipment is available for this request.' using errcode = 'P0001'; end if;
  update public.equipment set available_units = available_units - v_request.quantity where id = v_equipment.id;
  update public.rental_requests set status = 'approved', reviewed_by = p_admin_id, reviewed_at = timezone('utc', now()), rejection_reason = null where id = p_request_id returning * into v_request;
  insert into public.loans (request_id, borrower_id, equipment_id, quantity, due_date, status) values (v_request.id, v_request.requester_id, v_request.equipment_id, v_request.quantity, v_request.return_date, 'borrowed');
  return v_request;
end;
$$;

create or replace function public.reject_rental_request(p_request_id uuid, p_admin_id uuid, p_rejection_reason text default null)
returns public.rental_requests
language plpgsql security definer set search_path = public
as $$
declare v_request public.rental_requests%rowtype;
begin
  if not exists (select 1 from public.profiles where id = p_admin_id and role = 'admin') then raise exception 'Administrator authorization is required.' using errcode = '42501'; end if;
  select * into v_request from public.rental_requests where id = p_request_id for update;
  if not found then raise exception 'Rental request not found.' using errcode = 'P0002'; end if;
  if v_request.status <> 'pending' then raise exception 'This request has already been processed.' using errcode = 'P0001'; end if;
  update public.rental_requests set status = 'rejected', reviewed_by = p_admin_id, reviewed_at = timezone('utc', now()), rejection_reason = nullif(trim(coalesce(p_rejection_reason, '')), '') where id = p_request_id returning * into v_request;
  return v_request;
end;
$$;

create or replace function public.return_loan_and_release_inventory(p_loan_id uuid, p_borrower_id uuid)
returns public.loans
language plpgsql security definer set search_path = public
as $$
declare v_loan public.loans%rowtype; v_equipment public.equipment%rowtype;
begin
  select * into v_loan from public.loans where id = p_loan_id and borrower_id = p_borrower_id for update;
  if not found then raise exception 'Loan not found.' using errcode = 'P0002'; end if;
  if v_loan.status not in ('borrowed', 'overdue') then raise exception 'This item has already been returned.' using errcode = 'P0001'; end if;
  select * into v_equipment from public.equipment where id = v_loan.equipment_id for update;
  if not found then raise exception 'Equipment not found.' using errcode = 'P0002'; end if;
  update public.loans set status = 'returned', returned_at = timezone('utc', now()) where id = v_loan.id returning * into v_loan;
  update public.equipment set available_units = least(total_units, available_units + v_loan.quantity) where id = v_equipment.id;
  if v_loan.request_id is not null then update public.rental_requests set status = 'returned' where id = v_loan.request_id; end if;
  return v_loan;
end;
$$;

revoke all on function public.approve_rental_request(uuid, uuid) from public, anon, authenticated;
revoke all on function public.reject_rental_request(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.return_loan_and_release_inventory(uuid, uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security. The FastAPI server may use a service-role key server-side
-- for validated business operations. These policies also keep direct user access
-- restricted to the signed-in user.
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.equipment enable row level security;
alter table public.rental_requests enable row level security;
alter table public.loans enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = auth.uid() and role = 'user');
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role = 'user');

drop policy if exists "categories_read_authenticated" on public.categories;
create policy "categories_read_authenticated" on public.categories for select to authenticated using (true);
drop policy if exists "equipment_read_active_authenticated" on public.equipment;
create policy "equipment_read_active_authenticated" on public.equipment for select to authenticated using (is_active = true);

drop policy if exists "requests_select_own" on public.rental_requests;
create policy "requests_select_own" on public.rental_requests for select to authenticated using (requester_id = auth.uid());
drop policy if exists "loans_select_own" on public.loans;
create policy "loans_select_own" on public.loans for select to authenticated using (borrower_id = auth.uid());

-- No direct insert/update/delete policies exist for requests, loans or equipment.
-- FastAPI service-role operations must enforce ownership, availability and limits.

-- -----------------------------------------------------------------------------
-- Seed categories and current Assignment 2 equipment catalogue.
-- Safe to re-run: each row is upserted by its unique slug/name.
-- -----------------------------------------------------------------------------
insert into public.categories (name, slug) values
  ('Tools', 'tools'),
  ('Electronics', 'electronics'),
  ('Sports', 'sports'),
  ('Travel', 'travel')
on conflict (slug) do update set name = excluded.name;

insert into public.equipment (
  category_id, name, description, price_per_day, condition, location,
  pickup_address, last_inspected_on, borrowing_limit_days, total_units,
  available_units, icon_key, card_color, is_active
) values
  ((select id from public.categories where slug = 'tools'), 'Cordless Drill', 'High performance cordless drill suitable for home and professional work.', 2.00, 'Good', 'Community Store Room', '14 Maple Street, Clayton VIC 3168', '2026-08-12', 3, 10, 10, 'drill', '#FFE16A', true),
  ((select id from public.categories where slug = 'electronics'), 'Projector', 'Portable HD projector with HDMI connection for classes and presentations.', 5.00, 'Excellent', 'Library Equipment Desk', '8 College Road, Clayton VIC 3168', '2026-08-09', 4, 6, 6, 'projector', '#D6ECFF', true),
  ((select id from public.categories where slug = 'electronics'), 'Camera', 'Digital camera ideal for student events, photography and short films.', 8.00, 'Good', 'Media Lab', '21 Campus Way, Clayton VIC 3168', '2026-08-11', 2, 4, 4, 'camera', '#E5E5E5', true),
  ((select id from public.categories where slug = 'travel'), 'Trekking Bag', 'Comfortable 55 litre hiking pack with adjustable straps and rain cover.', 3.00, 'Good', 'Outdoor Club Store', '2 Sports Lane, Clayton VIC 3168', '2026-08-05', 5, 8, 8, 'backpack', '#D7E8C5', true),
  ((select id from public.categories where slug = 'tools'), 'Tool Kit', 'A complete basic hand-tool set for simple repairs and DIY projects.', 3.00, 'Good', 'Community Store Room', '14 Maple Street, Clayton VIC 3168', '2026-08-10', 3, 5, 5, 'wrench', '#F9D7C4', true),
  ((select id from public.categories where slug = 'travel'), 'Camping Tent', 'Four-person waterproof tent for weekend camping adventures.', 6.00, 'Excellent', 'Outdoor Club Store', '2 Sports Lane, Clayton VIC 3168', '2026-08-08', 4, 3, 3, 'tent-tree', '#D8F0DC', true)
on conflict (name) do update set
  category_id = excluded.category_id,
  description = excluded.description,
  price_per_day = excluded.price_per_day,
  condition = excluded.condition,
  location = excluded.location,
  pickup_address = excluded.pickup_address,
  last_inspected_on = excluded.last_inspected_on,
  borrowing_limit_days = excluded.borrowing_limit_days,
  total_units = excluded.total_units,
  available_units = excluded.available_units,
  icon_key = excluded.icon_key,
  card_color = excluded.card_color,
  is_active = excluded.is_active;

-- Optional verification queries after running the script:
-- select * from public.categories order by name;
-- select e.name, c.name as category, e.price_per_day, e.available_units from public.equipment e join public.categories c on c.id = e.category_id order by e.name;