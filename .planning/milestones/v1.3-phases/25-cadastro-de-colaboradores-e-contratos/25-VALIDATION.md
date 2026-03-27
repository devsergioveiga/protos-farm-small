---
phase: 25
slug: cadastro-de-colaboradores-e-contratos
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x (backend), Vitest (frontend) |
| **Config file** | `apps/backend/jest.config.ts`, `apps/frontend/vitest.config.ts` |
| **Quick run command** | `cd apps/backend && npx jest --testPathPattern="employees\|positions\|work-schedules\|contracts\|movements" --bail` |
| **Full suite command** | `cd apps/backend && npx jest && cd ../../apps/frontend && npx vitest run` |
| **Estimated runtime** | ~45 seconds (backend), ~30 seconds (frontend) |

---

## Sampling Rate

- **After every task commit:** Run quick run command (module-scoped jest)
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 25-01-01 | 01 | 1 | COLAB-01 | unit | `npx jest --testPathPattern="employees"` | ❌ W0 | ⬜ pending |
| 25-01-02 | 01 | 1 | COLAB-02 | unit | `npx jest --testPathPattern="contracts"` | ❌ W0 | ⬜ pending |
| 25-02-01 | 02 | 1 | COLAB-03 | unit | `npx jest --testPathPattern="positions\|work-schedules\|movements"` | ❌ W0 | ⬜ pending |
| 25-03-01 | 03 | 2 | COLAB-04 | unit | `npx jest --testPathPattern="employee-import"` | ❌ W0 | ⬜ pending |
| 25-04-01 | 04 | 2 | COLAB-01,COLAB-05 | integration | `npx vitest run --reporter=verbose src/pages/Employees` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/src/modules/employees/__tests__/employee.service.spec.ts` — stubs for COLAB-01
- [ ] `apps/backend/src/modules/employees/__tests__/contract.service.spec.ts` — stubs for COLAB-02
- [ ] `apps/backend/src/modules/positions/__tests__/position.service.spec.ts` — stubs for COLAB-03
- [ ] `apps/backend/src/modules/employees/__tests__/employee-import.service.spec.ts` — stubs for COLAB-04
- [ ] Existing test infrastructure covers Jest + Vitest — no new installs needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| File upload (documents) | COLAB-01 | Requires multipart/form-data with actual file | Upload a PDF via Postman/frontend, verify saved in uploads/employees/{id}/ |
| CSV/Excel import preview | COLAB-04 | Full parse+preview requires actual file processing | Upload template CSV, verify preview table renders correctly |
| Salary evolution chart | COLAB-05 | Visual Recharts rendering | Navigate to employee detail, verify line chart renders with tooltip data |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
