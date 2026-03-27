# Phase 34: Wire Absence Impact to Payroll Engine - Research

**Researched:** 2026-03-26
**Domain:** Payroll calculation engine integration — absence deductions, INSS leave split, FGTS flag, payslip PDF
**Confidence:** HIGH

## Summary

Phase 34 wires an already-implemented function (`getAbsenceImpactForMonth`) into the payroll engine that currently ignores it. The function exists in `employee-absences.service.ts` and returns a fully-typed `AbsencePayrollImpact` struct. The payroll engine (`calculateEmployeePayroll`) is a pure function that needs new optional fields on `EmployeePayrollInput` to receive absence data. The orchestrator (`payroll-runs.service.ts`) is the integration seam — it builds `EmployeePayrollInput` and must call `getAbsenceImpactForMonth` before invoking the pure calculation.

All locked decisions from CONTEXT.md are unambiguous: salary base stays integral as a provento, INSS-paid days appear as a single `DESCONTO` rubrica, INSS/IRRF calculation base is reduced by that deduction, FGTS uses full-month base when `fgtsFullMonth=true`, and suspension generates its own deduction + DSR impact. No new database models or migrations are needed — this is a pure code-layer change in three files plus tests.

**Primary recommendation:** Add `absenceData?: AbsencePayrollImpact` to `EmployeePayrollInput`, wire call in orchestrator, insert absence/suspension deduction logic before Step 9 (INSS) in the calculation function, and expose `fgtsBase` in the result for PDF rodapé.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Salário base aparece integral nos proventos. Dias INSS geram rubrica de **desconto** "Afastamento INSS" com referência "X/Y dias" e valor = (inssPaidDays / diasNoMês) × salárioBase. Empresa paga primeiros 15 dias implicitamente (ficam no salário base).

**D-02:** Quando há admissão mid-month E afastamento INSS no mesmo mês, os prorateios são **cumulativos**: primeiro calcula pro-rata por admissão, depois deduz dias INSS do salário já prorateado.

**D-03:** Dias pagos pela empresa (companyPaidDays) ficam **implícitos** no salário base — sem rubrica separada de provento. Apenas o desconto INSS aparece.

**D-04:** INSS e IRRF incidem sobre o **salário já reduzido** (base de cálculo = salário base − desconto afastamento INSS − desconto suspensão).

**D-05:** Afastamento INSS aparece como **rubrica de desconto** na seção Descontos do holerite PDF, com código (ex: 900), descrição "Afastamento INSS", referência "X/Yd" e valor. Segue o padrão existente de lineItems.

**D-06:** Sem nota informativa no rodapé sobre dias empresa. Apenas o desconto INSS aparece. Layout tabular existente (Phase 28 D-04) não muda.

**D-07:** Quando `fgtsFullMonth=true` (acidente de trabalho, INSS leave, maternidade), FGTS é calculado sobre o **salário integral** (sem prorateio), conforme Lei 8.036/90 art. 15 §5.

**D-08:** Base FGTS integral aparece no **rodapé de bases** do holerite (campo "Base FGTS: R$X"), sem rubrica separada nem nota explicativa.

**D-09:** Suspensão disciplinar (suspendedDays) gera rubrica de **desconto total** "Suspensão disciplinar" com referência "X/Yd" e valor = (suspendedDays / diasNoMês) × salárioBase.

**D-10:** Suspensão **impacta DSR** — dias de suspensão contam como falta injustificada para efeito de DSR, gerando desconto adicional proporcional. Regra CLT art. 474.

### Claude's Discretion

- Códigos de rubrica para afastamento INSS e suspensão (900, 910 ou outro)
- Estrutura interna dos novos campos em `EmployeePayrollInput` e `EmployeePayrollResult`
- Lógica de cálculo do desconto DSR por suspensão
- Organização dos testes (novos cenários no spec existente vs arquivo separado)
- Se `AbsencePayrollImpact` é passado como campo no input ou buscado internamente pelo service

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FERIAS-02 | Gerente pode registrar afastamentos (atestado até 15 dias empresa / após INSS, acidente CAT, maternidade 120 dias, paternidade, casamento, falecimento), com **impacto automático na folha**, estabilidade provisória pós-acidente e controle de retorno com ASO | `getAbsenceImpactForMonth` exists and returns correct `AbsencePayrollImpact`; payroll engine needs to consume it at calculation time |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| decimal.js | existing in project | All monetary arithmetic | Already used for every payroll calculation — no alternative |
| date-holidays | existing in project | DSR Sunday/holiday counting | Already in `countRestDays()` helper |
| pdfkit | existing in project | PDF generation | Already powering `payroll-pdf.service.ts` |

