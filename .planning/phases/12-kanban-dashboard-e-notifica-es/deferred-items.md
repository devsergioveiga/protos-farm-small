# Deferred Items — Phase 12

## Pre-existing TypeScript errors in spec files (out of scope for plan 12-04)

**Files:**

- `apps/frontend/src/components/farm-selector/FarmSelector.spec.tsx`
- `apps/frontend/src/pages/FarmsPage.spec.tsx`
- `apps/frontend/src/stores/FarmContext.spec.tsx`

**Error:** `registrations` property does not exist in `{ ruralProperties: number; fieldPlots: number; }` type.

**Root cause:** `apps/frontend/src/types/farm.ts` was modified in a prior plan (12-03 or earlier) to rename/remove the `registrations` field to `ruralProperties + fieldPlots`, but spec files were not updated.

**Action needed:** Update spec files to use `ruralProperties` and `fieldPlots` instead of `registrations` in farm mock data.
