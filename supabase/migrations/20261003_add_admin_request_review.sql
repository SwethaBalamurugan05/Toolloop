-- ToolLoop admin request review migration.
-- Run once in Supabase SQL Editor after schema.sql and the signup-profile migration.
-- This is additive: existing profiles, equipment, and rental requests are preserved.

alter table public.rental_requests
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists rejection_reason text;

alter table public.rental_requests
  drop constraint if exists rental_requests_status_check;

alter table public.rental_requests
  add constraint rental_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'cancelled', 'issued', 'returned'));

create index if not exists rental_requests_reviewed_by_idx on public.rental_requests(reviewed_by);
create index if not exists rental_requests_created_at_idx on public.rental_requests(created_at desc);

-- Approve and reserve inventory in one database transaction. Row-level locks
-- prevent two administrators approving the same request or overbooking stock.
create or replace function public.approve_rental_request(p_request_id uuid, p_admin_id uuid)
returns public.rental_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.rental_requests%rowtype;
  v_equipment public.equipment%rowtype;
begin
  if not exists (select 1 from public.profiles where id = p_admin_id and role = 'admin') then
    raise exception 'Administrator authorization is required.' using errcode = '42501';
  end if;

  select * into v_request from public.rental_requests where id = p_request_id for update;
  if not found then
    raise exception 'Rental request not found.' using errcode = 'P0002';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This request has already been processed.' using errcode = 'P0001';
  end if;

  select * into v_equipment from public.equipment where id = v_request.equipment_id for update;
  if not found or not v_equipment.is_active then
    raise exception 'Equipment is no longer available.' using errcode = 'P0002';
  end if;
  if v_equipment.available_units < v_request.quantity then
    raise exception 'Insufficient equipment is available for this request.' using errcode = 'P0001';
  end if;

  update public.equipment
  set available_units = available_units - v_request.quantity
  where id = v_equipment.id;

  update public.rental_requests
  set status = 'approved', reviewed_by = p_admin_id, reviewed_at = timezone('utc', now()), rejection_reason = null
  where id = p_request_id
  returning * into v_request;

  insert into public.loans (request_id, borrower_id, equipment_id, quantity, due_date, status)
  values (v_request.id, v_request.requester_id, v_request.equipment_id, v_request.quantity, v_request.return_date, 'borrowed');

  return v_request;
end;
$$;

create or replace function public.reject_rental_request(p_request_id uuid, p_admin_id uuid, p_rejection_reason text default null)
returns public.rental_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.rental_requests%rowtype;
begin
  if not exists (select 1 from public.profiles where id = p_admin_id and role = 'admin') then
    raise exception 'Administrator authorization is required.' using errcode = '42501';
  end if;

  select * into v_request from public.rental_requests where id = p_request_id for update;
  if not found then
    raise exception 'Rental request not found.' using errcode = 'P0002';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This request has already been processed.' using errcode = 'P0001';
  end if;

  update public.rental_requests
  set status = 'rejected', reviewed_by = p_admin_id, reviewed_at = timezone('utc', now()),
      rejection_reason = nullif(trim(coalesce(p_rejection_reason, '')), '')
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

-- Return a loan, update its source request to returned, and release inventory
-- atomically. This keeps existing Borrowed Items/Return Item behavior consistent.
create or replace function public.return_loan_and_release_inventory(p_loan_id uuid, p_borrower_id uuid)
returns public.loans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loan public.loans%rowtype;
  v_equipment public.equipment%rowtype;
begin
  select * into v_loan from public.loans
  where id = p_loan_id and borrower_id = p_borrower_id for update;
  if not found then
    raise exception 'Loan not found.' using errcode = 'P0002';
  end if;
  if v_loan.status not in ('borrowed', 'overdue') then
    raise exception 'This item has already been returned.' using errcode = 'P0001';
  end if;

  select * into v_equipment from public.equipment where id = v_loan.equipment_id for update;
  if not found then
    raise exception 'Equipment not found.' using errcode = 'P0002';
  end if;

  update public.loans
  set status = 'returned', returned_at = timezone('utc', now())
  where id = v_loan.id
  returning * into v_loan;

  update public.equipment
  set available_units = least(total_units, available_units + v_loan.quantity)
  where id = v_equipment.id;

  if v_loan.request_id is not null then
    update public.rental_requests set status = 'returned' where id = v_loan.request_id;
  end if;

  return v_loan;
end;
$$;

revoke all on function public.approve_rental_request(uuid, uuid) from public, anon, authenticated;
revoke all on function public.reject_rental_request(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.return_loan_and_release_inventory(uuid, uuid) from public, anon, authenticated;