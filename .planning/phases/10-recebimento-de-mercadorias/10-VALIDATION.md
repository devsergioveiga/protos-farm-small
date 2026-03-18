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

| Task ID  | Plan | Wave | Requirement      | Test Type   | Automated Command                                       | File Exists | Status     |
| -------- | ---- | ---- | ---------------- | ----------- | ------------------------------------------------------- | ----------- | ---------- |
| 10-01-01 | 01   | 1    | RECE-01          | unit        | `npx jest goods-receipts.routes.spec`                   | ❌ W0       | ⬜ pending |
| 10-01-02 | 01   | 1    | RECE-01          | unit        | `npx jest goods-receipts.routes.spec`                   | ❌ W0       | ⬜ pending |
| 10-02-01 | 02   | 1    | RECE-02          | unit        | `npx jest goods-receipts.routes.spec`                   | ❌ W0       | ⬜ pending |
| 10-02-02 | 02   | 1    | RECE-02          | unit        | `npx jest goods-receipts.routes.spec`                   | ❌ W0       | ⬜ pending |
| 10-03-01 | 03   | 2    | RECE-03, FINC-01 | integration | `npx jest goods-receipts.routes.spec`                   | ❌ W0       | ⬜ pending |
| 10-04-01 | 04   | 3    | RECE-01          | component   | `cd apps/frontend && npx vitest run --reporter=verbose` | ❌ W0       | ⬜ pending |
| 10-05-01 | 05   | 3    | RECE-02, RECE-03 | component   | `cd apps/frontend && npx vitest run --reporter=verbose` | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/goods-receipts/goods-receipts.routes.spec.ts` — stubs for RECE-01, RECE-02, RECE-03, FINC-01
- [ ] Test fixtures for GoodsReceipt, GoodsReceiptItem, GoodsReceiptDivergence

_Existing infrastructure covers test framework setup — only test files needed._

---

## Manual-Only Verifications

| Behavior                    | Requirement | Why Manual                          | Test Instructions                                                 |
| --------------------------- | ----------- | ----------------------------------- | ----------------------------------------------------------------- |
| Photo upload for divergence | RECE-02     | File upload requires multipart form | POST multipart to /goods-receipts/:id/divergences with image file |
| PDF drill-down navigation   | FINC-01     | UI navigation flow                  | Click CP → Recebimento → OC → Cotação → RC links                  |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
