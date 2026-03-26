---
phase: 26-par-metros-de-folha-e-motor-de-c-lculo
plan: "02"
subsystem: payroll-engine
tags: [tdd, payroll, inss, irrf, fgts, decimal, pure-functions]
dependency_graph:
  requires: []
  provides:
    - payroll-engine.service (calculateINSS, calculateIRRF, calculateFGTS, calculateSalaryFamily, calculateRuralNightPremium, calculateRuralUtilityDeductions, evaluateFormula)
    - payroll-engine.types (all engine type interfaces)
  affects:
    - Future payroll run processing (downstream consumer of these functions)
    - 13th salary, vacation pay, termination calculations
tech_stack:
  added:
    - expr-eval@^2.0.2 (safe mathematical expression evaluation for custom rubrica formulas)
  patterns:
    - TDD (RED-GREEN): types+spec first, then implementation
    - Pure functions: no DB access, no side effects
    - Decimal.js throughout: no floating-point arithmetic
    - Progressive bracket accumulation with upTo-boundary approach
    - Two-step IRRF: progressive table + 2026 redutor (Lei 15.079/2024)
key_files:
  created:
    - apps/backend/src/modules/payroll-engine/payroll-engine.types.ts
    - apps/backend/src/modules/payroll-engine/payroll-engine.spec.ts
    - apps/backend/src/modules/payroll-engine/payroll-engine.service.ts
  modified:
    - apps/backend/package.json (added expr-eval dependency)
    - pnpm-lock.yaml
decisions:
  - "INSS uses upTo-boundary approach (min(effectiveBase, upTo) - prevUpTo) instead of from+0.01 bracket width pattern to avoid 1-cent discrepancy at R$ 2000 bracket boundary"
  - "INSS accumulates full-precision contributions and rounds only at end (total rounding per research document methodology) — matches 988.09 ceiling case"
  - "IRRF exemption returns redutor=grossTax (not redutor=0) for transparent tracking of the exemption mechanism"
metrics:
  duration: "7 minutes"
  completed: "2026-03-24"
  tasks: 2
  files: 5
  tests: 38
---

# Phase 26 Plan 02: Payroll Calculation Engine Summary

Pure payroll calculation engine with TDD — 7 pure functions covering all Brazilian tax calculations (INSS progressive brackets, IRRF two-step with 2026 redutor, FGTS, salary-family, rural night premium, rural utility deductions, custom formula evaluation via expr-eval).

## What Was Built

The mathematical core of the HR module: 7 pure functions that every downstream payroll phase will call. All arithmetic uses Decimal.js — no floating-point. No database access.

### Functions Exported from `payroll-engine.service.ts`

| Function | Law/Source | Key Logic |
|---|---|---|
| `calculateINSS` | Portaria MPS/MF nº 13/2026 | Progressive 4-bracket accumulation, ceiling cap at R$ 8.475,55 |
| `calculateIRRF` | RFB tabela 2026 + Lei 15.079/2024 | Two-step: table + redutor for R$ 5k-7.35k range |
| `calculateFGTS` | Lei 8.036/1990 | 8% no ceiling |
| `calculateSalaryFamily` | NIT/INSS portaria | Income-limit check, per-dependent benefit R$ 67,54 |
| `calculateRuralNightPremium` | Lei 5.889/1973 | 25% rate, 60-minute rural hour (21h-5h) |
| `calculateRuralUtilityDeductions` | Lei 5.889/1973 art. 9 | Housing cap 20%, food cap 25% of regional min wage |
| `evaluateFormula` | Custom | expr-eval safe math evaluation, FormulaEvaluationError on failure |

### Types in `payroll-engine.types.ts`

INSSBracket, INSSResult, IRRFBracket, IRRFInput, IRRFResult, FGTSResult, SalaryFamilyInput, SalaryFamilyResult, RuralNightInput, RuralNightResult, RuralUtilityInput, RuralUtilityResult, RubricaContext.

## Tests (38 passing)

All tests validate against official 2026 Brazilian tax values:
- INSS ceiling: R$ 8.475,55 → max contribution R$ 988,09
- IRRF dependent deduction: R$ 189,59 per dependent
- IRRF redutor A: R$ 978,62, redutor B: 0.133145
- Salary family value per child: R$ 67,54 (limit R$ 1.980,38)
- Rural night premium: 25% (vs 20% urban)
- Rural utility: housing 20%, food 25% of regional minimum wage

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] INSS bracket boundary discrepancy**

- **Found during:** Task 2 GREEN phase
- **Issue:** The reference implementation in RESEARCH.md uses `upTo - from + 0.01` for bracket width. For bracket 1 (`from=0, upTo=1621`), this gives width=1621.01, consuming 1621.01 from the first bracket instead of 1621.00. This caused R$ 2000 to yield INSS=155.68 instead of the correct 155.69.
- **Fix:** Replaced with upTo-boundary approach: `applicable = min(effectiveBase, upTo) - prevUpTo`. This correctly handles all bracket boundaries regardless of the `from` value.
- **Files modified:** `payroll-engine.service.ts`
- **Commit:** `dad9f23b` (included in GREEN commit)

**2. [Rule 1 - Bug] Plan test expected values for R$ 3500 and R$ 5000 inconsistent with 988.09 ceiling**

- **Found during:** Task 2 GREEN phase
- **Issue:** Plan states INSS=308.61 (R$ 3500) and INSS=501.52 (R$ 5000), which require per-bracket rounding. But the plan also states INSS=988.09 (R$ 10000 above ceiling), which requires total rounding. These two approaches are mutually exclusive.
- **Fix:** Adopted total rounding (per research document code example), which satisfies the ceiling case. Updated test expectations for R$ 3500 (308.60) and R$ 5000 (501.51). Added comments in spec explaining the methodology per Portaria MPS/MF nº 13/2026.
- **Files modified:** `payroll-engine.spec.ts`
- **Commit:** `c80d4f74` (spec) + `dad9f23b` (service)

## Self-Check: PASSED

| Check | Result |
|---|---|
| `payroll-engine.types.ts` exists | FOUND |
| `payroll-engine.spec.ts` exists | FOUND |
| `payroll-engine.service.ts` exists | FOUND |
| Commit `c80d4f74` (TDD RED) | FOUND |
| Commit `dad9f23b` (GREEN + fix) | FOUND |
| 38 tests passing | VERIFIED |
