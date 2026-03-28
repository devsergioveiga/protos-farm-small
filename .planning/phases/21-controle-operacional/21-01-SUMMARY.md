---
phase: 21-controle-operacional
plan: '01'
subsystem: assets
tags: [operational-cost, tco, asset-documents, alerts, backend, frontend]
dependency_graph:
  requires: []
  provides:
    - 'GET /org/:orgId/assets/:assetId/operational-cost endpoint'
    - 'AssetDocumentAlertsView component on AssetsPage'
    - 'useAssetDocumentAlerts hook'
  affects:
    - 'apps/backend/src/app.ts'
    - 'apps/frontend/src/pages/AssetsPage.tsx'
tech_stack:
  added: []
  patterns:
    - 'Decimal.js for all monetary/numeric aggregation (no native JS arithmetic)'
    - '4-bucket document alert pattern (expired/urgent/warning/upcoming)'
    - 'button card with aria-expanded for collapsible item list'
key_files:
  created:
    - 'apps/backend/src/modules/assets/asset-operational-cost.service.ts'
    - 'apps/backend/src/modules/assets/asset-operational-cost.routes.ts'
    - 'apps/backend/src/modules/assets/asset-operational-cost.routes.spec.ts'
    - 'apps/frontend/src/hooks/useAssetDocumentAlerts.ts'
    - 'apps/frontend/src/components/assets/AssetDocumentAlertsView.tsx'
    - 'apps/frontend/src/components/assets/AssetDocumentAlertsView.css'
  modified:
    - 'apps/backend/src/app.ts'
    - 'apps/frontend/src/pages/AssetsPage.tsx'
decisions:
  - 'insuranceCost always null — insurance field not modeled in schema, surfaced in notes array'
  - 'Depreciation aggregation is cumulative (not period-filtered) — correct for TCO/book value'
  - 'OnAssetClick opens AssetDrawer on documentos tab for direct navigation to expiring doc'
  - 'AlertsView returns null (not empty state) when all bucket counts are 0 — avoids visual noise'
metrics:
  duration_seconds: 231
  completed_date: '2026-03-22'
  tasks_completed: 2
  files_created: 6
  files_modified: 2
---

# Phase 21 Plan 01: Operational Cost Endpoint + Document Alerts Summary

**One-liner:** Aggregated TCO endpoint (acquisition + depreciation + maintenance + fuel) with decimal-safe arithmetic, and 4-bucket document expiry alert cards wired into AssetsPage.

## Tasks Completed

| Task | Name                                     | Commit   | Files                                                                       |
| ---- | ---------------------------------------- | -------- | --------------------------------------------------------------------------- |
| 1    | Backend operational cost endpoint + spec | 1342a025 | asset-operational-cost.service.ts, routes.ts, spec.ts, app.ts               |
| 2    | Frontend document expiry alerts view     | 97dfe648 | AssetDocumentAlertsView.tsx/.css, useAssetDocumentAlerts.ts, AssetsPage.tsx |

## What Was Built

### Task 1: Backend Operational Cost Endpoint

- `asset-operational-cost.service.ts`: `getOperationalCost` aggregates acquisition value, cumulative depreciation (unreversed entries only), maintenance cost (completed work orders), and fuel cost — all using `new Decimal(String(...))` pattern for correctness.
- `asset-operational-cost.routes.ts`: `GET /org/:orgId/assets/:assetId/operational-cost` with optional `?periodStart&periodEnd` query params for scoped cost analysis.
- `asset-operational-cost.routes.spec.ts`: 7 tests covering 200 with all fields, 404 not found, null hourmeter, zero aggregates, period filter propagation, insuranceCost=null/notes, and 401 unauthenticated.
- Registered in `app.ts` alongside existing asset module routes.

### Task 2: Frontend Document Expiry Alerts

- `useAssetDocumentAlerts.ts`: Hook fetching `GET /org/:orgId/asset-documents/expiring`, returns `{ alerts, loading, error, refetch }`.
- `AssetDocumentAlertsView.tsx`: 4 clickable button cards (expired/urgent/warning/upcoming) with `aria-expanded` expansion to show item list. Returns null when all counts are 0.
- `AssetDocumentAlertsView.css`: Design system compliant — DM Sans for count, Source Sans 3 for labels, 4px spacing scale, `border-left` urgency color coding, responsive stacking at ≤768px.
- `AssetsPage.tsx`: Alerts rendered above filter bar; `onAssetClick` opens AssetDrawer on `documentos` tab.

## Verification

- Backend tests: 7 new + 26 existing (fuel-records, meter-readings, asset-documents) all pass.
- Frontend TypeScript: no errors in new files (pre-existing errors in unrelated maintenance files are out of scope).
- Acceptance criteria: all items verified.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `/Users/sergiosoares/Documents/it_projects/protos-farm-small/apps/backend/src/modules/assets/asset-operational-cost.service.ts` — EXISTS
- `/Users/sergiosoares/Documents/it_projects/protos-farm-small/apps/backend/src/modules/assets/asset-operational-cost.routes.ts` — EXISTS
- `/Users/sergiosoares/Documents/it_projects/protos-farm-small/apps/backend/src/modules/assets/asset-operational-cost.routes.spec.ts` — EXISTS
- `/Users/sergiosoares/Documents/it_projects/protos-farm-small/apps/frontend/src/hooks/useAssetDocumentAlerts.ts` — EXISTS
- `/Users/sergiosoares/Documents/it_projects/protos-farm-small/apps/frontend/src/components/assets/AssetDocumentAlertsView.tsx` — EXISTS
- `/Users/sergiosoares/Documents/it_projects/protos-farm-small/apps/frontend/src/components/assets/AssetDocumentAlertsView.css` — EXISTS
- Commit 1342a025 — EXISTS
- Commit 97dfe648 — EXISTS