No new npm dependencies required. This phase is purely a code integration.

## Architecture Patterns

### Recommended File Touch List
```
apps/backend/src/modules/payroll-runs/
├── payroll-runs.types.ts          # Add absenceData?: AbsencePayrollImpact to EmployeePayrollInput
│                                  # Add absenceInssDeduction, suspensionDeduction, fgtsBase to EmployeePayrollResult
├── payroll-calculation.service.ts # Implement absence/suspension deduction steps
├── payroll-runs.service.ts        # Call getAbsenceImpactForMonth, populate absenceData in input
└── payroll-pdf.service.ts         # Update PayslipData + renderizar fgtsBase in rodapé

apps/backend/src/modules/payroll-runs/
└── payroll-calculation.service.spec.ts  # New test scenarios for absence calculations
```

### Pattern 1: Optional Input Field (matching existing `timesheetData` pattern)

**What:** Add `absenceData` as an optional field to `EmployeePayrollInput` — same pattern as `timesheetData`.

**When to use:** Pure calculation functions should not call services. Absence data is fetched by the orchestrator and passed in.

**Example:**
```typescript
// In payroll-runs.types.ts
import type { AbsencePayrollImpact } from '../employee-absences/employee-absences.types';

export interface EmployeePayrollInput {
  // ...existing fields...
  timesheetData: { ... } | null;
  absenceData?: AbsencePayrollImpact | null;  // NEW — follows timesheetData pattern
  // ...
}
```

### Pattern 2: Orchestrator Calls getAbsenceImpactForMonth (Integration Seam)

**What:** In `payroll-runs.service.ts` at lines ~352-376 where `EmployeePayrollInput` is built, add a call to `getAbsenceImpactForMonth` before constructing `payrollInput`. This is already inside a `tx` (transaction client).

**When to use:** The function signature is `getAbsenceImpactForMonth(employeeId, referenceMonth, tx)` — the orchestrator already has all three arguments at this point.

**Example (orchestrator addition):**
```typescript
// Import at top of payroll-runs.service.ts
import { getAbsenceImpactForMonth } from '../employee-absences/employee-absences.service';

// Inside processEmployee (MONTHLY run branch, before constructing payrollInput):
const absenceData = await getAbsenceImpactForMonth(employee.id, referenceMonth, tx);

const payrollInput: EmployeePayrollInput = {
  // ...existing fields...
  absenceData,
};
```

### Pattern 3: Calculation Engine — New Steps

**What:** Insert absence deduction calculation after Step 1 (pro-rata) and before Step 9 (INSS). The INSS/IRRF base must use the reduced salary per D-04.

**Step sequence (revised):**
```
Step 1:  Pro-rata by admission (existing)
Step 1b: ABSENCE INSS deduction — inssPaidDays / totalDays × adjustedSalary
Step 1c: SUSPENSION deduction — suspendedDays / totalDays × adjustedSalary
Step 1d: Reduced salary base = adjustedSalary − absenceInssDeduction − suspensionDeduction
Step 2:  Hourly rate (uses adjustedSalary, unchanged — OT on full contracted rate)
...
Step 4b: DSR for suspension — suspendedDays reduce DSR base (CLT art. 474)
Step 8:  Gross salary uses reducedSalaryBase (not adjustedSalary) for INSS/IRRF base
Step 9:  INSS on reducedSalaryBase
Step 10: IRRF on reducedSalaryBase
Step 14: FGTS — if fgtsFullMonth, use baseSalary (full, pre pro-rata) per D-07
Step 16: lineItems — push DESCONTO rubricas for absence INSS and suspension
```

