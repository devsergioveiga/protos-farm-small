---
phase: 29
slug: f-rias-afastamentos-rescis-o-e-provis-es
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-25
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | jest 29.x (backend), vitest (frontend)                                                                                                                                       |
| **Config file**        | `apps/backend/jest.config.ts`, `apps/frontend/vitest.config.ts`                                                                                                              |
| **Quick run command**  | `cd apps/backend && npx jest --testPathPattern="vacation-schedules\|employee-absences\|employee-terminations\|termination-calculation\|payroll-provisions" --no-coverage -q` |
| **Full suite command** | `cd apps/backend && npx jest --no-coverage -q`                                                                                                                               |
| **Estimated runtime**  | ~30 seconds                                                                                                                                                                  |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement          | Test Type   | Automated Command                                                                                         | File Exists | Status  |
| -------- | ---- | ---- | -------------------- | ----------- | --------------------------------------------------------------------------------------------------------- | ----------- | ------- |
| 29-01-T1 | 01   | 1    | FERIAS-01, FERIAS-02 | schema      | `cd apps/backend && npx prisma validate && npx prisma generate`                                           | N/A         | pending |
| 29-01-T2 | 01   | 1    | FERIAS-01            | integration | `cd apps/backend && npx jest --testPathPattern="vacation-schedules" --no-coverage -q`                     | W0          | pending |
| 29-01-T3 | 01   | 1    | FERIAS-02            | integration | `cd apps/backend && npx jest --testPathPattern="employee-absences" --no-coverage -q`                      | W0          | pending |
| 29-02-T1 | 02   | 2    | FERIAS-03            | unit        | `cd apps/backend && npx jest --testPathPattern="termination-calculation" --no-coverage -q`                | W0          | pending |
| 29-02-T2 | 02   | 2    | FERIAS-03            | integration | `cd apps/backend && npx jest --testPathPattern="employee-terminations" --no-coverage -q`                  | W0          | pending |
| 29-03-T1 | 03   | 2    | FERIAS-04            | integration | `cd apps/backend && npx jest --testPathPattern="payroll-provisions" --no-coverage -q`                     | W0          | pending |
| 29-03-T2 | 03   | 2    | FERIAS-04            | compile     | `cd apps/backend && npx jest --testPathPattern="payroll-provisions" --no-coverage -q && npx tsc --noEmit` | N/A         | pending |
| 29-04-T1 | 04   | 3    | FERIAS-01, FERIAS-02 | compile     | `cd apps/frontend && npx tsc --noEmit`                                                                    | N/A         | pending |
| 29-04-T2 | 04   | 3    | FERIAS-01            | compile     | `cd apps/frontend && npx tsc --noEmit`                                                                    | N/A         | pending |
| 29-04-T3 | 04   | 3    | FERIAS-02            | compile     | `cd apps/frontend && npx tsc --noEmit`                                                                    | N/A         | pending |
| 29-05-T1 | 05   | 4    | FERIAS-03            | compile     | `cd apps/frontend && npx tsc --noEmit`                                                                    | N/A         | pending |
| 29-05-T2 | 05   | 4    | FERIAS-04            | compile     | `cd apps/frontend && npx tsc --noEmit`                                                                    | N/A         | pending |
| 29-05-T3 | 05   | 4    | all                  | manual      | Visual verification checkpoint                                                                            | N/A         | pending |

_Status: pending / green / red / flaky_

---

## Wave 0 Requirements

- [ ] Test files created alongside modules during plan execution
- [ ] Shared fixtures for employee + payroll test data

_Existing infrastructure covers test framework — only module-specific test files needed._

---

## Manual-Only Verifications

| Behavior                                      | Requirement | Why Manual               | Test Instructions                                           |
| --------------------------------------------- | ----------- | ------------------------ | ----------------------------------------------------------- |
| Vacation calendar visual with safra conflicts | FERIAS-01   | Visual UI verification   | Open vacation scheduling, verify calendar renders conflicts |
| TRCT PDF layout and content                   | FERIAS-03   | PDF visual inspection    | Generate TRCT, verify legal format compliance               |
| Provision report with CC breakdown            | FERIAS-04   | Report visual inspection | Run monthly provision, verify rateio display                |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
