---
phase: 17
slug: engine-de-deprecia-o
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
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

| Task ID  | Plan | Wave | Requirement | Test Type   | Automated Command                                                                  | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ----------- | ---------------------------------------------------------------------------------- | ----------- | ---------- |
| 17-01-01 | 01   | 0    | DEPR-01     | unit stub   | `pnpm --filter @protos-farm/backend test -- --testPathPattern=depreciation`        | ❌ W0       | ⬜ pending |
| 17-01-02 | 01   | 1    | DEPR-01     | integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern=depreciation-config` | ❌ W0       | ⬜ pending |
| 17-02-01 | 02   | 1    | DEPR-02     | integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern=depreciation-batch`  | ❌ W0       | ⬜ pending |
| 17-02-02 | 02   | 1    | DEPR-02     | unit        | `pnpm --filter @protos-farm/backend test -- --testPathPattern=depreciation-calc`   | ❌ W0       | ⬜ pending |
| 17-03-01 | 03   | 2    | CCPA-01     | integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern=depreciation`        | ❌ W0       | ⬜ pending |
| 17-04-01 | 04   | 2    | CCPA-02     | e2e         | `pnpm --filter @protos-farm/frontend test -- --testPathPattern=Depreciation`       | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/depreciation/depreciation.routes.spec.ts` — stubs for DEPR-01, DEPR-02
- [ ] `apps/backend/src/modules/depreciation/depreciation-calc.spec.ts` — stubs for calculation engine
- [ ] `apps/frontend/src/pages/DepreciationPage.spec.tsx` — stubs for CCPA-02

---

## Manual-Only Verifications

| Behavior                    | Requirement | Why Manual                                    | Test Instructions                                                         |
| --------------------------- | ----------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| Cron executes monthly batch | DEPR-02     | Requires system clock manipulation or waiting | Trigger batch endpoint manually, verify entries created for current month |
| Report PDF formatting       | CCPA-02     | Visual verification of PDF layout             | Export PDF, check column alignment and totals                             |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
