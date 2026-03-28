---
phase: 36
slug: lan-amentos-manuais-raz-o-e-saldo-de-abertura
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| **Framework**          | jest 29.x                                                                                                |
| **Config file**        | `apps/backend/jest.config.ts`                                                                            |
| **Quick run command**  | `cd apps/backend && npx jest --testPathPattern="journal-entries\|opening-balance\|ledger" --no-coverage` |
| **Full suite command** | `cd apps/backend && npx jest --no-coverage`                                                              |
| **Estimated runtime**  | ~30 seconds                                                                                              |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/backend && npx jest --testPathPattern="journal-entries\|opening-balance\|ledger" --no-coverage`
- **After every plan wave:** Run `cd apps/backend && npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command          | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | -------------------------- | ----------- | ---------- |
| 36-01-01 | 01   | 1    | LANC-03     | unit      | `npx jest journal-entries` | ❌ W0       | ⬜ pending |
| 36-01-02 | 01   | 1    | LANC-04     | unit      | `npx jest journal-entries` | ❌ W0       | ⬜ pending |
| 36-02-01 | 02   | 1    | LANC-05     | unit      | `npx jest opening-balance` | ❌ W0       | ⬜ pending |
| 36-03-01 | 03   | 2    | RAZAO-01    | unit      | `npx jest ledger`          | ❌ W0       | ⬜ pending |
| 36-03-02 | 03   | 2    | RAZAO-02    | unit      | `npx jest ledger`          | ❌ W0       | ⬜ pending |
| 36-03-03 | 03   | 2    | RAZAO-03    | unit      | `npx jest ledger`          | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `src/modules/journal-entries/__tests__/journal-entries.service.spec.ts` — stubs for LANC-03, LANC-04
- [ ] `src/modules/opening-balance/__tests__/opening-balance.service.spec.ts` — stubs for LANC-05
- [ ] `src/modules/ledger/__tests__/ledger.service.spec.ts` — stubs for RAZAO-01, RAZAO-02, RAZAO-03

_Existing infrastructure covers test framework — only test file stubs needed._

---

## Manual-Only Verifications

| Behavior                              | Requirement | Why Manual     | Test Instructions                                   |
| ------------------------------------- | ----------- | -------------- | --------------------------------------------------- |
| Frontend multi-line debit/credit form | LANC-03     | UI interaction | Open modal, add 3+ lines, verify balance validation |
| Opening balance wizard UI             | LANC-05     | UI wizard flow | Open wizard, verify pre-populated values, submit    |
| Razão drill-down to journal entry     | RAZAO-01    | UI navigation  | Click on ledger row, verify original entry opens    |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
