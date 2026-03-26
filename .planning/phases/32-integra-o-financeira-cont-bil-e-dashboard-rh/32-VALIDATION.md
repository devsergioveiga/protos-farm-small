---
phase: 32
slug: integra-o-financeira-cont-bil-e-dashboard-rh
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-26
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (backend), vitest (frontend) |
| **Config file** | `apps/backend/jest.config.ts`, `apps/frontend/vitest.config.ts` |
| **Quick run command** | `cd apps/backend && npx jest --testPathPattern="payroll-runs\|accounting-entries\|hr-dashboard" --no-coverage` |
| **Full suite command** | `cd apps/backend && npx jest --no-coverage && cd ../frontend && npx vitest run` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 32-01-01 | 01 | 1 | INTEGR-01 | unit | `cd apps/backend && npx jest --testPathPattern="payroll-runs" --no-coverage` | ⬜ pending |
| 32-01-02 | 01 | 1 | INTEGR-01 | unit | `cd apps/backend && npx jest --testPathPattern="payroll-runs" --no-coverage` | ⬜ pending |
| 32-03-01 | 03 | 1 | INTEGR-03 | unit | `cd apps/backend && npx tsc --noEmit --project tsconfig.json` | ⬜ pending |
| 32-03-02 | 03 | 1 | INTEGR-03 | unit | `cd apps/backend && npx jest --testPathPattern="hr-dashboard" --no-coverage` | ⬜ pending |
| 32-02-01 | 02 | 2 | INTEGR-02 | unit | `cd apps/backend && npx prisma db push --accept-data-loss && npx tsc --noEmit --project tsconfig.json` | ⬜ pending |
| 32-02-02 | 02 | 2 | INTEGR-02 | unit+integration | `cd apps/backend && npx jest --testPathPattern="accounting-entries" --no-coverage` | ⬜ pending |
| 32-04-01 | 04 | 3 | INTEGR-01,02 | type-check | `cd apps/frontend && npx tsc --noEmit` | ⬜ pending |
| 32-04-02 | 04 | 3 | INTEGR-01,02 | type-check | `cd apps/frontend && npx tsc --noEmit` | ⬜ pending |
| 32-05-01 | 05 | 3 | INTEGR-03 | type-check | `cd apps/frontend && npx tsc --noEmit` | ⬜ pending |
| 32-05-02 | 05 | 3 | INTEGR-03 | type-check | `cd apps/frontend && npx tsc --noEmit` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Tests are created inline within each plan's tasks. No separate Wave 0 scaffolds needed:

- Plan 01 Task 2: creates/extends `payroll-runs.routes.spec.ts` (existing file)
- Plan 02 Task 2: creates `accounting-entries.routes.spec.ts` (new file)
- Plan 03 Task 2: creates `hr-dashboard.routes.spec.ts` (new file)

*Existing test infrastructure covers framework needs. wave_0_complete: true.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard chart rendering (pie, bar) | INTEGR-03 | Visual verification of recharts output | Open /hr-dashboard, verify charts render with real data |
| Tela de revisao pre-confirmacao UX | INTEGR-01 | User interaction flow | Close payroll run, verify review modal shows CP breakdown + taxGuideItems before confirm |
| Estorno confirmation dialog | INTEGR-01 | UX verification | Open completed run detail, click Estornar, verify ConfirmModal appears with danger variant |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covered by inline test creation (no separate scaffold needed)
- [x] No watch-mode flags
- [x] Feedback latency < 45s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
