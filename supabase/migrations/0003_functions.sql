-- ============================================================
-- Functions, triggers, views
-- ============================================================

-- Whoever creates an org becomes its owner, and gets a starter
-- set of leave types + contributions for their country.
create or replace function dh_after_org_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into dh_org_users (org_id, user_id, role)
  values (new.id, auth.uid(), 'owner')
  on conflict do nothing;

  insert into dh_leave_types (org_id, name, days_per_year, is_paid) values
    (new.id, 'Annual leave',   20, true),
    (new.id, 'Sick leave',     10, true),
    (new.id, 'Parental leave', 90, true),
    (new.id, 'Unpaid leave',    0, false);

  perform dh_seed_contributions(new.id, new.country_code);
  return new;
end $$;

create trigger trg_org_insert
  after insert on dh_orgs
  for each row execute function dh_after_org_insert();

-- ---------- regional contribution templates ----------
-- Starting points only. Every value is editable by the org afterwards.
-- Names use internationally recognised terms, never one country's
-- scheme names imposed on another.
create or replace function dh_seed_contributions(p_org uuid, p_country char(2))
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_country = 'US' then
    insert into dh_contributions (org_id,name,basis,employer_value,employee_value,sort_order) values
      (p_org,'Social Security',        'percent',6.2000,6.2000,1),
      (p_org,'Medicare',               'percent',1.4500,1.4500,2),
      (p_org,'Unemployment insurance', 'percent',0.6000,0.0000,3),
      (p_org,'Retirement plan match',  'percent',3.0000,3.0000,4);
  elsif p_country = 'GB' then
    insert into dh_contributions (org_id,name,basis,employer_value,employee_value,sort_order) values
      (p_org,'National Insurance', 'percent',13.8000,8.0000,1),
      (p_org,'Workplace pension',  'percent', 3.0000,5.0000,2);
  elsif p_country = 'SG' then
    insert into dh_contributions (org_id,name,basis,employer_value,employee_value,sort_order) values
      (p_org,'Provident fund','percent',17.0000,20.0000,1),
      (p_org,'Skills levy',   'percent', 0.2500, 0.0000,2);
  elsif p_country = 'AU' then
    insert into dh_contributions (org_id,name,basis,employer_value,employee_value,sort_order) values
      (p_org,'Superannuation','percent',11.5000,0.0000,1);
  elsif p_country = 'CA' then
    insert into dh_contributions (org_id,name,basis,employer_value,employee_value,sort_order) values
      (p_org,'Public pension plan',  'percent',5.9500,5.9500,1),
      (p_org,'Employment insurance', 'percent',2.2800,1.6300,2);
  elsif p_country = 'IN' then
    insert into dh_contributions (org_id,name,basis,employer_value,employee_value,sort_order) values
      (p_org,'Provident fund',  'percent',12.0000,12.0000,1),
      (p_org,'State insurance', 'percent', 3.2500, 0.7500,2);
  else
    -- generic fallback for any unlisted country
    insert into dh_contributions (org_id,name,basis,employer_value,employee_value,sort_order) values
      (p_org,'Social security',      'percent',6.0000,6.0000,1),
      (p_org,'Health insurance',     'percent',3.0000,1.5000,2),
      (p_org,'Retirement / pension', 'percent',3.0000,3.0000,3);
  end if;
end $$;

-- ---------- normalise pay to a monthly figure ----------
create or replace function dh_monthly_base(p_member uuid)
returns numeric language sql stable set search_path = public as $$
  select case m.pay_basis
    when 'monthly' then m.pay_rate
    when 'annual'  then m.pay_rate / 12
    when 'hourly'  then m.pay_rate * o.hours_per_week * 52 / 12
  end
  from dh_members m
  join dh_orgs o on o.id = m.org_id
  where m.id = p_member;
$$;

-- ---------- employer cost / employee deduction ----------
create or replace function dh_member_costs(p_member uuid)
returns table (base numeric, employer_share numeric, employee_deduction numeric)
language sql stable set search_path = public as $$
  with b as (select dh_monthly_base(p_member) as base,
                    (select org_id from dh_members where id = p_member) as org)
  select
    b.base,
    coalesce(sum(case when c.basis = 'percent'
                      then b.base * c.employer_value / 100
                      else c.employer_value end), 0),
    coalesce(sum(case when c.basis = 'percent'
                      then b.base * c.employee_value / 100
                      else c.employee_value end), 0)
  from b
  left join dh_contributions c
         on c.org_id = b.org
        and c.is_active
        and (c.min_base is null or b.base >= c.min_base)
        and (c.max_base is null or b.base <= c.max_base)
  group by b.base;
