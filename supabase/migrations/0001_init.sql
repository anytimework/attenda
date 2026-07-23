-- ============================================================
-- Direct Hire — standalone schema
-- Independent product. No dependency on ShiftOps.
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------- enums ----------
create type dh_role         as enum ('owner','admin','manager','member');
create type dh_employment    as enum ('full_time','part_time','casual','contract');
create type dh_pay_basis     as enum ('hourly','monthly','annual');
create type dh_member_status as enum ('invited','active','suspended','offboarded');
create type dh_shift_status  as enum ('scheduled','in_progress','completed','missed','cancelled');
create type dh_leave_status  as enum ('pending','approved','declined','cancelled');
create type dh_contrib_basis as enum ('percent','fixed');
create type dh_contrib_payer as enum ('employer','employee','both');

-- ---------- tenancy ----------
-- An organisation is the top-level tenant. Everything is scoped to it.
create table dh_orgs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  country_code  char(2) not null default 'US',   -- ISO 3166-1 alpha-2
  currency_code char(3) not null default 'USD',  -- ISO 4217
  timezone      text    not null default 'UTC',  -- IANA tz
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  hours_per_week numeric(5,2) not null default 38 check (hours_per_week > 0),
  created_at    timestamptz not null default now()
);

-- Links a Supabase auth user to an org with a role.
-- This is the ONLY bridge between auth.users and the app.
create table dh_org_users (
  org_id     uuid not null references dh_orgs(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       dh_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on dh_org_users (user_id);

-- ---------- locations ----------
create table dh_locations (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references dh_orgs(id) on delete cascade,
  name          text not null,
  address       text,
  latitude      numeric(9,6),
  longitude     numeric(9,6),
  radius_metres integer not null default 50 check (radius_metres between 10 and 5000),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
create index on dh_locations (org_id);

-- ---------- members (the direct hires) ----------
create table dh_members (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references dh_orgs(id) on delete cascade,
  -- null until the person accepts their invite and gets an auth account
  user_id         uuid references auth.users(id) on delete set null,
  full_name       text not null,
  email           citext,
  job_title       text,
  employment_type dh_employment    not null default 'full_time',
  pay_basis       dh_pay_basis     not null default 'monthly',
  pay_rate        numeric(14,2)    not null default 0 check (pay_rate >= 0),
  primary_location_id uuid references dh_locations(id) on delete set null,
  status          dh_member_status not null default 'invited',
  started_on      date,
  ended_on        date,
  created_at      timestamptz not null default now(),
  unique (org_id, email),
  check (ended_on is null or started_on is null or ended_on >= started_on)
);
create index on dh_members (org_id, status);
create index on dh_members (user_id);

-- ---------- shifts ----------
create table dh_shifts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references dh_orgs(id) on delete cascade,
  member_id     uuid not null references dh_members(id) on delete cascade,
  location_id   uuid references dh_locations(id) on delete set null,
  shift_date    date not null,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  status        dh_shift_status not null default 'scheduled',
  break_minutes integer not null default 0 check (break_minutes >= 0),
  notes         text,
  created_at    timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on dh_shifts (org_id, shift_date);
create index on dh_shifts (member_id, shift_date);

-- ---------- time entries (clock in / out) ----------
create table dh_time_entries (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references dh_orgs(id) on delete cascade,
  shift_id       uuid references dh_shifts(id) on delete set null,
  member_id      uuid not null references dh_members(id) on delete cascade,
  clock_in_at    timestamptz not null,
  clock_out_at   timestamptz,
  clock_in_lat   numeric(9,6),
  clock_in_lng   numeric(9,6),
  clock_out_lat  numeric(9,6),
  clock_out_lng  numeric(9,6),
  within_geofence boolean,
  -- generated so payroll never recomputes duration inconsistently
  worked_minutes integer generated always as (
    case when clock_out_at is null then null
         else greatest(0, (extract(epoch from (clock_out_at - clock_in_at)) / 60)::int)
    end
  ) stored,
  created_at     timestamptz not null default now(),
  check (clock_out_at is null or clock_out_at > clock_in_at)
);
create index on dh_time_entries (org_id, member_id, clock_in_at desc);
-- a member can only have one entry open at a time
create unique index dh_one_open_entry
  on dh_time_entries (member_id) where clock_out_at is null;

-- ---------- leave ----------
create table dh_leave_types (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references dh_orgs(id) on delete cascade,
  name            text not null,
  days_per_year   numeric(5,1) not null default 0 check (days_per_year >= 0),
  is_paid         boolean not null default true,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (org_id, name)
);

-- per-member override of the org default allowance
create table dh_leave_entitlements (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references dh_orgs(id) on delete cascade,
  member_id     uuid not null references dh_members(id) on delete cascade,
  leave_type_id uuid not null references dh_leave_types(id) on delete cascade,
  year          smallint not null,
  days_allowed  numeric(5,1) not null check (days_allowed >= 0),
  unique (member_id, leave_type_id, year)
);

create table dh_leave_requests (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references dh_orgs(id) on delete cascade,
  member_id     uuid not null references dh_members(id) on delete cascade,
  leave_type_id uuid not null references dh_leave_types(id) on delete restrict,
  starts_on     date not null,
  ends_on       date not null,
  days_count    numeric(5,1) not null check (days_count > 0),
  reason        text,
  status        dh_leave_status not null default 'pending',
  decided_by    uuid references auth.users(id) on delete set null,
  decided_at    timestamptz,
  created_at    timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index on dh_leave_requests (org_id, status);
create index on dh_leave_requests (member_id, starts_on);

-- ---------- contributions ----------
-- Deliberately generic: no statutory scheme names in the schema.
-- Each org defines its own rows, seeded from a regional template.
create table dh_contributions (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references dh_orgs(id) on delete cascade,
  name           text not null,
  basis          dh_contrib_basis not null default 'percent',
  employer_value numeric(10,4) not null default 0 check (employer_value >= 0),
  employee_value numeric(10,4) not null default 0 check (employee_value >= 0),
  -- optional salary band the contribution applies within
  min_base       numeric(14,2),
  max_base       numeric(14,2),
  sort_order     smallint not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  check (max_base is null or min_base is null or max_base >= min_base)
);
create index on dh_contributions (org_id, sort_order);

-- ---------- audit ----------
create table dh_audit_log (
  id         bigserial primary key,
  org_id     uuid not null references dh_orgs(id) on delete cascade,
  actor_id   uuid references auth.users(id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  detail     jsonb,
  created_at timestamptz not null default now()
);
create index on dh_audit_log (org_id, created_at desc);
