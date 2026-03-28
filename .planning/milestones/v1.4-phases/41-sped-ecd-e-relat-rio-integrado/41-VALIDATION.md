---
phase: 41
slug: sped-ecd-e-relat-rio-integrado
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| **Framework**          | jest 29.x                                                                                   |
| **Config file**        | apps/backend/jest.config.ts                                                                 |
| **Quick run command**  | `cd apps/backend && npx jest --testPathPattern sped-ecd --no-coverage`                      |
| **Full suite command** | `cd apps/backend && npx jest --testPathPattern "sped-ecd\|integrated-report" --no-coverage` |
| **Estimated runtime**  | ~15 seconds                                                                                 |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/backend && npx jest --testPathPattern sped-ecd --no-coverage`
- **After every plan wave:** Run `cd apps/backend && npx jest --testPathPattern "sped-ecd|integrated-report" --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                                | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | ------------------------------------------------ | ----------- | ---------- |
| 41-01-01 | 01   | 1    | SPED-01     | unit      | `npx jest --testPathPattern sped-ecd-writer`     | ❌ W0       | ⬜ pending |
| 41-01-02 | 01   | 1    | SPED-02     | unit      | `npx jest --testPathPattern sped-ecd-validation` | ❌ W0       | ⬜ pending |
| 41-02-01 | 02   | 1    | VINC-02     | unit      | `npx jest --testPathPattern integrated-report`   | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/sped-ecd/sped-ecd.routes.spec.ts` — stubs for SPED-01, SPED-02
- [ ] `apps/backend/src/modules/integrated-report/integrated-report.routes.spec.ts` — stubs for VINC-02

_Existing test infrastructure (jest, prisma mock, supertest) covers framework needs._

---

## Manual-Only Verifications

| Behavior               | Requirement | Why Manual                                       | Test Instructions                                                                     |
| ---------------------- | ----------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| PDF visual layout      | VINC-02     | PDF rendering quality requires visual inspection | Generate PDF, open in viewer, check capa/índice/DRE/BP/DFC/notas sections             |
| SPED file PVA import   | SPED-01     | Requires external PVA software validation        | Download generated .txt, import in PVA da RFB, verify no blocking errors              |
| Frontend validation UX | SPED-02     | UI interaction flow requires browser testing     | Select FiscalYear, verify inline errors/warnings display, check download button state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
