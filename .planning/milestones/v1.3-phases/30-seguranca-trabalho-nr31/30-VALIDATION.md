---
phase: 30
slug: seguranca-trabalho-nr31
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (backend), vitest (frontend) |
| **Config file** | `apps/backend/jest.config.ts`, `apps/frontend/vitest.config.ts` |
| **Quick run command** | `cd apps/backend && npx jest --testPathPattern="epi\|training\|medical\|safety" --no-coverage` |
| **Full suite command** | `cd apps/backend && npx jest --no-coverage` |
| **Estimated runtime** | ~30 seconds (phase tests only) |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After each plan completes:** Run full suite command
- **After wave completes:** Manual smoke test of key flows

---

## Validation Architecture

### Critical Paths (must have tests)

1. **EPI delivery with stock deduction** — create EpiDelivery → verify StockOutput created → verify StockBalance decremented
2. **EPI compliance check** — employee with Position → PositionEpiRequirement exists → EpiDelivery present/absent → compliance status correct
3. **Training record with expiry calculation** — create TrainingRecord + EmployeeTrainingRecord → verify expiresAt = date + validityMonths
4. **Training compliance check** — employee with Position → PositionTrainingRequirement exists → EmployeeTrainingRecord valid/expired → compliance correct
5. **ASO creation with next exam date** — create MedicalExam → verify nextExamDate calculated from Position.asoPeriodicityMonths
6. **ASO vencimento alerts** — ASOs with nextExamDate in 30d/15d/past → correct alert levels
7. **Safety compliance dashboard aggregation** — merge EPI + training + ASO compliance per employee → correct totals

### Edge Cases (should have tests)

1. Employee with no Position (no requirements to check)
2. EPI delivery when stock insufficient (should fail gracefully)
3. Training for employee who already has valid training of same type
4. ASO periodic when Position has no asoPeriodicityMonths (default 12)
5. CA expired but delivery recent (should flag CA vencido)
6. System TrainingType (isSystem=true) cannot be deleted/edited

### PDF Generation (integration tests)

1. EPI ficha PDF — verify buffer returned, content-type application/pdf
2. Training certificate PDF — verify buffer returned
3. Safety compliance report PDF — verify buffer returned

---

## Dimension 8 Compliance

Plans MUST include test tasks that cover all critical paths above. Each test task must reference this validation strategy.
