/**
 * Direct Hire — Supabase client
 *
 * Standalone product. This file must never import or reference
 * ShiftOps credentials, tables or helpers. It talks to its own
 * Supabase project only.
 */
import { createClient } from '@supabase/supabase-js';

const URL  = import.meta.env.VITE_DH_SUPABASE_URL;
const ANON = import.meta.env.VITE_DH_SUPABASE_ANON_KEY;

if (!URL || !ANON) {
  throw new Error(
    'Missing VITE_DH_SUPABASE_URL / VITE_DH_SUPABASE_ANON_KEY. ' +
    'Direct Hire uses its own Supabase project — do not reuse ShiftOps keys.'
  );
}

export const dh = createClient(URL, ANON, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'dh.auth' }
});

/* ---------------- auth ---------------- */
export const signIn  = (email, password) => dh.auth.signInWithPassword({ email, password });
export const signUp  = (email, password) => dh.auth.signUp({ email, password });
export const signOut = () => dh.auth.signOut();
export const currentUser = async () => (await dh.auth.getUser()).data.user;

/* ---------------- org ---------------- */
export async function createOrg({ name, countryCode, currencyCode, timezone }) {
  // the DB trigger makes the caller owner and seeds leave types + contributions
  const { data, error } = await dh.from('dh_orgs').insert({
    name, country_code: countryCode, currency_code: currencyCode, timezone
  }).select().single();
  if (error) throw error;
  return data;
}

export async function myOrgs() {
  const { data, error } = await dh
    .from('dh_org_users')
    .select('role, dh_orgs(id, name, country_code, currency_code, timezone, hours_per_week)');
  if (error) throw error;
  return data.map(r => ({ ...r.dh_orgs, role: r.role }));
}

/* ---------------- members ---------------- */
export async function listMembers(orgId) {
  const { data, error } = await dh
    .from('dh_members')
    .select('*, dh_locations(name)')
    .eq('org_id', orgId)
    .order('full_name');
  if (error) throw error;
  return data;
}

export const addMember = (orgId, m) =>
  dh.from('dh_members').insert({ org_id: orgId, ...m }).select().single();

export const updateMember = (id, patch) =>
  dh.from('dh_members').update(patch).eq('id', id).select().single();

/* ---------------- shifts & time ---------------- */
export async function listShifts(orgId, fromDate, toDate) {
  const { data, error } = await dh
    .from('dh_shifts')
    .select('*, dh_members(full_name, job_title), dh_locations(name)')
    .eq('org_id', orgId)
    .gte('shift_date', fromDate)
    .lte('shift_date', toDate)
    .order('shift_date');
  if (error) throw error;
  return data;
}

export const scheduleShift = (orgId, s) =>
  dh.from('dh_shifts').insert({ org_id: orgId, ...s }).select().single();

/** Geofence is enforced server-side; a rejected clock-in throws. */
export async function clockIn(memberId, shiftId, coords) {
  const { data, error } = await dh.rpc('dh_clock_in', {
    p_member: memberId, p_shift: shiftId,
    p_lat: coords?.latitude ?? null, p_lng: coords?.longitude ?? null
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function clockOut(memberId, coords) {
  const { error } = await dh.rpc('dh_clock_out', {
    p_member: memberId,
    p_lat: coords?.latitude ?? null, p_lng: coords?.longitude ?? null
  });
  if (error) throw new Error(error.message);
}

export async function timesheets(orgId, fromISO, toISO) {
  const { data, error } = await dh
    .from('dh_time_entries')
    .select('*, dh_members(full_name), dh_shifts(starts_at, ends_at)')
    .eq('org_id', orgId)
    .gte('clock_in_at', fromISO)
    .lte('clock_in_at', toISO)
    .order('clock_in_at', { ascending: false });
  if (error) throw error;
  return data;
}

/* ---------------- leave ---------------- */
export async function leaveRequests(orgId, status) {
  let q = dh.from('dh_leave_requests')
    .select('*, dh_members(full_name), dh_leave_types(name, is_paid)')
    .eq('org_id', orgId);
  if (status) q = q.eq('status', status);
  const { data, error } = await q.order('starts_on');
  if (error) throw error;
  return data;
}

export const requestLeave = (orgId, r) =>
  dh.from('dh_leave_requests').insert({ org_id: orgId, ...r }).select().single();

export async function decideLeave(id, approve) {
  const user = await currentUser();
  const { error } = await dh.from('dh_leave_requests').update({
    status: approve ? 'approved' : 'declined',
    decided_by: user?.id ?? null,
    decided_at: new Date().toISOString()
  }).eq('id', id);
  if (error) throw error;
}

export async function leaveBalances(orgId, memberId) {
  let q = dh.from('dh_leave_balances').select('*').eq('org_id', orgId);
  if (memberId) q = q.eq('member_id', memberId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

/* ---------------- contributions & costs ---------------- */
export async function listContributions(orgId) {
  const { data, error } = await dh
    .from('dh_contributions')
    .select('*').eq('org_id', orgId).order('sort_order');
  if (error) throw error;
  return data;
}

export const saveContribution = (orgId, c) =>
  c.id ? dh.from('dh_contributions').update(c).eq('id', c.id).select().single()
       : dh.from('dh_contributions').insert({ org_id: orgId, ...c }).select().single();

export const deleteContribution = id =>
  dh.from('dh_contributions').delete().eq('id', id);

/** Server-side cost calc so the UI can never disagree with payroll. */
export async function memberCosts(memberId) {
  const { data, error } = await dh.rpc('dh_member_costs', { p_member: memberId });
  if (error) throw error;
  return data?.[0] ?? { base: 0, employer_share: 0, employee_deduction: 0 };
}

/* ---------------- realtime ---------------- */
export function watchClockIns(orgId, onChange) {
  return dh.channel(`dh:time:${orgId}`)
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'dh_time_entries', filter: `org_id=eq.${orgId}` },
        onChange)
    .subscribe();
}
