---
phase: 12
slug: kanban-dashboard-e-notifica-es
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Jest 29 (backend) + Vitest (frontend)                                                                                       |
| **Config file**        | apps/backend/jest.config.js / apps/frontend/vite.config.ts                                                                  |
| **Quick run command**  | `pnpm --filter @protos-farm/backend test -- --testPathPattern="purchasing-kanban\|purchasing-dashboard\|notification-pref"` |
| **Full suite command** | `pnpm --filter @protos-farm/backend test`                                                                                   |
| **Estimated runtime**  | ~30 seconds                                                                                                                 |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @protos-farm/backend test -- --testPathPattern="purchasing-kanban\|purchasing-dashboard\|notification-pref" --passWithNoTests`
- **After every plan wave:** Run `pnpm --filter @protos-farm/backend test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type   | Automated Command                                                                     | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ----------- | ------------------------------------------------------------------------------------- | ----------- | ---------- |
| 12-01-01 | 01   | 1    | DASH-01     | integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern="purchasing-kanban"`    | ❌ W0       | ⬜ pending |
| 12-01-02 | 01   | 1    | DASH-01     | integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern="purchasing-kanban"`    | ❌ W0       | ⬜ pending |
| 12-02-01 | 02   | 1    | DASH-02     | integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern="purchasing-dashboard"` | ❌ W0       | ⬜ pending |
| 12-02-02 | 02   | 1    | DASH-02     | unit        | `pnpm --filter @protos-farm/backend test -- --testPathPattern="purchasing-dashboard"` | ❌ W0       | ⬜ pending |
| 12-03-01 | 03   | 1    | DASH-03     | integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern="notification-pref"`    | ❌ W0       | ⬜ pending |
| 12-03-02 | 03   | 1    | DASH-03     | unit        | `pnpm --filter @protos-farm/backend test -- --testPathPattern="notification-pref"`    | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/purchasing-kanban/purchasing-kanban.routes.spec.ts` — stubs for DASH-01
- [ ] `apps/backend/src/modules/purchasing-dashboard/purchasing-dashboard.routes.spec.ts` — stubs for DASH-02
- [ ] `apps/backend/src/modules/notification-preferences/notification-preferences.routes.spec.ts` — stubs for DASH-03
- [ ] Migration for `NotificationPreference` model — required before preference tests
- [ ] `@dnd-kit/core` + `@dnd-kit/sortable` install — before KanbanBoard.tsx
- [ ] `node-cron` install — before digest.cron.ts

---

## Manual-Only Verifications

| Behavior                                      | Requirement | Why Manual                                        | Test Instructions                                                                                                     |
| --------------------------------------------- | ----------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Drag & drop moves card between kanban columns | DASH-01     | Browser DnD interaction cannot be tested via Jest | 1. Open /purchasing/kanban 2. Drag RC card from "Pendente" to "Aprovada" 3. Verify transition executes and card moves |
| Dashboard charts render correctly with data   | DASH-02     | Recharts visual rendering requires browser        | 1. Open /purchasing/dashboard 2. Verify KPI cards show values 3. Verify charts render with period data                |
| Push notification delivery to browser         | DASH-03     | Requires real browser notification API            | 1. Trigger approval event 2. Verify browser notification appears                                                      |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
