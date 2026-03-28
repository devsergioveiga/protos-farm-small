---
phase: 37
slug: regras-e-lan-amentos-autom-ticos
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-27
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                      |
| ---------------------- | -------------------------------------------------------------------------- |
| **Framework**          | jest 29.x (backend) / vitest (frontend)                                    |
| **Config file**        | `apps/backend/jest.config.ts` / `apps/frontend/vitest.config.ts`           |
| **Quick run command**  | `cd apps/backend && npx jest --testPathPattern=auto-posting --no-coverage` |
| **Full suite command** | `cd apps/backend && npx jest --no-coverage`                                |
| **Estimated runtime**  | ~45 seconds                                                                |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/backend && npx jest --testPathPattern=auto-posting --no-coverage`
- **After every plan wave:** Run `cd apps/backend && npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type   | Automated Command                                            | File Exists         | Status     |
| -------- | ---- | ---- | ----------- | ----------- | ------------------------------------------------------------ | ------------------- | ---------- |
| 37-01-00 | 01   | 1    | LANC-02     | scaffold    | `npx jest --testPathPattern=auto-posting.service.spec`       | Wave 0 task         | ⬜ pending |
| 37-01-01 | 01   | 1    | LANC-02     | unit        | `npx jest --testPathPattern=auto-posting.service.spec`       | Created by 37-01-00 | ⬜ pending |
| 37-01-02 | 01   | 1    | LANC-06     | unit        | `npx jest --testPathPattern=auto-posting`                    | Created by 37-01-02 | ⬜ pending |
| 37-02-01 | 02   | 2    | LANC-01     | integration | `npx tsc --noEmit`                                           | N/A (wiring)        | ⬜ pending |
| 37-02-02 | 02   | 2    | LANC-01     | migration   | `npx jest --no-coverage`                                     | N/A (deletion)      | ⬜ pending |
| 37-02-03 | 02   | 2    | LANC-02     | integration | `npx jest --testPathPattern=chart-of-accounts\|auto-posting` | N/A (seed wiring)   | ⬜ pending |
| 37-03-01 | 03   | 2    | LANC-02     | frontend    | vitest (if applicable)                                       | N/A (frontend)      | ⬜ pending |

_Status: pending / green / red / flaky_

---

## Wave 0 Requirements

- [x] `apps/backend/src/modules/auto-posting/auto-posting.service.spec.ts` — 8 todo stubs created by Plan 01 Task 0
- [ ] `apps/backend/src/modules/auto-posting/auto-posting.routes.spec.ts` — created by Plan 01 Task 2
- [ ] Test fixtures for AccountingRule, PendingJournalPosting

_Wave 0 task (Plan 01, Task 0) creates the service spec stubs before Task 1 implements TDD. Routes spec is created inline in Task 2._

_Existing infrastructure covers test framework — no new installs needed._

---

## Manual-Only Verifications

| Behavior                     | Requirement | Why Manual           | Test Instructions                                  |
| ---------------------------- | ----------- | -------------------- | -------------------------------------------------- |
| Tab Pendencias badges render | LANC-06     | Frontend visual      | Navigate to JournalEntriesPage, check badge counts |
| Tab Regras modal preview     | LANC-02     | Frontend interaction | Edit a rule, click Preview, verify example entry   |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Plan 01 Task 0 creates service spec)
- [x] No watch-mode flags
- [x] Feedback latency < 45s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** revised (checker feedback addressed)
