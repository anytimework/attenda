# Device recovery and daily leave approvals

Published change prepared 21 September 2026.

- Read localStorage, cookie and IndexedDB device copies before deciding identity. Recover only a copy matching the worker's approved device. Bound the IndexedDB startup wait and preserve conflicting copies until registration is checked.
- Preserve newer device approvals and per-day leave decisions during stale-session saves. Conditional database writes retry when another session saves concurrently.
- Settings → Leave overlap policy controls overlapping requests across workers. Off by default; pending and approved leave reserve dates. Same-worker duplicate dates are blocked regardless of this setting.
- Workers can submit only clear dates or supply an urgent reason to appeal overlapping dates. Appeals remain pending until explicitly approved.
- Every date in both new and historical requests has its own approval, rejection or recall. Original historical ranges are retained; per-day decisions are overlaid without destructive migration.
- Balances, monthly unpaid-leave deductions, leave notifications and shift cancellation use daily decisions. Existing approved requests retain their total recorded day allocation.

Refresh open employer and worker sessions after deployment. Older loaded clients do not understand per-day decisions or the conditional-save protocol.

Device recovery still requires a surviving browser identity. If all site data is erased, or a different browser is used, a new device approval is necessary. No worker's account was reset and no leave was approved as part of the release.

Run `node scripts/test-leave-and-device.mjs`. Coverage includes overlap options, urgent appeals, same-worker duplicates, invalid and leap-year dates, historical ranges, daily decisions, recalls, shift cancellation, year boundaries, offline handling, device backup recovery, stale-device approvals and concurrent saves. Rendering checks use the real view methods with test fixtures; no production leave requests are created.

All 41 added device/leave messages have explicit Simplified Chinese, Traditional Chinese and Japanese translations alongside English. This includes interpolation, native dialogs and activity entries. Translation regression tests verify placeholder parity and localized flows. Traditional Chinese date formatting uses zh-TW.

## 13 October: recurring schedule renewal and slow device storage

Recurring schedules now append missing shifts across a rolling 56-day window at sign-in, restored sessions and successful foreground refreshes. Existing shifts (including cancelled shifts), attendance, approved leave, inactive employees and configured end dates are respected. Worker sessions maintain only their own schedule; administrators maintain active employees' schedules. The renewal is idempotent and uses stable employee/date IDs.

Device startup keeps a delayed IndexedDB read alive after the two-second UI startup timeout and does not write over the unread backup. A late backup is trusted for an existing worker only when it matches the approved device. Regression coverage exercises timeout recovery and unrelated-device rejection.

McBilly's active account had a saved weekday 07:00–16:00 schedule whose generated eight-week batch ended on 9 October. On 13 October, 40 missing upcoming scheduled shifts were restored with a conditional cloud write and verified by rereading. No attendance times, historical shifts or November cover shifts were altered. The code changes in this section await deployment approval.
