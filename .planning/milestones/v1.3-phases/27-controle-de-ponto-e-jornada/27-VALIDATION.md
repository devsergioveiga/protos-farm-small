---
phase: 27
slug: controle-de-ponto-e-jornada
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-24
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------- |
| **Framework**          | jest 29.x (backend), vitest (frontend)                                                |
| **Config file**        | `apps/backend/jest.config.ts`, `apps/frontend/vitest.config.ts`                       |
| **Quick run command**  | `pnpm --filter @protos-farm/backend test -- --testPathPattern=time`                   |
| **Full suite command** | `pnpm --filter @protos-farm/backend test && pnpm --filter @protos-farm/frontend test` |
| **Estimated runtime**  | ~45 seconds                                                                           |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @protos-farm/backend test -- --testPathPattern=time`
- **After every plan wave:** Run `pnpm --filter @protos-farm/backend test && pnpm --filter @protos-farm/frontend test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                                                                | Verify Strategy                                           | Status     |
| -------- | ---- | ---- | ----------- | --------- | -------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------- |
| 27-01-01 | 01   | 1    | PONTO-01    | schema    | `cd apps/backend && npx prisma validate && npx prisma generate`                  | Schema validation + Prisma generate                       | ⬜ pending |
| 27-01-02 | 01   | 1    | PONTO-01    | compile   | `cd apps/backend && npx tsc --noEmit --pretty 2>&1 \| head -30`                  | TypeScript compilation of 4 type files                    | ⬜ pending |
| 27-02-01 | 02   | 1    | PONTO-03    | unit/tdd  | `pnpm --filter @protos-farm/backend test -- --testPathPattern=time-calculations` | TDD: RED-GREEN-REFACTOR for pure calculation functions    | ⬜ pending |
| 27-03-01 | 03   | 2    | PONTO-01,02 | unit/tdd  | `pnpm --filter @protos-farm/backend test -- --testPathPattern=time-entries`      | TDD: routes spec with 7+ test cases                       | ⬜ pending |
| 27-03-02 | 03   | 2    | PONTO-03,04 | unit/tdd  | `pnpm --filter @protos-farm/backend test -- --testPathPattern=timesheets`        | TDD: routes spec with 7+ test cases                       | ⬜ pending |
| 27-04-01 | 04   | 3    | PONTO-01,02 | compile   | `cd apps/frontend && npx tsc --noEmit 2>&1 \| head -20`                          | TypeScript compilation of AttendancePage + TeamLinkingTab | ⬜ pending |
| 27-05-01 | 05   | 2    | PONTO-01    | compile   | `cd apps/mobile && npx tsc --noEmit 2>&1 \| head -20`                            | TypeScript compilation of mobile time-punch               | ⬜ pending |
| 27-06-01 | 06   | 4    | PONTO-04    | compile   | `cd apps/frontend && npx tsc --noEmit 2>&1 \| head -20`                          | TypeScript compilation of TimesheetPage                   | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

Wave 0 stub test files are NOT needed for this phase because:

- Plan 01 uses schema validation (`prisma validate`) and TypeScript compilation as verification — no test file required
- Plan 02 is a TDD plan — test file is created as part of the RED phase within the plan itself
- Plan 03 tasks have `tdd="true"` — spec files are created as part of each task's RED-GREEN cycle
- Plans 04, 05, 06 use TypeScript compilation as verification — no test file required

The `date-holidays@^3.26.11` dependency is installed by Plan 01 Task 1.

---

## Manual-Only Verifications

| Behavior                      | Requirement | Why Manual                                     | Test Instructions                               |
| ----------------------------- | ----------- | ---------------------------------------------- | ----------------------------------------------- |
| Mobile geolocation punch      | PONTO-01    | Requires device GPS + PostGIS validation       | Punch via Expo app within/outside farm boundary |
| Offline sync after reconnect  | PONTO-01    | Requires network state simulation on device    | Toggle airplane mode, punch, reconnect          |
| PDF export of timesheet       | PONTO-04    | Visual layout verification                     | Export PDF, verify layout matches template      |
| Team bulk activity linking UI | PONTO-02    | Visual verification of team select + bulk form | Select team, fill form, verify response summary |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 strategy documented (TDD plans self-scaffold, others use compilation)
- [x] No watch-mode flags
- [x] Feedback latency < 45s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
