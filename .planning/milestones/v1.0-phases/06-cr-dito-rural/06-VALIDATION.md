---
phase: 6
slug: cr-dito-rural
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                          |
| ---------------------- | ------------------------------------------------------------------------------ |
| **Framework**          | Jest (via @swc/jest), already configured                                       |
| **Config file**        | `apps/backend/jest.config.js`                                                  |
| **Quick run command**  | `cd apps/backend && npx jest --testPathPattern rural-credit --passWithNoTests` |
| **Full suite command** | `cd apps/backend && npx jest`                                                  |
| **Estimated runtime**  | ~15 seconds (phase tests only)                                                 |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/backend && npx jest --testPathPattern rural-credit --passWithNoTests`
- **After every plan wave:** Run `cd apps/backend && npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type   | Automated Command                                      | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ----------- | ------------------------------------------------------ | ----------- | ---------- |
| 06-01-01 | 01   | 1    | FN-14-1     | unit        | `cd packages/shared && npx jest rural-credit-schedule` | ❌ W0       | ⬜ pending |
| 06-01-01 | 01   | 1    | FN-14-2     | unit        | `cd packages/shared && npx jest rural-credit-schedule` | ❌ W0       | ⬜ pending |
| 06-01-01 | 01   | 1    | FN-14-3     | unit        | `cd packages/shared && npx jest rural-credit-schedule` | ❌ W0       | ⬜ pending |
| 06-01-01 | 01   | 1    | FN-14-4     | unit        | `cd packages/shared && npx jest rural-credit-schedule` | ❌ W0       | ⬜ pending |
| 06-01-02 | 01   | 1    | FN-14-5     | integration | `cd apps/backend && npx jest rural-credit.routes.spec` | ❌ W0       | ⬜ pending |
| 06-01-02 | 01   | 1    | FN-14-6     | integration | `cd apps/backend && npx jest rural-credit.routes.spec` | ❌ W0       | ⬜ pending |
| 06-01-02 | 01   | 1    | FN-14-7     | integration | `cd apps/backend && npx jest rural-credit.routes.spec` | ❌ W0       | ⬜ pending |
| 06-01-02 | 01   | 1    | FN-14-8     | integration | `cd apps/backend && npx jest rural-credit.routes.spec` | ❌ W0       | ⬜ pending |
| 06-01-02 | 01   | 1    | FN-14-9     | integration | `cd apps/backend && npx jest rural-credit.routes.spec` | ❌ W0       | ⬜ pending |
| 06-01-02 | 01   | 1    | FN-14-10    | integration | `cd apps/backend && npx jest rural-credit.routes.spec` | ❌ W0       | ⬜ pending |
| 06-01-02 | 01   | 1    | FN-14-11    | integration | `cd apps/backend && npx jest rural-credit.routes.spec` | ❌ W0       | ⬜ pending |
| 06-01-02 | 01   | 1    | FN-14-12    | integration | `cd apps/backend && npx jest rural-credit.routes.spec` | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `packages/shared/src/utils/__tests__/rural-credit-schedule.spec.ts` — stubs for FN-14-1 through FN-14-4 (SAC/Price/Bullet + grace period)
- [ ] `apps/backend/src/modules/rural-credit/rural-credit.routes.spec.ts` — stubs for FN-14-5 through FN-14-12 (contract CRUD, settlement, status, alerts)

_Existing infrastructure (Jest, Prisma test helpers, supertest) covers framework needs._

---

## Manual-Only Verifications

| Behavior                                 | Requirement | Why Manual          | Test Instructions                                                          |
| ---------------------------------------- | ----------- | ------------------- | -------------------------------------------------------------------------- |
| Contract card layout renders correctly   | FN-14 SC1   | Visual verification | Navigate to /rural-credit, verify cards show line/banco/valor/saldo/status |
| Simulate preview table is readable       | FN-14 SC1   | Visual verification | Create contract, click Simular, verify cronograma table layout             |
| Dashboard credit card displays correctly | FN-14 SC3   | Visual verification | Navigate to dashboard, verify Crédito Rural card with totals               |
| Alert badge appears in sidebar           | FN-14 SC5   | Visual verification | With contract due within alertDaysBefore, verify sidebar badge             |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
