---
phase: 33
slug: wire-employee-data-safety-pages
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + @testing-library/react |
| **Config file** | `apps/frontend/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @protos-farm/frontend test` |
| **Full suite command** | `pnpm --filter @protos-farm/frontend test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @protos-farm/frontend test`
- **After every plan wave:** Run `pnpm --filter @protos-farm/frontend test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 33-01-01 | 01 | 1 | SEGUR-02, SEGUR-03 | unit | `pnpm --filter @protos-farm/frontend test` | ❌ W0 | ⬜ pending |
| 33-01-02 | 01 | 1 | SEGUR-02 | unit | `pnpm --filter @protos-farm/frontend test` | ❌ W0 | ⬜ pending |
| 33-01-03 | 01 | 1 | SEGUR-03 | unit | `pnpm --filter @protos-farm/frontend test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/frontend/src/pages/TrainingRecordsPage.spec.tsx` — stubs for SEGUR-02 (real employees in training modal)
- [ ] `apps/frontend/src/pages/MedicalExamsPage.spec.tsx` — stubs for SEGUR-03 (real employees in medical exam modal, asoPeriodicityMonths)

*Existing infrastructure covers all phase requirements. Only test files are missing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| E2E training record creation flow | SEGUR-02 | Full modal flow with real API | Open TrainingRecordsPage → Registrar → Step 2 → verify employees appear → select → save |
| E2E ASO exam creation flow | SEGUR-03 | Full modal flow with real API | Open MedicalExamsPage → Registrar → verify employees in combobox → select → fill form → save |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