**Key arithmetic (D-01, D-09):**
```typescript
// After Step 1 (adjustedSalary may be pro-rated or full)
let absenceInssDeduction = new Decimal(0);
let suspensionDeduction  = new Decimal(0);

if (absenceData) {
  if (absenceData.inssPaidDays > 0) {
    absenceInssDeduction = new Decimal(absenceData.inssPaidDays)
      .div(totalDays)
      .mul(adjustedSalary)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }
  if (absenceData.suspendedDays > 0) {
    suspensionDeduction = new Decimal(absenceData.suspendedDays)
      .div(totalDays)
      .mul(adjustedSalary)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }
}

const salaryForInssBase = adjustedSalary
  .minus(absenceInssDeduction)
  .minus(suspensionDeduction);
```

**FGTS on full base (D-07):**
```typescript
// Step 14 — override FGTS base
const fgtsBase = absenceData?.fgtsFullMonth ? baseSalary : adjustedSalary;
const fgtsResult = calculateFGTS(fgtsBase.plus(overtime50).plus(overtime100)...);
// expose fgtsBase in result for PDF rodapé
```

**DSR impact from suspension (D-10):**
```typescript
// For suspension, treat suspendedDays as missed work days (CLT art. 474).
// Each Sunday/holiday in the week a suspension occurs loses DSR entitlement.
// Simplest defensible approach: DSR deduction = (suspendedDays / workDays) * dsrValue
// (proportional reduction of earned DSR)
```

### Pattern 4: lineItem Codes (Claude's Discretion)

Recommended codes (follow existing series):
- `'0900'` — "Afastamento INSS", reference: `"${inssPaidDays}/${totalDays}d"`, type: `DESCONTO`
- `'0910'` — "Suspensão Disciplinar", reference: `"${suspendedDays}/${totalDays}d"`, type: `DESCONTO`

These codes are above the current highest used code (`0101`), leaving space for future rubricas between `0100`-`0899`.

### Pattern 5: PDF Rodapé — fgtsBase

`payslip-pdf.service.ts` currently renders:
```
Base INSS: R$X    Base IRRF: R$Y    FGTS do Mês: R$Z
```

Per D-08, when `fgtsFullMonth=true`, `fgtsBase` in the rodapé must reflect full salary (not prorated). This requires:
1. Adding `fgtsBase: number` to `PayslipData` interface
2. Updating the rodapé text to use `fgtsBase` instead of computing from `grossSalary`
3. The orchestrator already serializes `result.fgtsAmount` — also serialize new `result.fgtsBase`

### Anti-Patterns to Avoid

