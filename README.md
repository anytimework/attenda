# Direct Hire — standalone backend

A separate product from ShiftOps. **Its own Supabase project, its own auth,
its own database.** Nothing is shared: no cross-project foreign keys, no
shared tables, no shared API keys.

## Why a separate project

ShiftOps stores most state as JSON blobs in a single `app_settings` key/value
table. That is workable for a bundled tool but wrong for a product that needs
per-user logins, tenant isolation and payroll figures that must reconcile.
Direct Hire therefore uses a normal relational schema with row-level security.

The `dh_` table prefix means that even if the two ever share a database by
accident, nothing collides.

## Setup

1. Create a **new** project at supabase.com — do not reuse the ShiftOps one.
2. Run the migrations in order:

```bash
supabase link --project-ref <your-new-ref>
supabase db push
```

Or paste `supabase/migrations/*.sql` into the SQL editor in filename order.

3. Set environment variables (note the `DH_` prefix — keeping these distinct
   from ShiftOps keys is what stops a future copy-paste from crossing the
   products over):

```
VITE_DH_SUPABASE_URL=https://<ref>.supabase.co
VITE_DH_SUPABASE_ANON_KEY=<anon key>
```

4. `npm i @supabase/supabase-js` and import from `src/dhClient.js`.

## Schema

| Table | Purpose |
|---|---|
| `dh_orgs` | Tenant. Holds country, currency, timezone, standard week hours. |
| `dh_org_users` | Bridges `auth.users` → org with a role. The only auth coupling. |
| `dh_locations` | Sites, with lat/lng and clock-in radius. |
| `dh_members` | The direct hires. `user_id` is null until they accept an invite. |
| `dh_shifts` | Scheduled shifts. |
| `dh_time_entries` | Clock in/out, with geofence result and generated `worked_minutes`. |
| `dh_leave_types` | Per-org leave types and yearly allowance. |
| `dh_leave_entitlements` | Per-member override of that allowance. |
| `dh_leave_requests` | Requests and approvals. |
| `dh_contributions` | Payroll contributions — generic by design (see below). |
| `dh_audit_log` | Who changed what. |

Views: `dh_leave_balances` (allowance − approved days, per member per type).

## Roles

`owner` › `admin` › `manager` › `member`

- **member** — sees only their own record, shifts, timesheets and leave.
- **manager** — full visibility of the team; approves leave; edits rosters.
- **admin/owner** — the above, plus contributions (payroll cost config) and audit log.

Contributions are readable by managers but writable only by admins, since
they expose whole-org financials.

## Internationalisation

No country's statutory scheme names appear in the schema or app logic. A
contribution is just `name + basis + employer_value + employee_value`, with an
optional salary band. When an org is created, `dh_seed_contributions()` inserts
a starting template based on the country code (US, GB, SG, AU, CA, IN, or a
generic fallback of social security / health insurance / pension). Every row is
then editable, renameable and deletable by the org.

**The seeded rates are convenience defaults, not legal advice.** Statutory
rates change and vary by salary band, employee category and sub-national
jurisdiction. Confirm current figures with a local authority or payroll adviser
before running real payroll.

## Server-side logic

Money and geofencing are computed in the database, not the browser, so the UI
can't disagree with payroll and a modified client can't fake a location:

- `dh_monthly_base(member)` — normalises hourly/monthly/annual to a monthly figure
  using the org's `hours_per_week` (default 38).
- `dh_member_costs(member)` — returns base, employer share, employee deduction.
- `dh_clock_in(member, shift, lat, lng)` — haversine check against the location
  radius; raises if outside the area or already clocked in.
- `dh_clock_out(member, lat, lng)` — closes the open entry.

A partial unique index (`dh_one_open_entry`) makes double clock-in impossible
even if the function is bypassed.

## Verified

Migrations were applied to a real PostgreSQL 16 instance and tested:

- Org-creation trigger assigns owner and seeds leave types + country contributions.
- **Tenant isolation**: owner A sees only org A's members, owner B only org B's.
- **Role isolation**: a plain member sees only themselves and cannot read
  contributions; an anonymous session sees nothing.
- Cost math: 3000/mo at US template = 337.50 employer, 319.50 employee.
- Hourly conversion: 20/hr @ 38h/wk = 3293.33/mo.
- Geofence: a clock-in 5004 m from a 50 m site is rejected; on-site succeeds.
- Double clock-in rejected; `worked_minutes` computed on clock-out.
- Leave balances deduct approved days only, not pending ones.
- Check constraints reject end-before-start shifts and out-of-range radii.

Tests ran under a non-superuser role, since superusers bypass RLS and would
have made the isolation results meaningless.

## Not yet built

- Member invitation email flow (`dh_members.user_id` is populated on accept).
- Payroll run history — costs are computed live; there is no immutable
  period snapshot yet. Add `dh_pay_runs` before anyone relies on historical figures.
- Overtime and public-holiday rules.
- Salary-band proration: `min_base`/`max_base` gate whether a contribution
  applies at all; they do not yet cap the contributed amount within the band.
