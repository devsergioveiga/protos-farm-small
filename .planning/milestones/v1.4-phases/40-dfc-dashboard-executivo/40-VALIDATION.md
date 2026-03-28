---
phase: 40
slug: dfc-dashboard-executivo
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| **Framework**          | jest 29.x (backend), vitest (frontend)                                                    |
| **Config file**        | `apps/backend/jest.config.ts`, `apps/frontend/vitest.config.ts`                           |
| **Quick run command**  | `cd apps/backend && npx jest --testPathPattern="dfc\|financial-statements" --no-coverage` |
| **Full suite command** | `cd apps/backend && npx jest --no-coverage && cd ../../apps/frontend && npx vitest run`   |
| **Estimated runtime**  | ~45 seconds                                                                               |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/backend && npx jest --testPathPattern="dfc\|financial-statements\|accounting-dashboard" --no-coverage`
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type   | Automated Command                                          | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ----------- | ---------------------------------------------------------- | ----------- | ---------- |
| 40-01-01 | 01   | 1    | DFC-01      | unit        | `npx jest --testPathPattern="dfc.calculator"`              | ❌ W0       | ⬜ pending |
| 40-01-02 | 01   | 1    | DFC-02      | unit        | `npx jest --testPathPattern="dfc.calculator"`              | ❌ W0       | ⬜ pending |
| 40-01-03 | 01   | 1    | DFC-03      | unit        | `npx jest --testPathPattern="cross-validation"`            | ✅          | ⬜ pending |
| 40-02-01 | 02   | 2    | DFC-01      | integration | `npx jest --testPathPattern="financial-statements.routes"` | ✅          | ⬜ pending |
| 40-03-01 | 03   | 2    | DASH-01     | unit+visual | `npx vitest run --reporter=verbose`                        | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/financial-statements/__tests__/dfc.calculator.spec.ts` — stubs for DFC-01, DFC-02
- [ ] `apps/frontend/src/pages/__tests__/DfcPage.test.tsx` — stubs for DFC frontend
- [ ] `apps/frontend/src/pages/__tests__/AccountingDashboardPage.test.tsx` — stubs for DASH-01

_Existing infrastructure covers test framework and fixtures — only new test files needed._

---

## Manual-Only Verifications

| Behavior                  | Requirement   | Why Manual             | Test Instructions                                                            |
| ------------------------- | ------------- | ---------------------- | ---------------------------------------------------------------------------- |
| Dashboard chart rendering | DASH-01       | recharts visual output | Open /accounting-dashboard, verify 12m line chart and donut render correctly |
| Alert navigation          | DASH-01       | Browser routing        | Click each alert card, verify navigation to correct page                     |
| DFC tab switching         | DFC-01/DFC-02 | UI interaction         | Toggle Direto/Indireto tabs, verify correct data display                     |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