$$;

-- ---------- clock in with geofence check ----------
-- Returns the new time entry id. Raises if already clocked in or
-- outside the allowed radius.
create or replace function dh_clock_in(
  p_member uuid, p_shift uuid, p_lat numeric, p_lng numeric
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid; v_loc record; v_dist numeric; v_ok boolean := true; v_id uuid;
begin
  select org_id into v_org from dh_members where id = p_member;
  if v_org is null then raise exception 'Member not found'; end if;

  -- caller must be the member themselves or a manager
  if not (p_member = dh_my_member_id(v_org) or dh_is_manager_of(v_org)) then
    raise exception 'Not permitted';
  end if;

  if exists (select 1 from dh_time_entries
             where member_id = p_member and clock_out_at is null) then
    raise exception 'Already clocked in';
  end if;

  select l.* into v_loc
  from dh_shifts s join dh_locations l on l.id = s.location_id
  where s.id = p_shift;

  -- haversine distance in metres
  if v_loc.id is not null and v_loc.latitude is not null and p_lat is not null then
    v_dist := 6371000 * 2 * asin(sqrt(
        power(sin(radians(p_lat - v_loc.latitude) / 2), 2) +
        cos(radians(v_loc.latitude)) * cos(radians(p_lat)) *
        power(sin(radians(p_lng - v_loc.longitude) / 2), 2)
      ));
    v_ok := v_dist <= v_loc.radius_metres;
    if not v_ok then
      raise exception 'Outside the clock-in area (% m away, limit % m)',
        round(v_dist), v_loc.radius_metres;
    end if;
  end if;

  insert into dh_time_entries (org_id, shift_id, member_id, clock_in_at,
                               clock_in_lat, clock_in_lng, within_geofence)
  values (v_org, p_shift, p_member, now(), p_lat, p_lng, v_ok)
  returning id into v_id;

  update dh_shifts set status = 'in_progress' where id = p_shift;
  return v_id;
end $$;

create or replace function dh_clock_out(
  p_member uuid, p_lat numeric, p_lng numeric
) returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_entry uuid; v_shift uuid;
begin
  select org_id into v_org from dh_members where id = p_member;
  if not (p_member = dh_my_member_id(v_org) or dh_is_manager_of(v_org)) then
    raise exception 'Not permitted';
  end if;

  select id, shift_id into v_entry, v_shift
  from dh_time_entries
  where member_id = p_member and clock_out_at is null
  order by clock_in_at desc limit 1;

  if v_entry is null then raise exception 'Not clocked in'; end if;

  update dh_time_entries
     set clock_out_at = now(), clock_out_lat = p_lat, clock_out_lng = p_lng
   where id = v_entry;

  if v_shift is not null then
    update dh_shifts set status = 'completed' where id = v_shift;
  end if;
end $$;

-- ---------- leave balance ----------
-- Falls back to the org default when no per-member override exists.
create or replace view dh_leave_balances as
select
  m.org_id,
  m.id  as member_id,
  m.full_name,
  lt.id as leave_type_id,
  lt.name as leave_type,
  extract(year from current_date)::smallint as year,
  coalesce(e.days_allowed, lt.days_per_year) as days_allowed,
  coalesce((
    select sum(r.days_count) from dh_leave_requests r
    where r.member_id = m.id and r.leave_type_id = lt.id
      and r.status = 'approved'
      and extract(year from r.starts_on) = extract(year from current_date)
  ), 0) as days_taken,
  coalesce(e.days_allowed, lt.days_per_year) - coalesce((
    select sum(r.days_count) from dh_leave_requests r
    where r.member_id = m.id and r.leave_type_id = lt.id
      and r.status = 'approved'
      and extract(year from r.starts_on) = extract(year from current_date)
  ), 0) as days_remaining
from dh_members m
cross join dh_leave_types lt
left join dh_leave_entitlements e
       on e.member_id = m.id and e.leave_type_id = lt.id
      and e.year = extract(year from current_date)::smallint
where m.org_id = lt.org_id
  and lt.is_active
  and m.status = 'active';
