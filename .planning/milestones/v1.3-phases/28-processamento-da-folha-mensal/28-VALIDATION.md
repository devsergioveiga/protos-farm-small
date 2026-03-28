---
phase: 28
slug: processamento-da-folha-mensal
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Jest 29.7 + @swc/jest                                                                                                            |
| **Config file**        | apps/backend/jest.config.js                                                                                                      |
| **Quick run command**  | `cd apps/backend && pnpm jest --testPathPattern="payroll-runs\|salary-advances\|payroll-calculation\|payroll-pdf" --no-coverage` |
| **Full suite command** | `cd apps/backend && pnpm test`                                                                                                   |
| **Estimated runtime**  | ~45 seconds                                                                                                                      |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/backend && pnpm jest --testPathPattern="payroll-runs|salary-advances|payroll-calculation|payroll-pdf" --no-coverage`
- **After every plan wave:** Run `cd apps/backend && pnpm test --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type     | Automated Command                       | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ------------- | --------------------------------------- | ----------- | ---------- |
| 28-01-01 | 01   | 1    | FOLHA-02    | unit          | `pnpm jest payroll-runs.routes.spec`    | ❌ W0       | ⬜ pending |
| 28-01-02 | 01   | 1    | FOLHA-02    | unit          | `pnpm jest payroll-calculation.spec`    | ❌ W0       | ⬜ pending |
| 28-02-01 | 02   | 1    | FOLHA-02    | unit          | `pnpm jest payroll-runs.routes.spec`    | ❌ W0       | ⬜ pending |
| 28-02-02 | 02   | 1    | FOLHA-03    | unit          | `pnpm jest salary-advances.routes.spec` | ❌ W0       | ⬜ pending |
| 28-03-01 | 03   | 2    | FOLHA-04    | unit (buffer) | `pnpm jest payroll-pdf.spec`            | ❌ W0       | ⬜ pending |
| 28-03-02 | 03   | 2    | FOLHA-05    | unit          | `pnpm jest payroll-calculation.spec`    | ❌ W0       | ⬜ pending |
| 28-04-01 | 04   | 3    | FOLHA-04    | visual        | manual                                  | N/A         | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/payroll-runs/payroll-runs.routes.spec.ts` — stubs for FOLHA-02 routes
- [ ] `apps/backend/src/modules/payroll-runs/payroll-calculation.service.spec.ts` — calculation unit tests
- [ ] `apps/backend/src/modules/payroll-runs/payroll-pdf.service.spec.ts` — PDF buffer tests
- [ ] `apps/backend/src/modules/salary-advances/salary-advances.routes.spec.ts` — stubs for FOLHA-03 routes

_Existing infrastructure (Jest + @swc/jest) covers framework needs._

---

## Manual-Only Verifications

| Behavior                                           | Requirement | Why Manual                         | Test Instructions                                                                    |
| -------------------------------------------------- | ----------- | ---------------------------------- | ------------------------------------------------------------------------------------ |
| Holerite PDF layout matches classic tabular format | FOLHA-04    | Visual inspection of PDF rendering | Generate payslip PDF, open in viewer, verify proventos/descontos/bases/totais layout |
| Email delivery with PDF attachment                 | FOLHA-04    | Requires email infrastructure      | Process folha, verify email sent with correct attachment via mail log                |
| Wizard multi-step UX flow                          | FOLHA-02    | Frontend interaction flow          | Walk through 4-step wizard, verify step transitions and validation                   |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
