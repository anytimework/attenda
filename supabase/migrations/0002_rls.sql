-- ============================================================
-- Row Level Security
-- Rules: a user sees only orgs they belong to. Members see only
-- their own rows. Managers+ see everything in their org.
-- ============================================================

-- Helper functions are SECURITY DEFINER so that reading dh_org_users
-- from inside a policy does NOT re-trigger that table's own policy
-- (which would recurse infinitely). set search_path guards against
-- search_path hijacking in a definer context.

create or replace function dh_is_member_of(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from dh_org_users
    where org_id = p_org and user_id = auth.uid()
  );
$$;

create or replace function dh_is_manager_of(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from dh_org_users
    where org_id = p_org and user_id = auth.uid()
      and role in ('owner','admin','manager')
  );
$$;

create or replace function dh_is_admin_of(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from dh_org_users
    where org_id = p_org and user_id = auth.uid()
      and role in ('owner','admin')
  );
$$;

-- the dh_members row belonging to the current auth user
create or replace function dh_my_member_id(p_org uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select id from dh_members
  where org_id = p_org and user_id = auth.uid()
  limit 1;
$$;

-- ---------- enable RLS everywhere ----------
alter table dh_orgs               enable row level security;
alter table dh_org_users          enable row level security;
alter table dh_locations          enable row level security;
alter table dh_members            enable row level security;
alter table dh_shifts             enable row level security;
alter table dh_time_entries       enable row level security;
alter table dh_leave_types        enable row level security;
alter table dh_leave_entitlements enable row level security;
alter table dh_leave_requests     enable row level security;
alter table dh_contributions      enable row level security;
alter table dh_audit_log          enable row level security;

-- ---------- orgs ----------
create policy org_read on dh_orgs
  for select using (dh_is_member_of(id));
create policy org_update on dh_orgs
  for update using (dh_is_admin_of(id)) with check (dh_is_admin_of(id));
-- any authenticated user may create an org (they become owner via trigger)
create policy org_insert on dh_orgs
  for insert to authenticated with check (true);

-- ---------- org_users ----------
create policy orgusers_read on dh_org_users
  for select using (dh_is_member_of(org_id));
create policy orgusers_write on dh_org_users
  for all using (dh_is_admin_of(org_id)) with check (dh_is_admin_of(org_id));

-- ---------- locations ----------
create policy loc_read on dh_locations
  for select using (dh_is_member_of(org_id));
create policy loc_write on dh_locations
  for all using (dh_is_manager_of(org_id)) with check (dh_is_manager_of(org_id));

-- ---------- members ----------
-- managers see the whole team; a member sees only their own record
create policy mem_read on dh_members
  for select using (
    dh_is_manager_of(org_id) or user_id = auth.uid()
  );
create policy mem_write on dh_members
  for all using (dh_is_manager_of(org_id)) with check (dh_is_manager_of(org_id));

-- ---------- shifts ----------
create policy shift_read on dh_shifts
  for select using (
    dh_is_manager_of(org_id) or member_id = dh_my_member_id(org_id)
  );
create policy shift_write on dh_shifts
  for all using (dh_is_manager_of(org_id)) with check (dh_is_manager_of(org_id));

-- ---------- time entries ----------
create policy time_read on dh_time_entries
  for select using (
    dh_is_manager_of(org_id) or member_id = dh_my_member_id(org_id)
  );
-- a member may clock themselves in
create policy time_insert_self on dh_time_entries
  for insert with check (
    member_id = dh_my_member_id(org_id) or dh_is_manager_of(org_id)
  );
-- and close their own open entry
create policy time_update_self on dh_time_entries
  for update using (
    member_id = dh_my_member_id(org_id) or dh_is_manager_of(org_id)
  ) with check (
    member_id = dh_my_member_id(org_id) or dh_is_manager_of(org_id)
  );
create policy time_delete_mgr on dh_time_entries
  for delete using (dh_is_manager_of(org_id));

-- ---------- leave types & entitlements ----------
create policy ltype_read on dh_leave_types
  for select using (dh_is_member_of(org_id));
create policy ltype_write on dh_leave_types
  for all using (dh_is_manager_of(org_id)) with check (dh_is_manager_of(org_id));

create policy lent_read on dh_leave_entitlements
  for select using (
    dh_is_manager_of(org_id) or member_id = dh_my_member_id(org_id)
  );
create policy lent_write on dh_leave_entitlements
  for all using (dh_is_manager_of(org_id)) with check (dh_is_manager_of(org_id));

-- ---------- leave requests ----------
create policy leave_read on dh_leave_requests
  for select using (
    dh_is_manager_of(org_id) or member_id = dh_my_member_id(org_id)
  );
-- members raise their own requests
create policy leave_insert on dh_leave_requests
  for insert with check (
    member_id = dh_my_member_id(org_id) or dh_is_manager_of(org_id)
  );
-- members may edit/cancel while still pending; managers may always decide
create policy leave_update on dh_leave_requests
  for update using (
    dh_is_manager_of(org_id)
    or (member_id = dh_my_member_id(org_id) and status = 'pending')
  ) with check (
    dh_is_manager_of(org_id)
    or (member_id = dh_my_member_id(org_id) and status in ('pending','cancelled'))
  );
create policy leave_delete on dh_leave_requests
  for delete using (dh_is_manager_of(org_id));

-- ---------- contributions ----------
-- payroll cost config: admins only, since it exposes org financials
create policy contrib_read on dh_contributions
  for select using (dh_is_manager_of(org_id));
create policy contrib_write on dh_contributions
  for all using (dh_is_admin_of(org_id)) with check (dh_is_admin_of(org_id));

-- ---------- audit ----------
create policy audit_read on dh_audit_log
  for select using (dh_is_admin_of(org_id));
create policy audit_insert on dh_audit_log
  for insert with check (dh_is_member_of(org_id));
