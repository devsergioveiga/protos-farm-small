---
phase: 7
slug: cadastro-de-fornecedores
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                   |
| ---------------------- | ----------------------------------------------------------------------- |
| **Framework**          | Jest (backend) + Vitest (frontend)                                      |
| **Config file**        | `apps/backend/jest.config.js` / `apps/frontend/vite.config.ts`          |
| **Quick run command**  | `cd apps/backend && npx jest --testPathPattern=suppliers --no-coverage` |
| **Full suite command** | `cd apps/backend && npx jest --no-coverage`                             |
| **Estimated runtime**  | ~30 seconds                                                             |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/backend && npx jest --testPathPattern=suppliers --no-coverage`
- **After every plan wave:** Run `cd apps/backend && npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type      | Automated Command                                          | File Exists | Status     |
| -------- | ---- | ---- | ----------- | -------------- | ---------------------------------------------------------- | ----------- | ---------- |
| 07-01-01 | 01   | 1    | FORN-01     | unit (routes)  | `npx jest suppliers.routes.spec.ts -t "should create"`     | ❌ W0       | ⬜ pending |
| 07-01-02 | 01   | 1    | FORN-01     | unit (routes)  | `npx jest suppliers.routes.spec.ts -t "duplicate"`         | ❌ W0       | ⬜ pending |
| 07-01-03 | 01   | 1    | FORN-01     | unit (routes)  | `npx jest suppliers.routes.spec.ts -t "should update"`     | ❌ W0       | ⬜ pending |
| 07-01-04 | 01   | 1    | FORN-01     | unit (routes)  | `npx jest suppliers.routes.spec.ts -t "should add rating"` | ❌ W0       | ⬜ pending |
| 07-02-01 | 02   | 1    | FORN-02     | unit (routes)  | `npx jest suppliers.routes.spec.ts -t "preview"`           | ❌ W0       | ⬜ pending |
| 07-02-02 | 02   | 1    | FORN-02     | unit (routes)  | `npx jest suppliers.routes.spec.ts -t "execute.*skip"`     | ❌ W0       | ⬜ pending |
| 07-02-03 | 02   | 2    | FORN-02     | unit (routes)  | `npx jest suppliers.routes.spec.ts -t "csv"`               | ❌ W0       | ⬜ pending |
| 07-02-04 | 02   | 2    | FORN-02     | unit (routes)  | `npx jest suppliers.routes.spec.ts -t "pdf"`               | ❌ W0       | ⬜ pending |
| 07-02-05 | 02   | 1    | FORN-02     | unit (parser)  | `npx jest supplier-file-parser.spec.ts`                    | ❌ W0       | ⬜ pending |
| 07-03-01 | 03   | 1    | FORN-03     | unit (routes)  | `npx jest suppliers.routes.spec.ts -t "top3"`              | ❌ W0       | ⬜ pending |
| 07-03-02 | 03   | 1    | FORN-03     | unit (service) | `npx jest suppliers.service.spec.ts -t "average"`          | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/suppliers/suppliers.routes.spec.ts` — stubs for FORN-01, FORN-02, FORN-03
- [ ] `apps/backend/src/modules/suppliers/supplier-file-parser.spec.ts` — covers import parsing
- [ ] `apps/backend/src/modules/suppliers/suppliers.service.spec.ts` — covers rating average

_Existing infrastructure covers framework install — Jest already configured at `apps/backend/jest.config.js`._

---

## Manual-Only Verifications

| Behavior                     | Requirement | Why Manual               | Test Instructions                                                   |
| ---------------------------- | ----------- | ------------------------ | ------------------------------------------------------------------- |
| PDF export renders correctly | FORN-02     | Visual layout inspection | Download PDF, verify header/columns/formatting                      |
| Frontend modal UX            | FORN-01     | UI interaction           | Open supplier form, verify fields, validation messages, submit flow |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
