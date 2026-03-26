---
phase: 17
slug: engine-de-deprecia-o
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-20
updated: 2026-03-19
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                       |
| ---------------------- | --------------------------------------------------------------------------- |
| **Framework**          | jest 29.x (backend), vitest (frontend)                                      |
| **Config file**        | `apps/backend/jest.config.ts`, `apps/frontend/vitest.config.ts`             |
| **Quick run command**  | `pnpm --filter @protos-farm/backend test -- --testPathPattern=depreciation` |
| **Full suite command** | `pnpm test`                                                                 |
| **Estimated runtime**  | ~30 seconds (backend depreciation tests)                                    |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @protos-farm/backend test -- --testPathPattern=depreciation`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type   | Automated Command                                                                  | File Exists | Status  |
| -------- | ---- | ---- | ----------- | ----------- | ---------------------------------------------------------------------------------- | ----------- | ------- |
| 17-00-01 | 00   | 0    | ALL         | stubs       | `pnpm --filter @protos-farm/backend test -- --testPathPattern=depreciation`        | Wave 0      | pending |
| 17-01-01 | 01   | 1    | DEPR-01     | schema      | `npx prisma validate --schema apps/backend/prisma/schema.prisma`                   | N/A         | pending |
| 17-01-02 | 01   | 1    | DEPR-02     | unit        | `pnpm --filter @protos-farm/backend test -- --testPathPattern=depreciation-engine` | Wave 0      | pending |
| 17-02-01 | 02   | 2    | DEPR-02     | unit        | `pnpm --filter @protos-farm/backend test -- --testPathPattern=depreciation-batch`  | Wave 0      | pending |
| 17-02-02 | 02   | 2    | DEPR-01     | integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern=depreciation.routes` | Wave 0      | pending |
| 17-02-03 | 02   | 2    | CCPA-01     | tsc         | `cd apps/backend && npx tsc --noEmit`                                              | N/A         | pending |
| 17-03-01 | 03   | 3    | ALL         | tsc         | `cd apps/frontend && npx tsc --noEmit`                                             | N/A         | pending |
| 17-03-02 | 03   | 3    | ALL         | visual      | Manual checkpoint — UI verification                                                | N/A         | pending |

_Status: pending / green / red / flaky_

---

## Wave 0 Requirements

Plan 17-00 creates all three stub files:

- [x] `apps/backend/src/modules/depreciation/depreciation-engine.spec.ts` — stubs for arithmetic
- [x] `apps/backend/src/modules/depreciation/depreciation-batch.spec.ts` — stubs for batch processing
- [x] `apps/backend/src/modules/depreciation/depreciation.routes.spec.ts` — stubs for API endpoints

---

## Manual-Only Verifications

| Behavior                    | Requirement | Why Manual                                    | Test Instructions                                                         |
| --------------------------- | ----------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| Cron executes monthly batch | DEPR-02     | Requires system clock manipulation or waiting | Trigger batch endpoint manually, verify entries created for current month |
| Report PDF formatting       | CCPA-02     | Visual verification of PDF layout             | Export PDF, check column alignment and totals                             |
| Frontend UI flows           | ALL         | Visual/interactive verification               | Plan 17-03 Task 3 checkpoint                                              |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Plan 17-00)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
