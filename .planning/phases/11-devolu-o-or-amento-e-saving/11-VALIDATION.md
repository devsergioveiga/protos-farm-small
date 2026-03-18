---
phase: 11
slug: devolu-o-or-amento-e-saving
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Framework**          | jest 29.x (backend), vitest (frontend)                                                                           |
| **Config file**        | `apps/backend/jest.config.js`, `apps/frontend/vitest.config.ts`                                                  |
| **Quick run command**  | `cd apps/backend && npx jest --testPathPattern="goods-returns\|purchase-budgets\|saving-analysis" --no-coverage` |
| **Full suite command** | `cd apps/backend && npx jest --testPathPattern="goods-returns\|purchase-budgets\|saving-analysis" --coverage`    |
| **Estimated runtime**  | ~30 seconds                                                                                                      |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement      | Test Type | Automated Command                       | File Exists | Status     |
| -------- | ---- | ---- | ---------------- | --------- | --------------------------------------- | ----------- | ---------- |
| 11-01-01 | 01   | 1    | DEVO-01          | unit      | `npx jest goods-returns.routes.spec`    | ❌ W0       | ⬜ pending |
| 11-02-01 | 02   | 2    | DEVO-01          | unit      | `npx jest goods-returns.routes.spec`    | ❌ W0       | ⬜ pending |
| 11-03-01 | 03   | 2    | FINC-02          | unit      | `npx jest purchase-budgets.routes.spec` | ❌ W0       | ⬜ pending |
| 11-04-01 | 04   | 2    | FINC-03          | unit      | `npx jest saving-analysis.routes.spec`  | ❌ W0       | ⬜ pending |
| 11-05-01 | 05   | 3    | DEVO-01          | tsc-only  | `cd apps/frontend && npx tsc --noEmit`  | N/A         | ⬜ pending |
| 11-06-01 | 06   | 3    | FINC-02, FINC-03 | tsc-only  | `cd apps/frontend && npx tsc --noEmit`  | N/A         | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/goods-returns/goods-returns.routes.spec.ts` — stubs for DEVO-01
- [ ] `apps/backend/src/modules/purchase-budgets/purchase-budgets.routes.spec.ts` — stubs for FINC-02
- [ ] `apps/backend/src/modules/saving-analysis/saving-analysis.routes.spec.ts` — stubs for FINC-03

_Existing infrastructure covers test framework setup — only test files needed._

---

## Manual-Only Verifications

| Behavior                     | Requirement | Why Manual                          | Test Instructions                                           |
| ---------------------------- | ----------- | ----------------------------------- | ----------------------------------------------------------- |
| Photo upload for return      | DEVO-01     | File upload requires multipart form | POST multipart to /goods-returns/:id/photos with image file |
| Budget alert on RC approval  | FINC-02     | Cross-module integration            | Approve RC exceeding budget, verify badge appears           |
| Recharts price history graph | FINC-03     | Visual rendering                    | Navigate to saving page, verify graph renders with data     |
| Frontend wizard UX flow      | DEVO-01     | UI navigation                       | Create return via modal, verify steps and confirmation      |

---

## Frontend Verification Note

Plans 05 and 06 (frontend) use `tsc --noEmit` as automated verify — no component tests. Frontend behavior (modals, Recharts graphs, budget progress bars) requires manual browser testing.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
