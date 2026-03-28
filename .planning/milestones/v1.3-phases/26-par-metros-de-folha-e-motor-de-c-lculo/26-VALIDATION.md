---
phase: 26
slug: par-metros-de-folha-e-motor-de-c-lculo
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Framework**          | jest 29.x (backend) / vitest (frontend)                                                                      |
| **Config file**        | `apps/backend/jest.config.ts` / `apps/frontend/vitest.config.ts`                                             |
| **Quick run command**  | `cd apps/backend && npx jest --testPathPattern="payroll-params\|payroll-engine\|legal-tables" --no-coverage` |
| **Full suite command** | `cd apps/backend && npx jest --no-coverage`                                                                  |
| **Estimated runtime**  | ~30 seconds (quick) / ~120 seconds (full)                                                                    |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type   | Automated Command                | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ----------- | -------------------------------- | ----------- | ---------- |
| 26-01-01 | 01   | 1    | FOLHA-01    | unit        | `npx jest payroll-params`        | ❌ W0       | ⬜ pending |
| 26-01-02 | 01   | 1    | FOLHA-01    | unit        | `npx jest legal-tables`          | ❌ W0       | ⬜ pending |
| 26-02-01 | 02   | 1    | FOLHA-01    | unit        | `npx jest payroll-engine`        | ❌ W0       | ⬜ pending |
| 26-02-02 | 02   | 1    | FOLHA-01    | unit        | `npx jest payroll-engine`        | ❌ W0       | ⬜ pending |
| 26-03-01 | 03   | 2    | FOLHA-01    | integration | `npx jest payroll-params.routes` | ❌ W0       | ⬜ pending |
| 26-04-01 | 04   | 3    | FOLHA-01    | visual      | manual verification              | N/A         | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/payroll-params/*.spec.ts` — stubs for rubrica CRUD
- [ ] `apps/backend/src/modules/legal-tables/*.spec.ts` — stubs for INSS/IRRF/FGTS tables
- [ ] `apps/backend/src/modules/payroll-engine/*.spec.ts` — stubs for calculation engine

_Existing jest infrastructure covers all framework requirements._

---

## Manual-Only Verifications

| Behavior                   | Requirement | Why Manual                        | Test Instructions                                              |
| -------------------------- | ----------- | --------------------------------- | -------------------------------------------------------------- |
| Frontend rubrica config UI | FOLHA-01    | Visual layout verification        | Open /payroll-params, create rubrica, verify form fields       |
| Legal table update UX      | FOLHA-01    | Date picker + effective date flow | Update INSS table, verify new rates appear after effectiveFrom |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
