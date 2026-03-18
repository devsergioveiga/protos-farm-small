---
phase: 10
slug: recebimento-de-mercadorias
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                        |
| ---------------------- | ---------------------------------------------------------------------------- |
| **Framework**          | jest 29.x (backend), vitest (frontend)                                       |
| **Config file**        | `apps/backend/jest.config.js`, `apps/frontend/vitest.config.ts`              |
| **Quick run command**  | `cd apps/backend && npx jest --testPathPattern=goods-receipts --no-coverage` |
| **Full suite command** | `cd apps/backend && npx jest --testPathPattern=goods-receipts --coverage`    |
| **Estimated runtime**  | ~30 seconds                                                                  |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/backend && npx jest --testPathPattern=goods-receipts --no-coverage`
- **After every plan wave:** Run `cd apps/backend && npx jest --testPathPattern=goods-receipts --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement      | Test Type   | Automated Command                      | File Exists | Status  |
| -------- | ---- | ---- | ---------------- | ----------- | -------------------------------------- | ----------- | ------- |
| 10-01-01 | 01   | 1    | RECE-01          | unit        | `npx jest goods-receipts.routes.spec`  | No (W0)     | pending |
| 10-01-02 | 01   | 1    | RECE-01          | unit        | `npx jest goods-receipts.routes.spec`  | No (W0)     | pending |
| 10-02-01 | 02   | 2    | RECE-02          | unit        | `npx jest goods-receipts.routes.spec`  | No (W0)     | pending |
| 10-02-02 | 02   | 2    | RECE-02          | unit        | `npx jest goods-receipts.routes.spec`  | No (W0)     | pending |
| 10-03-01 | 03   | 3    | RECE-03, FINC-01 | integration | `npx jest goods-receipts.routes.spec`  | No (W0)     | pending |
| 10-03-02 | 03   | 3    | RECE-03, FINC-01 | integration | `npx jest goods-receipts.routes.spec`  | No (W0)     | pending |
| 10-04-01 | 04   | 3    | RECE-01          | tsc-only    | `cd apps/frontend && npx tsc --noEmit` | n/a         | pending |
| 10-04-02 | 04   | 3    | RECE-01          | tsc-only    | `cd apps/frontend && npx tsc --noEmit` | n/a         | pending |
| 10-05-01 | 05   | 4    | RECE-02, RECE-03 | tsc-only    | `cd apps/frontend && npx tsc --noEmit` | n/a         | pending |
| 10-05-02 | 05   | 4    | RECE-02, RECE-03 | tsc-only    | `cd apps/frontend && npx tsc --noEmit` | n/a         | pending |

_Status: pending / green / red / flaky_

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/goods-receipts/goods-receipts.routes.spec.ts` — stubs for RECE-01, RECE-02, RECE-03, FINC-01
- [ ] Test fixtures for GoodsReceipt, GoodsReceiptItem, GoodsReceiptDivergence

_Existing infrastructure covers test framework setup — only test files needed._

---

## Frontend Verification Note

Plans 04 and 05 (frontend) use `npx tsc --noEmit` as automated verification. No component tests are included because:

1. The project does not have an established frontend component test pattern (no existing `*.test.tsx` files for page-level components)
2. The primary frontend verification is type-checking + manual visual verification
3. Full functional verification happens via backend integration tests (API layer) + manual UI testing during verify-work

If component tests are desired in the future, a dedicated Wave 0 task should create the test scaffold (`GoodsReceiptsPage.test.tsx`, `GoodsReceiptModal.test.tsx`) with vitest + @testing-library/react setup.

---

## Manual-Only Verifications

| Behavior                    | Requirement | Why Manual                          | Test Instructions                                                 |
| --------------------------- | ----------- | ----------------------------------- | ----------------------------------------------------------------- |
| Photo upload for divergence | RECE-02     | File upload requires multipart form | POST multipart to /goods-receipts/:id/divergences with image file |
| PDF drill-down navigation   | FINC-01     | UI navigation flow                  | Click CP -> Recebimento -> OC -> Cotacao -> RC links              |
| Wizard step navigation      | RECE-01     | UI interaction flow                 | Walk through all 4 wizard steps, verify field visibility per type |
| Divergence badge display    | RECE-02     | Visual verification                 | Create receipt with >5% qty divergence, verify yellow badge       |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
