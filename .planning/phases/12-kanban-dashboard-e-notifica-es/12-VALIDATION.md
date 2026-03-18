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

| Property               | Value                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| **Framework**          | jest 29.x (backend), vitest (frontend)                                                    |
| **Config file**        | `apps/backend/jest.config.ts`, `apps/frontend/vitest.config.ts`                           |
| **Quick run command**  | `pnpm --filter @protos-farm/backend exec jest --testPathPattern="{module}" --no-coverage` |
| **Full suite command** | `pnpm test`                                                                               |
| **Estimated runtime**  | ~120 seconds                                                                              |

---

## Sampling Rate

- **After every task commit:** Run quick command for affected module
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type | Automated Command                                 | File Exists | Status     |
| -------- | ---- | ---- | ----------- | --------- | ------------------------------------------------- | ----------- | ---------- |
| 12-01-01 | 01   | 1    | DASH-01     | unit      | `jest --testPathPattern=purchase-kanban`          | ❌ W0       | ⬜ pending |
| 12-01-02 | 01   | 1    | DASH-01     | unit      | `jest --testPathPattern=purchase-kanban`          | ❌ W0       | ⬜ pending |
| 12-02-01 | 02   | 1    | DASH-02     | unit      | `jest --testPathPattern=purchase-dashboard`       | ❌ W0       | ⬜ pending |
| 12-02-02 | 02   | 1    | DASH-02     | unit      | `jest --testPathPattern=purchase-dashboard`       | ❌ W0       | ⬜ pending |
| 12-03-01 | 03   | 1    | DASH-03     | unit      | `jest --testPathPattern=notification-preferences` | ❌ W0       | ⬜ pending |
| 12-03-02 | 03   | 1    | DASH-03     | unit      | `jest --testPathPattern=notification-preferences` | ❌ W0       | ⬜ pending |
| 12-04-01 | 04   | 2    | DASH-01     | component | `vitest run src/pages/PurchaseKanbanPage`         | ❌ W0       | ⬜ pending |
| 12-05-01 | 05   | 2    | DASH-02     | component | `vitest run src/pages/PurchaseDashboardPage`      | ❌ W0       | ⬜ pending |
| 12-06-01 | 06   | 2    | DASH-03     | component | `vitest run src/components/notifications`         | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] Backend test stubs for purchase-kanban, purchase-dashboard, notification-preferences modules
- [ ] Frontend test stubs for KanbanPage, DashboardPage, NotificationPreferences components
- [ ] @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities installed in frontend

_Existing test infrastructure (jest, vitest, testing-library) covers framework requirements._

---

## Manual-Only Verifications

| Behavior                    | Requirement | Why Manual                                  | Test Instructions                                          |
| --------------------------- | ----------- | ------------------------------------------- | ---------------------------------------------------------- |
| Drag & drop visual feedback | DASH-01     | CSS animation/overlay not testable in jsdom | Drag card between columns, verify visual indicator appears |
| Chart rendering             | DASH-02     | Recharts renders SVG, hard to assert layout | Load dashboard, verify charts display with data            |
| Push notification delivery  | DASH-03     | Requires real Expo push service             | Trigger event, verify push received on device              |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
