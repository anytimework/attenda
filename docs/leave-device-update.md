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
