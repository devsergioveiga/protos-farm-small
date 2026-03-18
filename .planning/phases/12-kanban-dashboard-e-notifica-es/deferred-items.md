# Deferred Items — Phase 12

## Pre-existing TypeScript errors in spec files

**Files:**

- apps/frontend/src/components/farm-selector/FarmSelector.spec.tsx
- apps/frontend/src/pages/FarmsPage.spec.tsx
- apps/frontend/src/stores/FarmContext.spec.tsx

**Error:** `registrations` does not exist in type `{ ruralProperties: number; fieldPlots: number; }` — pre-existing before Plan 12-03, unrelated to kanban implementation.

**Action needed:** Update test fixtures to match current FarmListItem type (remove `registrations` property).