- **Calling `getAbsenceImpactForMonth` inside `calculateEmployeePayroll`**: The calculation function is pure — it must not call DB services. Pass `absenceData` via input (Claude's Discretion settled: field on input).
- **Reducing `adjustedSalary` before overtime calculation**: Overtime is on contracted hourly rate, not reduced base. Only INSS/IRRF base is reduced.
- **Using `grossSalary` for FGTS base when `fgtsFullMonth=true`**: `grossSalary` may include overtime; FGTS full-month rule refers to base salary, not variable earnings. Use `baseSalary` (pre-pro-rata).
- **Adding a PROVENTO rubrica for company-paid days**: D-03 locks this out — company days are implicit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Absence overlap with month | Custom date range intersection | `getAbsenceImpactForMonth` (already implemented) | Handles multi-absence months, open-ended INSS, month boundary clipping |
| DSR counting | Custom Sunday/holiday loop | `countRestDays()` helper in `payroll-calculation.service.ts` | Already correct per `date-holidays` |
| Progressive INSS | Custom bracket math | `calculateINSS()` from payroll-engine.service | Unit-tested against 2026 official tables |
| Decimal arithmetic | Native JS number | `Decimal.js` | Rounding errors in monetary calculations |

## Common Pitfalls

### Pitfall 1: INSS/IRRF Base vs. Gross Salary for FGTS
**What goes wrong:** Using `grossSalary` (which includes OT) as FGTS base for the `fgtsFullMonth` case.
**Why it happens:** `grossSalary` is the obvious aggregation point; D-07 says "salário integral" which means contracted base salary, not gross.
**How to avoid:** Use `baseSalary` (the unprorated field from input) for FGTS-full-month base. For normal months, use `adjustedSalary` + variable components as today.
**Warning signs:** Test with `baseSalary=3000`, `admissionDate` mid-month (prorated to 1500), `fgtsFullMonth=true` — FGTS should be on 3000, not 1500.

### Pitfall 2: Cumulative Pro-Rata Order (D-02)
**What goes wrong:** Applying INSS deduction to `baseSalary` instead of `adjustedSalary` when employee was admitted mid-month.
**Why it happens:** Two prorateios in one month is a rare edge case.
**How to avoid:** Always compute `adjustedSalary` first (admission pro-rata, Step 1), then apply absence deduction to `adjustedSalary` (not `baseSalary`). Deduction = `inssPaidDays / totalDays × adjustedSalary`.
**Warning signs:** Unit test with both admission mid-month AND inssPaidDays > 0 — verify double reduction.

### Pitfall 3: `grossSalary` Still Reflects Proventos, Not Reduced Base
**What goes wrong:** Accidentally subtracting absence deduction from `grossSalary` computation (Step 8), making it look like INSS/IRRF base is correct but the Proventos total on the payslip is wrong.
**Why it happens:** `adjustedSalary` feeds into `grossSalary` at Step 8. If you subtract from `adjustedSalary` early, the salary base lineItem will show the wrong value.
**How to avoid:** Keep `adjustedSalary` untouched for the lineItems provento value. Compute a separate `salaryForInssBase` variable that is `adjustedSalary − absenceInssDeduction − suspensionDeduction`. Use `salaryForInssBase` only for Step 9/10. Display `adjustedSalary` in the provento lineItem (Salário Base stays integral per D-01).

### Pitfall 4: DSR Suspension Calculation (CLT art. 474)
**What goes wrong:** Ignoring DSR impact of suspension entirely, or over-deducting.
**Why it happens:** CLT art. 474 says suspension is treated as unjustified absence for DSR purposes. The interaction with OT-earned DSR is non-trivial.
**How to avoid:** The simplest legally defensible approach is proportional DSR reduction: earned `dsrValue × (suspendedDays / workDays)`. This covers the common case without requiring per-week mapping. For Phase 34, this is sufficient (Claude's Discretion).
**Warning signs:** Employee with 2 suspension days and overtime — dsrValue should be partially reduced.

### Pitfall 5: Net Salary Becomes Negative
**What goes wrong:** Large absence + suspension + standard deductions push netSalary below zero.
**Why it happens:** No floor guard in current implementation.
**How to avoid:** After computing netSalary, apply `Decimal.max(netSalary, new Decimal(0))`. Document this guard in a comment. Do not throw; just floor at zero (common Brazilian payroll behavior).

### Pitfall 6: `getAbsenceImpactForMonth` Called Outside Transaction
**What goes wrong:** Calling `getAbsenceImpactForMonth` with `prisma` (not `tx`) breaks RLS isolation during payroll processing.
**Why it happens:** The function signature requires a `TxClient` — passing the global `prisma` instance would use the wrong RLS context.
**How to avoid:** The orchestrator already uses `tx` inside `withRlsContext`. Pass `tx` directly, exactly as in Phase 29 decision: "getAbsenceImpactForMonth accepts TxClient directly — called from payroll engine inside transactions."

## Code Examples

### Existing: How timesheetData is handled (source: payroll-runs.service.ts ~352-376)
```typescript
// orchestrator builds input inside withRlsContext tx
const payrollInput: EmployeePayrollInput = {
  // ...
  timesheetData: {
    totalOvertime50: timesheet.totalOvertime50,
    totalOvertime100: timesheet.totalOvertime100,
    totalNightMinutes: timesheet.totalNightMinutes,
    totalAbsences: timesheet.totalAbsences,
  },
  pendingAdvances,
  customRubricas: [],
};
result = calculateEmployeePayroll(payrollInput, referenceMonth, engineParams);
```

### New: Absence data follows same pattern
```typescript
// Fetch absence impact BEFORE building input (inside same tx)
const absenceData = await getAbsenceImpactForMonth(employee.id, referenceMonth, tx);

const payrollInput: EmployeePayrollInput = {
  // ...all existing fields...
  timesheetData: { ... },
  absenceData,   // NEW
  pendingAdvances,
  customRubricas: [],
};
```

### Existing: lineItem push pattern (source: payroll-calculation.service.ts ~284-393)
```typescript
// All deduction lineItems follow this shape:
lineItems.push({
  code: '0071',
  description: 'INSS',
  reference: `${inssResult.effectiveRate.mul(100).toFixed(2)}%`,
  type: 'DESCONTO',
  value: inssAmount,
});
```

### New: Absence INSS lineItem (follows existing pattern)
```typescript
if (absenceInssDeduction.greaterThan(0)) {
  lineItems.push({
    code: '0900',
    description: 'Afastamento INSS',
    reference: `${absenceData!.inssPaidDays}/${totalDays}d`,
    type: 'DESCONTO',
    value: absenceInssDeduction,
  });
}
if (suspensionDeduction.greaterThan(0)) {
  lineItems.push({
    code: '0910',
    description: 'Suspensão Disciplinar',
    reference: `${absenceData!.suspendedDays}/${totalDays}d`,
    type: 'DESCONTO',
    value: suspensionDeduction,
  });
}
```

### Existing: PDF rodapé (source: payroll-pdf.service.ts ~254-260)
```typescript
doc.text(
  `Base INSS: ${formatCurrency(data.inssBase)}    Base IRRF: ${formatCurrency(data.irrfBase)}    FGTS do Mês: ${formatCurrency(data.fgtsMonth)}`,
  margin, y,
);
```
After Phase 34, `data.fgtsMonth` stays (it is the FGTS contribution amount), but the base used to compute it when `fgtsFullMonth=true` must be `baseSalary`, not `adjustedSalary`. The rodapé format does NOT change (D-08 — no extra note).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No absence wiring | `getAbsenceImpactForMonth` exists but uncalled | Phase 29 built it | Phase 34 is the bridge |
| FGTS on adjustedSalary only | FGTS on full baseSalary when fgtsFullMonth=true | Phase 34 | Correct per Lei 8.036/90 art. 15 §5 |

## Open Questions

1. **Should `EmployeePayrollResult` expose a `fgtsBase` field separately from `fgtsAmount`?**
   - What we know: PDF rodapé currently shows `fgtsMonth` (the contribution, 8% × base). The base is not exposed.
   - What's unclear: Whether downstream consumers (eSocial S-1200, accounting entries) need the FGTS base value separately.
   - Recommendation: Add `fgtsBase: Decimal` to `EmployeePayrollResult` for transparency; the PDF can display it if needed, and it avoids reverse-engineering from `fgtsAmount`.

2. **DSR suspension: per-week mapping vs. proportional reduction?**
   - What we know: CLT art. 474 treats suspension as unjustified absence for DSR. Strict interpretation maps per-week (lose DSR for the week the suspension falls in).
   - What's unclear: Per-week mapping requires knowing which day of week each absence falls on — data not currently in `AbsencePayrollImpact`.
   - Recommendation (Claude's Discretion): Use proportional reduction `dsrValue × (suspendedDays / workDays)` for Phase 34. Per-week mapping can be added later if requested.

## Environment Availability

Step 2.6: SKIPPED — this phase has no external dependencies. All changes are code-layer within the existing TypeScript monorepo. No new services, CLIs, or databases required.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (via @swc/jest transformer) |
| Config file | `apps/backend/jest.config.js` |
| Quick run command | `cd apps/backend && npx jest payroll-calculation.service.spec --no-coverage` |
| Full suite command | `cd apps/backend && npx jest --no-coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FERIAS-02 | INSS-paid days generate deduction rubrica, INSS/IRRF on reduced base | unit | `cd apps/backend && npx jest payroll-calculation.service.spec --no-coverage` | ✅ (new scenarios in existing spec) |
| FERIAS-02 | Admission mid-month + INSS absence = cumulative pro-rata (D-02) | unit | same | ✅ (new scenario) |
| FERIAS-02 | `fgtsFullMonth=true` uses full baseSalary for FGTS | unit | same | ✅ (new scenario) |
| FERIAS-02 | Suspension generates deduction rubrica + DSR reduction | unit | same | ✅ (new scenario) |
| FERIAS-02 | No absence → zero deduction, behavior unchanged | unit | same | ✅ (regression) |
| FERIAS-02 | Orchestrator calls `getAbsenceImpactForMonth` and passes result | unit (mock) | `cd apps/backend && npx jest payroll-runs.service.spec --no-coverage` | ❌ Wave 0 (no service spec yet — or add mock in existing spec) |

### Sampling Rate
- **Per task commit:** `cd apps/backend && npx jest payroll-calculation.service.spec --no-coverage`
- **Per wave merge:** `cd apps/backend && npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New test scenarios in `apps/backend/src/modules/payroll-runs/payroll-calculation.service.spec.ts` — covers FERIAS-02 absence deduction, FGTS full-month, suspension+DSR, cumulative pro-rata
- [ ] `makeBaseInput` in spec needs `absenceData` in its return signature after types change (backward-compatible with `absenceData: null`)

*(No new test files needed — all new scenarios extend the existing spec file)*

## Project Constraints (from CLAUDE.md)

- **Express 5 `req.params` as string:** `req.params.id as string` — not relevant to this phase (no new routes)
- **Prisma enums typed, never `string`:** Not directly relevant — no new Prisma enum fields
- **Use correct Prisma field names:** `getAbsenceImpactForMonth` already uses correct schema field names (`employeeAbsence.findMany`)
- **Decimal.js static vs instance:** `Decimal.max(a, b)` is the static form — use for netSalary floor guard
- **Frontend types must mirror backend:** No frontend changes in this phase
- **`null` vs `undefined`:** `absenceData?: AbsencePayrollImpact | null` — use `null` for "no absences" (consistent with Prisma pattern); `undefined` means field not yet populated

## Sources

### Primary (HIGH confidence)
- Direct code read: `apps/backend/src/modules/payroll-runs/payroll-calculation.service.ts` — full Step 1-16 flow understood
- Direct code read: `apps/backend/src/modules/payroll-runs/payroll-runs.types.ts` — `EmployeePayrollInput`, `EmployeePayrollResult` interfaces confirmed
- Direct code read: `apps/backend/src/modules/employee-absences/employee-absences.service.ts` — `getAbsenceImpactForMonth` signature and return type verified
- Direct code read: `apps/backend/src/modules/employee-absences/employee-absences.types.ts` — `AbsencePayrollImpact` interface confirmed
- Direct code read: `apps/backend/src/modules/payroll-runs/payroll-runs.service.ts` — orchestration seam at lines ~352-376 confirmed
- Direct code read: `apps/backend/src/modules/payroll-runs/payroll-pdf.service.ts` — `PayslipData` and rodapé rendering confirmed
- Direct code read: `apps/backend/src/modules/payroll-runs/payroll-calculation.service.spec.ts` — existing test patterns confirmed
- Direct code read: `.planning/phases/34-wire-absence-impact-payroll-engine/34-CONTEXT.md` — all decisions D-01 through D-10 authoritative
- Legal: Lei 8.036/90 art. 15 §5 (FGTS on full salary during INSS leave) — well-established Brazilian labor law, HIGH confidence
- Legal: CLT art. 474 (suspension = unjustified absence for DSR) — well-established, HIGH confidence

### Secondary (MEDIUM confidence)
- None needed — all findings sourced directly from codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all libraries already in use
- Architecture: HIGH — integration points precisely identified from code, decisions locked in CONTEXT.md
- Pitfalls: HIGH — derived from reading actual calculation logic and test patterns
- Legal rules (FGTS, DSR): HIGH — well-established Brazilian CLT/Lei 8036 rules unchanged for decades

**Research date:** 2026-03-26
**Valid until:** 2026-06-26 (legal tables stable; code stable until next payroll feature)
