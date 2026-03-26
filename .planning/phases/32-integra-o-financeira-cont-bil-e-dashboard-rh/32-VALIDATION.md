---
phase: 32
slug: integra-o-financeira-cont-bil-e-dashboard-rh
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| **Quick run command** | `cd apps/backend && npx jest --testPathPattern="payroll-integration\|accounting-entries\|hr-dashboard" --no-coverage` |
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

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 1 | INTEGR-01 | unit | `npx jest --testPathPattern="payroll-integration"` | ❌ W0 | ⬜ pending |
| 32-01-02 | 01 | 1 | INTEGR-01 | unit | `npx jest --testPathPattern="payroll-integration"` | ❌ W0 | ⬜ pending |
| 32-02-01 | 02 | 1 | INTEGR-02 | unit | `npx jest --testPathPattern="accounting-entries"` | ❌ W0 | ⬜ pending |
| 32-02-02 | 02 | 1 | INTEGR-02 | unit | `npx jest --testPathPattern="accounting-entries"` | ❌ W0 | ⬜ pending |
| 32-03-01 | 03 | 2 | INTEGR-01,02 | integration | `npx vitest run --reporter=verbose src/pages/payroll-integration` | ❌ W0 | ⬜ pending |
| 32-04-01 | 04 | 2 | INTEGR-03 | unit+integration | `npx jest --testPathPattern="hr-dashboard" && npx vitest run src/pages/hr-dashboard` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/payroll-integration/__tests__/payroll-integration.service.spec.ts` — stubs for INTEGR-01
- [ ] `apps/backend/src/modules/accounting-entries/__tests__/accounting-entries.service.spec.ts` — stubs for INTEGR-02
- [ ] `apps/backend/src/modules/hr-dashboard/__tests__/hr-dashboard.service.spec.ts` — stubs for INTEGR-03

*Existing test infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard chart rendering (pie, line) | INTEGR-03 | Visual verification of recharts output | Open /hr-dashboard, verify charts render with mock data |
| Tela de revisão pré-confirmação UX | INTEGR-01 | User interaction flow | Close payroll run, verify review modal shows CP breakdown before confirm |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
