# Phase 29: Férias, Afastamentos, Rescisão e Provisões - Research

**Researched:** 2026-03-25
**Domain:** Brazilian labor law — vacation accrual, absence management, employment termination, payroll provisions
**Confidence:** HIGH

---

<phase_requirements>

## Phase Requirements

| ID        | Description                                                                                                                                                                                                                                    | Research Support                                                                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FERIAS-01 | Controle de períodos aquisitivos, programação de férias (mín 5 dias, até 3 frações), cálculo (salário + 1/3 + médias – INSS – IRRF), abono pecuniário, alerta 60 dias antes do dobro, recibo PDF, pagamento 2 dias antes, calendário visual    | New models: VacationAcquisitivePeriod + VacationSchedule; calculation reuses payroll engine (INSS/IRRF functions); pdfkit for receipt; alert via existing cron pattern |
| FERIAS-02 | Registro de afastamentos (atestado 15 dias/INSS, acidente CAT, maternidade, paternidade, casamento, falecimento), impacto automático na folha, estabilidade provisória, controle retorno com ASO                                               | New model: EmployeeAbsence; EmployeeStatus transition to AFASTADO; folha pro-rata já implementada via proRataDays                                                      |
| FERIAS-03 | Rescisão por tipo (sem justa causa, justa causa, pedido, fim safra, acordo mútuo) com cálculo automático (saldo salário, aviso prévio proporcional Lei 12.506/2011, 13º prop., férias, multa FGTS), TRCT PDF, guias GRRF, alerta prazo 10 dias | New model: EmployeeTermination; pure calculation function like payroll-engine; pdfkit TRCT                                                                             |
| FERIAS-04 | Provisão mensal férias e 13º (1/12 salário + 1/3 + encargos), lançamento contábil despesa/passivo, reversão ao pagar, relatório com rateio por centro de custo                                                                                 | New model: PayrollProvision; accounting integration mirrors Phase 32 pattern (lançamento contábil é prep for INTEGR-02)                                                |

</phase_requirements>

---

## Summary

Phase 29 implements the four remaining HR sub-domains before security (Phase 30) and eSocial (Phase 31). All four requirements are computation-heavy with precise Brazilian labor law rules. The good news: the payroll engine already provides INSS and IRRF calculation functions that are directly reused here (vacation pay is calculated with the same formulas). The architecture naturally extends from what Phases 25–28 established.

The four feature areas decompose cleanly into four independent modules: `vacation-schedules` (FERIAS-01), `employee-absences` (FERIAS-02), `employee-terminations` (FERIAS-03), and `payroll-provisions` (FERIAS-04). Each gets its own Prisma models, service layer, routes, and frontend page. All four reuse the existing payroll engine's INSS/IRRF functions, pdfkit for PDFs, and the EmployeeStatus transition machinery already in place.

The highest-complexity area is FERIAS-03 (rescisão), which requires implementing the proportional notice period formula from Lei 12.506/2011, different penalty rules per termination type, and a TRCT PDF with a specific legal layout. FERIAS-04 (provisions) requires careful Decimal arithmetic to avoid accumulated rounding errors across employees, and its "accounting entry" concept is a stub for Phase 32 (INTEGR-02) — in this phase it is modeled as a structured JSON payload stored on the provision record, not wired to a full chart-of-accounts system.

**Primary recommendation:** Four new backend modules + one Prisma migration + four new frontend pages following the established payroll-runs wizard pattern. Reuse `calculateINSS`/`calculateIRRF` from `payroll-engine.service` for all monetary calculations. Use `pdfkit` (already installed) for TRCT and vacation receipts. Store accounting entries as structured JSON on the provision record — the full GL integration is Phase 32.

---

## Standard Stack

### Core (all already installed)

| Library       | Version | Purpose                                           | Why Standard                                                              |
| ------------- | ------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| decimal.js    | 10.6.0  | All monetary arithmetic                           | Mandatory — all payroll calculations use Decimal per project decisions    |
| pdfkit        | 0.17.2  | TRCT, vacation receipt, GRRF cover PDFs           | Already in backend; used by payroll-runs, timesheet, and 9+ other modules |
| date-holidays | 3.26.11 | Holiday lookup for aviso prévio counting          | Already installed for payroll-runs DSR calculation                        |
| jszip         | 3.10.1  | Batch export of TRCT + GRRF as ZIP                | Already installed for payslip batch export                                |
| nodemailer    | 8.0.1   | Email alerts (vacation due, termination deadline) | Already installed; mail.service.ts is the wrapper                         |

### No New Dependencies Required

All required functionality is covered by libraries already in `apps/backend/package.json`. No new npm installs needed for Phase 29.

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure

```
apps/backend/src/modules/
├── vacation-schedules/          # FERIAS-01
│   ├── vacation-schedules.service.ts
│   ├── vacation-schedules.routes.ts
│   ├── vacation-schedules.routes.spec.ts
│   └── vacation-schedules.types.ts
├── employee-absences/           # FERIAS-02
│   ├── employee-absences.service.ts
│   ├── employee-absences.routes.ts
│   ├── employee-absences.routes.spec.ts
│   └── employee-absences.types.ts
├── employee-terminations/       # FERIAS-03
│   ├── employee-terminations.service.ts   # pure calculation + CRUD
│   ├── termination-calculation.service.ts # pure functions (testable)
│   ├── termination-pdf.service.ts         # TRCT + GRRF PDF generation
│   ├── employee-terminations.routes.ts
│   ├── employee-terminations.routes.spec.ts
│   └── employee-terminations.types.ts
├── payroll-provisions/          # FERIAS-04
│   ├── payroll-provisions.service.ts
│   ├── payroll-provisions.routes.ts
│   ├── payroll-provisions.routes.spec.ts
│   └── payroll-provisions.types.ts

apps/frontend/src/
├── pages/
│   ├── VacationSchedulesPage.tsx
│   ├── EmployeeAbsencesPage.tsx
│   ├── EmployeeTerminationsPage.tsx
│   └── PayrollProvisionsPage.tsx
├── hooks/
│   ├── useVacationSchedules.ts
│   ├── useEmployeeAbsences.ts
│   ├── useEmployeeTerminations.ts
│   └── usePayrollProvisions.ts
└── types/
    ├── vacation.ts
    ├── absence.ts
    ├── termination.ts
    └── provision.ts
```

### Pattern 1: Prisma Models for Phase 29

New models to add in a single migration `20260506100000_add_vacation_absence_termination_provision`:

```typescript
// FERIAS-01: Vacation control
model VacationAcquisitivePeriod {
  id           String   @id @default(uuid())
  employeeId   String
  startDate    DateTime @db.Date
  endDate      DateTime @db.Date     // startDate + 1 year
  daysEarned   Int      @default(30) // 30 for full year; reduced for absences
  daysTaken    Int      @default(0)
  daysLost     Int      @default(0)  // forfeited if not taken in the doubling period
  status       VacationPeriodStatus @default(ACCRUING)
  createdAt    DateTime @default(now())

  employee  Employee           @relation(...)
  schedules VacationSchedule[] @relation(...)

  @@index([employeeId, status])
  @@map("vacation_acquisitive_periods")
}

model VacationSchedule {
  id                   String   @id @default(uuid())
  organizationId       String
  employeeId           String
  acquisitivePeriodId  String
  startDate            DateTime @db.Date
  endDate              DateTime @db.Date
  totalDays            Int      // 5–30
  abono                Int      @default(0)  // 0 or 10 days sold (pecuniary bonus)
  grossAmount          Decimal  @db.Decimal(10, 2)
  inssAmount           Decimal  @db.Decimal(10, 2)
  irrfAmount           Decimal  @db.Decimal(10, 2)
  netAmount            Decimal  @db.Decimal(10, 2)
  fgtsAmount           Decimal  @db.Decimal(10, 2)
  paymentDueDate       DateTime @db.Date  // startDate - 2 business days
  status               VacationScheduleStatus @default(SCHEDULED)
  receiptUrl           String?
  processedAt          DateTime?
  createdBy            String
  createdAt            DateTime @default(now())

  employee          Employee                @relation(...)
  acquisitivePeriod VacationAcquisitivePeriod @relation(...)

  @@index([employeeId, status])
  @@index([paymentDueDate])
  @@map("vacation_schedules")
}

// FERIAS-02: Absences
model EmployeeAbsence {
  id              String       @id @default(uuid())
  organizationId  String
  employeeId      String
  absenceType     AbsenceType
  startDate       DateTime     @db.Date
  endDate         DateTime?    @db.Date      // null for open-ended (INSS)
  totalDays       Int?
  catNumber       String?                   // CAT for accidents
  inssStartDate   DateTime?    @db.Date     // day 16 for atestado → INSS
  stabilityEndsAt DateTime?    @db.Date     // accident: 12 months post-return
  returnDate      DateTime?    @db.Date
  asoRequired     Boolean      @default(false)
  asoDocumentId   String?
  payrollImpact   String?      // JSON: {proRataDeduct: 5, fgtsIntegral: true, inssCompanyDays: 15}
  notes           String?
  createdBy       String
  createdAt       DateTime     @default(now())

  employee Employee @relation(...)

  @@index([employeeId, absenceType])
  @@index([organizationId, startDate])
  @@map("employee_absences")
}

// FERIAS-03: Termination
model EmployeeTermination {
  id                   String            @id @default(uuid())
  organizationId       String
  employeeId           String
  terminationType      TerminationType
  terminationDate      DateTime          @db.Date
  noticePeriodDays     Int               // calculated: 30 + 3/year (Lei 12.506/2011, max 90)
  noticePeriodType     NoticePeriodType  // WORKED or COMPENSATED
  balanceSalary        Decimal           @db.Decimal(10, 2)
  thirteenthProp       Decimal           @db.Decimal(10, 2)
  vacationVested       Decimal           @db.Decimal(10, 2)
  vacationProp         Decimal           @db.Decimal(10, 2)
  vacationBonus        Decimal           @db.Decimal(10, 2) // 1/3
  noticePay            Decimal           @db.Decimal(10, 2) // 0 for voluntary
  fgtsBalance          Decimal           @db.Decimal(10, 2)
  fgtsPenalty          Decimal           @db.Decimal(10, 2) // 40% or 20% or 0
  totalGross           Decimal           @db.Decimal(10, 2)
  inssAmount           Decimal           @db.Decimal(10, 2)
  irrfAmount           Decimal           @db.Decimal(10, 2)
  totalNet             Decimal           @db.Decimal(10, 2)
  paymentDeadline      DateTime          @db.Date  // 10 days from termination
  trcUrlPdf            String?
  grfUrlPdf            String?
  status               TerminationStatus @default(DRAFT)
  processedAt          DateTime?
  createdBy            String
  createdAt            DateTime          @default(now())

  employee Employee @relation(...)

  @@unique([employeeId])  // one active termination per employee
  @@index([organizationId, status])
  @@map("employee_terminations")
}

// FERIAS-04: Provisions
model PayrollProvision {
  id                  String        @id @default(uuid())
  organizationId      String
  employeeId          String
  referenceMonth      DateTime      @db.Date  // 2026-03-01 for March
  provisionType       ProvisionType // VACATION or THIRTEENTH
  baseSalary          Decimal       @db.Decimal(10, 2)
  provisionAmount     Decimal       @db.Decimal(10, 2) // 1/12 × salary × 4/3
  chargesAmount       Decimal       @db.Decimal(10, 2) // INSS patronal 20% + RAT + FGTS 8%
  totalAmount         Decimal       @db.Decimal(10, 2)
  costCenterId        String?
  accountingEntryJson Json?         // {debitAccount: "6.1.01", creditAccount: "2.2.01", ...}
  reversedAt          DateTime?
  reversedBy          String?
  createdAt           DateTime      @default(now())

  employee   Employee    @relation(...)
  costCenter CostCenter? @relation(...)

  @@unique([employeeId, referenceMonth, provisionType])
  @@index([organizationId, referenceMonth])
  @@map("payroll_provisions")
}

// ─── New Enums ──────────────────────────────────────────────────────────

enum VacationPeriodStatus {
  ACCRUING        // within first 12 months
  AVAILABLE       // 12 months earned; can now schedule
  SCHEDULED       // at least one VacationSchedule in SCHEDULED/PAID status
  EXPIRED         // exceeded doubling limit (24 months from end of acquisitive period)
}

enum VacationScheduleStatus {
  SCHEDULED
  PAID
  CANCELLED
}

enum AbsenceType {
  MEDICAL_CERTIFICATE    // atestado médico até 15 dias (empresa)
  INSS_LEAVE             // afastamento INSS (a partir do 16º dia)
  WORK_ACCIDENT          // acidente de trabalho com CAT
  MATERNITY              // licença-maternidade 120 dias
  PATERNITY              // licença-paternidade 5 dias (+15 Empresa Cidadã)
  MARRIAGE               // casamento 3 dias
  BEREAVEMENT            // falecimento familiar 2 dias
  MILITARY               // serviço militar
  OTHER
}

enum TerminationType {
  WITHOUT_CAUSE          // sem justa causa — 40% FGTS, aviso prévio
  WITH_CAUSE             // justa causa — sem FGTS, sem aviso
  VOLUNTARY              // pedido de demissão — sem FGTS, sem aviso (ou cumprido)
  SEASONAL_END           // fim de safra — sem multa FGTS (Lei 5.889/73)
  MUTUAL_AGREEMENT       // acordo mútuo (Lei 13.467/2017) — 20% FGTS, metade aviso
}

enum NoticePeriodType {
  WORKED        // colaborador cumpre o aviso
  COMPENSATED   // empresa paga em dinheiro
  WAIVED        // dispensado pela empresa
}

enum TerminationStatus {
  DRAFT
  PROCESSED     // calculations locked, TRCT generated
  PAID          // payment confirmed
}

enum ProvisionType {
  VACATION
  THIRTEENTH
}
```

### Pattern 2: Brazilian Labor Law Calculation Rules

**FERIAS-01 — Vacation Calculation (CLT Art. 142)**

```typescript
// Source: CLT Art. 142, 143 — confirmed against RFB and TST jurisprudence
// Vacation payment = (salary / 30 × vacationDays) + 1/3 + avgOvertimes + avgNight
// - 1/3 constitutional bonus applies to the base + averages (not gross after INSS)
// - INSS deducted on (salary + 1/3) only — same brackets as monthly payroll
// - IRRF deducted on (salary + 1/3) - INSS — same brackets
// - Abono pecuniário (Art. 143): sell 10 days, NOT subject to INSS/IRRF (TST OJ 386)
// - Payment deadline: 2 business days before vacation start (CLT Art. 145)
// - Doubling period: 12 months after the acquisitive period ends = 24 months from admission anniversary

function calculateVacationPay(input: VacationCalcInput, params: EngineParams): VacationCalcResult {
  // dailyRate = baseSalary / 30
  const dailyRate = input.baseSalary.div(30);
  // vacationBase = dailyRate × daysScheduled
  const vacationBase = dailyRate.mul(input.daysScheduled);
  // bonusThird = (vacationBase + avgOvertime + avgNight) / 3
  const bonusThird = vacationBase.add(input.avgOvertime).add(input.avgNight).div(3);
  // abonoValue = dailyRate × abonodays × (1 + 1/3) — not subject to INSS/IRRF (OJ 386)
  const abonoValue = dailyRate.mul(input.abonodays).mul(new Decimal('1.333333'));
  // grossSubjectToTax = vacationBase + bonusThird + avgOvertime + avgNight
  const grossTaxable = vacationBase.add(bonusThird).add(input.avgOvertime).add(input.avgNight);
  // INSS on grossTaxable (same brackets as monthly payroll)
  const inss = calculateINSS(grossTaxable, params.inssBrackets, params.inssCeiling);
  // IRRF on grossTaxable - INSS - dependentDeductions
  const irrf = calculateIRRF({
    grossSalary: grossTaxable,
    inssContribution: inss.contribution,
    ...params,
  });
  return {
    grossTaxable,
    abonoValue,
    inss: inss.contribution,
    irrf: irrf.finalTax,
    net: grossTaxable.sub(inss.contribution).sub(irrf.finalTax).add(abonoValue),
    fgts: grossTaxable.mul('0.08'),
  }; // FGTS on full gross incl abono (CLT 28 §9)
}
```

**FERIAS-03 — Notice Period Calculation (Lei 12.506/2011)**

```typescript
// Source: Lei 12.506/2011 — proportional notice period
// Base: 30 days + 3 days per completed year (beyond 1st) — maximum 90 days
// "completed year" = each 12-month period of the employment contract

function calcNoticePeriodDays(admissionDate: Date, terminationDate: Date): number {
  const yearsCompleted = Math.floor(
    (terminationDate.getTime() - admissionDate.getTime()) / (365.25 * 24 * 3600 * 1000),
  );
  const noticeDays = Math.min(30 + Math.max(0, yearsCompleted - 1) * 3, 90);
  return noticeDays;
}

// Termination type → FGTS penalty mapping
const FGTS_PENALTY: Record<TerminationType, Decimal> = {
  WITHOUT_CAUSE: new Decimal('0.40'),
  MUTUAL_AGREEMENT: new Decimal('0.20'),
  WITH_CAUSE: new Decimal('0.00'),
  VOLUNTARY: new Decimal('0.00'),
  SEASONAL_END: new Decimal('0.00'), // Lei 5.889/73 — fim de safra
};

// Balance salary = salary / 30 × days worked in last month
// 13th proportional = salary / 12 × months worked in year (≥ 15 days = full month)
// Vacation vested = full unpaid acquired vacation + 1/3
// Vacation proportional = days earned in current acq. period (≥ 15 days = full month count) + 1/3
// Notice pay (worked = 0; compensated = 1 month salary equivalent)
```

**FERIAS-04 — Provision Calculation**

```typescript
// Source: CPC 25 / IAS 37 — accrual basis; confirmed against standard Brazilian payroll accounting
// Monthly vacation provision = (salary / 12) × (4/3)
//   — 4/3 because for every 12 months earned there is 1/3 bonus
// Monthly 13th provision = salary / 12
// Employer charges on vacation provision = provisionAmount × (INSS% + RAT% + FGTS%)
//   — INSS patronal 20%, RAT typically 1–3% (use 1% for rural), FGTS 8%
// Accounting entry (JSON stub — wired to GL in Phase 32):
//   Debit:  "Despesa com Férias" (DRE 6.1.01)
//   Credit: "Provisão de Férias a Pagar" (BP 2.2.01)
// Reversal: when vacation is paid, reverse the provision entry

function calculateMonthlyProvision(salary: Decimal, ratPercent: Decimal): ProvisionResult {
  const vacationProvision = salary.div(12).mul(new Decimal('1.333333')).toDecimalPlaces(2);
  const thirteenthProvision = salary.div(12).toDecimalPlaces(2);
  const chargeRate = new Decimal('0.20').add(ratPercent).add(new Decimal('0.08'));
  const vacationCharges = vacationProvision.mul(chargeRate).toDecimalPlaces(2);
  const thirteenthCharges = thirteenthProvision.mul(chargeRate).toDecimalPlaces(2);
  return { vacationProvision, vacationCharges, thirteenthProvision, thirteenthCharges };
}
```

### Pattern 3: Absence Payroll Impact Matrix

```
AbsenceType        | Company pays | INSS | FGTS | Stability
--------------------|-------------|------|------|----------
MEDICAL_CERTIFICATE | Days 1-15   | Yes  | Yes  | No
INSS_LEAVE          | 0 (INSS pays from day 16) | No | Yes | No
WORK_ACCIDENT       | Days 1-15   | No   | Yes  | 12 months post-return
MATERNITY           | All 120 days (via INSS reimbursement) | No | Yes | From conception + 60 days post-return
PATERNITY           | 5 days      | Yes  | Yes  | No
MARRIAGE            | 3 days      | Yes  | Yes  | No
BEREAVEMENT         | 2 days      | Yes  | Yes  | No
```

**Key rule:** FGTS is always deposited during INSS leave and work accident leave — employer keeps depositing even when salary is suspended (CLT Art. 28 §9 + Lei 8.036/90 Art. 15 §5).

### Pattern 4: Frontend Page Structure

Each of the 4 requirements maps to one frontend page following the PayrollRunsPage pattern:

| Page                     | Primary Component                    | Modal/Drawer                         | Key Action                          |
| ------------------------ | ------------------------------------ | ------------------------------------ | ----------------------------------- |
| VacationSchedulesPage    | Table + calendar view toggle         | VacationScheduleModal (schedule new) | "Agendar Férias"                    |
| EmployeeAbsencesPage     | Table per employee                   | AbsenceModal (register)              | "Registrar Afastamento"             |
| EmployeeTerminationsPage | List with status badge               | TerminationWizard (3-step)           | "Processar Rescisão"                |
| PayrollProvisionsPage    | Monthly grid + cost center breakdown | (read-only)                          | "Calcular Provisões" (month picker) |

### Anti-Patterns to Avoid

- **Storing FGTS balance directly on the termination record**: The FGTS balance is held by Caixa Econômica Federal, not in the system. Store only the 8% × (months employed × salary) estimate as a reference figure — the actual balance comes from the GRRF that is generated for the bank.
- **Calculating vacation averages from scratch in the vacation module**: The payroll-runs module already stores approved timesheet aggregates in PayrollRunItem. Query those records to compute 12-month averages for HE and noturno — don't re-parse timesheets.
- **Using a single transaction for the entire monthly provision batch**: Same pattern as payroll runs — use per-employee transactions to prevent timeout on large farms.
- **IRRF on abono pecuniário**: TST OJ 386 confirmed — the pecuniary bonus (abono) is not subject to INSS or IRRF. Do not apply these taxes to it.
- **Using window.confirm() for rescisão confirmation**: CLAUDE.md forbids this. Use ConfirmDeleteModal (high criticality — rescisão is irreversible).

---

## Don't Hand-Roll

| Problem                                        | Don't Build           | Use Instead                                                      | Why                                                        |
| ---------------------------------------------- | --------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| INSS/IRRF on vacation/termination pay          | Custom tax calculator | `calculateINSS` + `calculateIRRF` from `payroll-engine.service`  | Already implemented, tested against official 2026 brackets |
| Holiday counting for aviso prévio              | Custom calendar       | `date-holidays` (already installed)                              | Handles national + state holidays used in Phase 27/28      |
| PDF generation for TRCT, vacation receipt      | Custom HTML-to-PDF    | `pdfkit` (already installed)                                     | Established pattern in 9+ modules; pdfkit-table for tables |
| Batch ZIP of documents                         | Custom archive        | `jszip` (already installed)                                      | Already used in payslip batch export                       |
| Email alerts (60 days before, 10 day deadline) | Polling loop          | Extend existing cron in `schedules/` or use cron.service pattern | Cron for contract expiry already established in Phase 25   |

**Key insight:** All computation is pure arithmetic that reuses the payroll engine. The "new" work in Phase 29 is: (1) the CLT-specific rules for each event type, (2) the database models to store them, and (3) frontend pages to expose them.

---

## Common Pitfalls

### Pitfall 1: Vacation Fractionation Rules (CLT Art. 134 §1)

**What goes wrong:** Allowing schedules that violate the minimum-5-days-per-fraction rule.
**Why it happens:** Treating vacation as a simple date range without validating each fraction.
**How to avoid:** Validate in the service: each fraction ≥ 5 days; at most one fraction < 14 days; total fractions ≤ 3; the largest fraction must be ≥ 14 days. One fraction must include DSR (Sunday).
**Warning signs:** User schedules 3 × 10 days (allowed) but one of them is 4 days (not allowed) → service returns 422.

### Pitfall 2: Doubling Period Calculation (CLT Art. 137)

**What goes wrong:** Calculating the "dobro" deadline from admission date instead of from the end of the acquisitive period.
**Why it happens:** Confusing admission anniversary with the end of the concessivo period.
**How to avoid:** acquisitivePeriod.endDate + 12 months = dobro deadline. Alert at (dobro_deadline - 60 days).

### Pitfall 3: Proportional Notice for Voluntary Resignation

**What goes wrong:** Applying Lei 12.506/2011 notice to voluntary resignations.
**Why it happens:** The law reads ambiguously — courts have ruled it applies to WITHOUT_CAUSE only.
**How to avoid:** Proportional notice (30+3/year) applies only to `WITHOUT_CAUSE`. For `VOLUNTARY`, the notice is 30 days (flat, CLT Art. 487) — or zero if the employer waives it.

### Pitfall 4: FGTS Penalty for Seasonal Termination (fim de safra)

**What goes wrong:** Applying 40% FGTS penalty to seasonal contract endings.
**Why it happens:** Treating SEASONAL_END like WITHOUT_CAUSE.
**How to avoid:** Lei 5.889/73 Art. 14 establishes that the end of a safra contract has no 40% FGTS penalty (the work was always expected to be temporary). Penalty = 0%.

### Pitfall 5: Decimal Rounding in Monthly Provisions

**What goes wrong:** salary / 12 accumulates floating-point errors across 12 months.
**Why it happens:** Not using Decimal.js or using `.toFixed()` at intermediate steps.
**How to avoid:** Use `Decimal.div(12).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)` for every provision record. Test with salaries like R$ 3.333,33 that don't divide evenly.

### Pitfall 6: VacationSchedule Conflicts with Harvest Calendar

**What goes wrong:** UI allows scheduling vacation during harvest peak without surfacing the conflict.
**Why it happens:** Harvest dates are in a different module (PlantingSeason / CropPlan) not joined in the vacation query.
**How to avoid:** The frontend calendar should make a best-effort to overlay known harvest/planting dates from the farm calendar. For Phase 29, a simpler approach is: query `PlantingOperation` or `CropHarvest` dates for the same farm and flag overlaps as warnings (not blocks). The requirement says "calendário visual evitando conflitos com datas de safra" — a visual warning suffices.

### Pitfall 7: Absence Impact on VacationAcquisitivePeriod

**What goes wrong:** Absences that reduce vacation entitlement (e.g., INSS leave > 6 months) are not reflected in daysEarned.
**Why it happens:** Absence and vacation modules are developed independently.
**How to avoid:** CLT Art. 133 I: absence > 30 days (non-legal) causes loss of vacation for that acquisitive period. CLT Art. 133 II: INSS leave > 6 months in the same period also reduces vacation. When creating/updating an EmployeeAbsence, trigger a recomputation of the overlapping VacationAcquisitivePeriod.daysEarned.

---

## Code Examples

### Acquisitive Period Initialization

```typescript
// Source: CLT Art. 130 — vacation earned proportionally per month
// Called when a new employee is admitted (Phase 25 creates the Employee record)
// This service creates the FIRST acquisitive period on the employee's admission date

async function initVacationPeriod(employeeId: string, admissionDate: Date, ctx: RlsContext) {
  return await withRlsContext(ctx, async (tx) => {
    await tx.vacationAcquisitivePeriod.create({
      data: {
        employeeId,
        startDate: admissionDate,
        endDate: addYears(admissionDate, 1),
        daysEarned: 30,
        daysTaken: 0,
        status: 'ACCRUING',
      },
    });
  });
}

// When a period completes (status ACCRUING → AVAILABLE), create the next one:
async function advancePeriod(periodId: string, ctx: RlsContext) {
  const period = await prisma.vacationAcquisitivePeriod.findUniqueOrThrow({
    where: { id: periodId },
  });
  await prisma.$transaction(async (tx) => {
    await tx.vacationAcquisitivePeriod.update({
      where: { id: periodId },
      data: { status: 'AVAILABLE' },
    });
    await tx.vacationAcquisitivePeriod.create({
      data: {
        employeeId: period.employeeId,
        startDate: period.endDate,
        endDate: addYears(period.endDate, 1),
        daysEarned: 30,
        status: 'ACCRUING',
      },
    });
  });
}
```

### Termination Calculation (pure function)

```typescript
// Source: CLT Art. 477–480, Lei 12.506/2011, Lei 13.467/2017 (acordo mútuo)
// All inputs are Decimal; no side effects; easily unit-testable

export function calculateTermination(input: TerminationInput, params: EngineParams): TerminationResult {
  const { admissionDate, terminationDate, terminationType, lastSalary, fgtsBalance,
          vacationVestedDays, vacationPropDays, monthsThirteenth, avgOvertime, avgNight } = input;

  // 1. Balance salary (days worked in last month)
  const daysWorkedLastMonth = terminationDate.getUTCDate();
  const daysInLastMonth = new Date(terminationDate.getUTCFullYear(),
    terminationDate.getUTCMonth() + 1, 0).getUTCDate();
  const balanceSalary = lastSalary.mul(daysWorkedLastMonth).div(daysInLastMonth).toDecimalPlaces(2);

  // 2. Proportional 13th (Art. 7 XXVIII — month ≥ 15 days counts)
  const thirteenthProp = lastSalary.add(avgOvertime).add(avgNight)
    .mul(monthsThirteenth).div(12).toDecimalPlaces(2);

  // 3. Vacation vested + prop + 1/3 bonus
  const dailyRate = lastSalary.div(30);
  const vacVested = dailyRate.mul(vacationVestedDays).mul(new Decimal('1.333333')).toDecimalPlaces(2);
  const vacProp   = dailyRate.mul(vacationPropDays).mul(new Decimal('1.333333')).toDecimalPlaces(2);

  // 4. Notice period (Lei 12.506/2011 — only WITHOUT_CAUSE)
  const noticeDays = terminationType === 'WITHOUT_CAUSE'
    ? calcNoticePeriodDays(admissionDate, terminationDate) : 0;
  const noticePay = terminationType === 'WITHOUT_CAUSE' && input.noticeType === 'COMPENSATED'
    ? lastSalary.mul(noticeDays).div(30).toDecimalPlaces(2) : new Decimal(0);

  // 5. FGTS penalty
  const fgtsPenalty = fgtsBalance.mul(FGTS_PENALTY[terminationType]).toDecimalPlaces(2);

  // 6. Total gross taxable (exclude FGTS penalty — not income)
  const grossTaxable = balanceSalary.add(thirteenthProp).add(vacVested).add(vacProp).add(noticePay);

  // 7. INSS + IRRF on gross taxable (same engine functions)
  const inss = calculateINSS(grossTaxable, params.inssBrackets, params.inssCeiling);
  const irrf = calculateIRRF({ grossSalary: grossTaxable, inssContribution: inss.contribution, ... });

  return { balanceSalary, thirteenthProp, vacVested, vacProp, noticePay,
           fgtsBalance, fgtsPenalty, grossTaxable, inssAmount: inss.contribution,
           irrfAmount: irrf.finalTax, netTotal: grossTaxable.sub(inss.contribution).sub(irrf.finalTax).add(fgtsPenalty) };
}
```

### Absence Payroll Impact Hook

```typescript
// When a payroll run processes an employee with an active absence, the run service
// needs to know: how many days were company-paid vs INSS-paid?

async function getAbsenceImpactForMonth(
  employeeId: string,
  referenceMonth: Date,
  tx: TxClient,
): Promise<AbsencePayrollImpact> {
  const monthStart = startOfMonth(referenceMonth);
  const monthEnd = endOfMonth(referenceMonth);

  const absences = await tx.employeeAbsence.findMany({
    where: {
      employeeId,
      startDate: { lte: monthEnd },
      OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
    },
  });

  let companyPaidDays = 0;
  let inssPaidDays = 0;
  let suspendedDays = 0;

  for (const abs of absences) {
    // ... compute overlap with the reference month, apply type rules
    // MEDICAL_CERTIFICATE: days 1-15 = company, no suspension
    // INSS_LEAVE: days 16+ = suspended (no salary), FGTS still deposited
    // WORK_ACCIDENT: days 1-15 = company, rest suspended, FGTS still deposited
  }

  return {
    companyPaidDays,
    inssPaidDays,
    suspendedDays,
    fgtsFullMonth: absences.some(
      (a) => a.absenceType === 'WORK_ACCIDENT' || a.absenceType === 'INSS_LEAVE',
    ),
  };
}
```

---

## Runtime State Inventory

This is a greenfield phase (new models, no rename/refactor). Runtime State Inventory is not applicable.

---

## Environment Availability

| Dependency    | Required By                     | Available | Version         | Fallback |
| ------------- | ------------------------------- | --------- | --------------- | -------- |
| Node.js       | Backend runtime                 | Yes       | v24.12.0        | —        |
| PostgreSQL    | Database                        | Yes       | 16 (via Prisma) | —        |
| pdfkit        | TRCT + vacation receipt PDF     | Yes       | 0.17.2          | —        |
| decimal.js    | All monetary calculations       | Yes       | 10.6.0          | —        |
| date-holidays | Aviso prévio business day count | Yes       | 3.26.11         | —        |
| jszip         | Batch TRCT export               | Yes       | 3.10.1          | —        |
| nodemailer    | Deadline alerts                 | Yes       | 8.0.1           | —        |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------- |
| Framework          | Jest (backend) + Vitest (frontend)                                                      |
| Config file        | `apps/backend/jest.config.cjs` (backend), `apps/frontend/vite.config.ts` (frontend)     |
| Quick run command  | `cd apps/backend && npx jest --testPathPattern="termination-calculation" --no-coverage` |
| Full suite command | `cd apps/backend && npx jest --no-coverage`                                             |

### Phase Requirements → Test Map

| Req ID    | Behavior                                                | Test Type   | Automated Command                       | File Exists? |
| --------- | ------------------------------------------------------- | ----------- | --------------------------------------- | ------------ |
| FERIAS-01 | Vacation payment calculation (CLT Art. 142)             | unit        | `npx jest vacation-schedules`           | ❌ Wave 0    |
| FERIAS-01 | Acquisitive period state machine                        | unit        | `npx jest vacation-schedules`           | ❌ Wave 0    |
| FERIAS-01 | Abono pecuniário exempt from INSS/IRRF (OJ 386)         | unit        | `npx jest vacation-schedules`           | ❌ Wave 0    |
| FERIAS-02 | Absence payroll impact matrix per type                  | unit        | `npx jest employee-absences`            | ❌ Wave 0    |
| FERIAS-02 | FGTS continues during INSS leave                        | unit        | `npx jest employee-absences`            | ❌ Wave 0    |
| FERIAS-03 | Notice period days per Lei 12.506/2011                  | unit        | `npx jest termination-calculation`      | ❌ Wave 0    |
| FERIAS-03 | FGTS penalty by termination type (incl. 0% safra)       | unit        | `npx jest termination-calculation`      | ❌ Wave 0    |
| FERIAS-03 | Total termination net calculation                       | unit        | `npx jest termination-calculation`      | ❌ Wave 0    |
| FERIAS-03 | Routes: PATCH /employee-terminations/:id/process        | integration | `npx jest employee-terminations.routes` | ❌ Wave 0    |
| FERIAS-04 | Monthly provision = salary/12 × 4/3                     | unit        | `npx jest payroll-provisions`           | ❌ Wave 0    |
| FERIAS-04 | Charges = provisionAmount × (20% + RAT + 8%)            | unit        | `npx jest payroll-provisions`           | ❌ Wave 0    |
| FERIAS-04 | Unique constraint on (employeeId, referenceMonth, type) | integration | `npx jest payroll-provisions.routes`    | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `cd apps/backend && npx jest --testPathPattern="(termination-calculation|vacation-schedules|employee-absences|payroll-provisions)" --no-coverage`
- **Per wave merge:** `cd apps/backend && npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/vacation-schedules/vacation-schedules.spec.ts` — covers FERIAS-01 calculation + fractionation rules
- [ ] `apps/backend/src/modules/employee-absences/employee-absences.routes.spec.ts` — covers FERIAS-02 CRUD + payroll impact
- [ ] `apps/backend/src/modules/employee-terminations/termination-calculation.service.spec.ts` — covers FERIAS-03 pure calculation functions (Lei 12.506/2011, FGTS penalty matrix)
- [ ] `apps/backend/src/modules/employee-terminations/employee-terminations.routes.spec.ts` — covers FERIAS-03 routes
- [ ] `apps/backend/src/modules/payroll-provisions/payroll-provisions.routes.spec.ts` — covers FERIAS-04 batch calculation + uniqueness

---

## State of the Art

| Old Approach                 | Current Approach                                          | When Changed  | Impact                                                                            |
| ---------------------------- | --------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------- |
| Notice period = flat 30 days | Lei 12.506/2011: 30 + 3/year (max 90)                     | November 2011 | Proportional notice now standard; system must use the formula                     |
| DIRF for IRRF reporting      | eSocial S-1200 + EFD-Reinf                                | 2025          | DIRF abolished — confirmed in REQUIREMENTS.md Out of Scope                        |
| Manual GRRF filling at Caixa | Digital GRRF via FGTS Digital (web service)               | 2023          | Phase 29 generates PDF guide; eSocial integration (Phase 31) handles transmission |
| Acordo mútuo unavailable     | Lei 13.467/2017 (Reforma Trabalhista): acordo mútuo legal | November 2017 | Must implement MUTUAL_AGREEMENT with 20% FGTS penalty + half notice               |

**Deprecated/outdated:**

- Homologação sindical para rescisões: dispensada (Reforma Trabalhista 2017 Art. 477 §1) — confirmed in REQUIREMENTS.md v2 ADV-04
- DIRF: abolished in 2025, data flows via eSocial — confirmed Out of Scope

---

## Open Questions

1. **Harvest calendar data source for FERIAS-01 conflict detection**
   - What we know: The requirement says "calendário visual evitando conflitos com datas de safra"
   - What's unclear: There is no single `HarvestCalendar` model; harvest dates are spread across `PlantingOperation.harvestDate` and `GrainHarvest.harvestDate`
   - Recommendation: Frontend queries the farm's planting/harvest dates for the selected year and overlays them as "busy" periods in the calendar (warnings, not blocks). Flag as advisory only to avoid over-engineering.

2. **FGTS Balance Source for GRRF**
   - What we know: The real FGTS balance is held by Caixa Econômica Federal, not in this system
   - What's unclear: Should the system compute an estimate or require the user to input the actual balance?
   - Recommendation: Compute the estimate (sum of 8% × monthly salaries from EmployeeSalaryHistory) and show it as a reference. The GRRF PDF instructs the employer to confirm the balance at the FGTS Digital portal. This is the standard approach for systems without direct Caixa API integration.

3. **Accounting Entry Format for FERIAS-04**
   - What we know: Phase 32 (INTEGR-02) is the full accounting integration; Phase 29 must not block on that
   - What's unclear: What minimal structure to store in `accountingEntryJson` so Phase 32 can consume it without a data migration
   - Recommendation: Store `{ debitAccount: "6.1.01", creditAccount: "2.2.01", amount: "1234.56", costCenterId: "uuid", description: "Provisão Férias - Nome - 2026-03" }` as the JSON schema. Phase 32 will read this field and post to the ledger.

---

## Project Constraints (from CLAUDE.md)

| Directive                                                           | Impact on Phase 29                                                                          |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Express 5: `req.params.id as string`                                | All new routes must cast params — never destructure without `as string`                     |
| Prisma enums typed, never `string`                                  | TerminationType, AbsenceType, etc. must be imported from `@prisma/client` in services       |
| Use `as const` on enum return values in tests                       | Mock data for TerminationType etc. needs `'WITHOUT_CAUSE' as const`                         |
| Decimal.max is static, not instance method                          | All monetary max/min use `Decimal.max(a, b)`                                                |
| Frontend types must mirror backend                                  | `apps/frontend/src/types/vacation.ts`, `termination.ts`, etc. must be created before hooks  |
| `null` vs `undefined`: Prisma uses `null`, inputs use `undefined`   | Form state uses `undefined`; DB read responses use `null`; conversion at hook boundary      |
| **ConfirmModal** for destructive actions — never `window.confirm()` | Rescisão (termination) processing: use `ConfirmDeleteModal` (high criticality)              |
| DM Sans headlines, Source Sans 3 body, JetBrains Mono for data      | TRCT and vacation receipt PDFs must use these fonts (or system-safe equivalents for pdfkit) |
| Touch targets 48×48px minimum                                       | All action buttons on mobile-accessible pages                                               |
| Lucide Icons (lucide-react for web)                                 | Use Calendar, UserX, AlertTriangle, FileText icons for the 4 new pages                      |
| Mobile-first CSS                                                    | New pages styled mobile-first with Tailwind                                                 |

---

## Sources

### Primary (HIGH confidence)

- Payroll engine source code: `apps/backend/src/modules/payroll-engine/payroll-engine.service.ts` — confirmed INSS/IRRF functions reusable for vacation/termination
- Prisma schema: `apps/backend/prisma/schema.prisma` — confirmed existing Employee, EmployeeSalaryHistory, EmployeeContract models available
- Backend package.json: confirmed pdfkit 0.17.2, decimal.js 10.6.0, date-holidays 3.26.11 all installed
- Phase 28 RESEARCH.md and PLAN.md: confirmed PayrollRun patterns, PDF service patterns, per-employee transaction isolation

### Secondary (MEDIUM confidence)

- CLT Arts. 130–145 (vacation), 477–480 (termination), 487 (notice) — standard Brazilian labor law, well-settled
- Lei 12.506/2011 (proportional notice) — widely documented, confirmed in multiple Brazilian HR system references
- Lei 13.467/2017 (mutual agreement termination) — confirmed MUTUAL_AGREEMENT type with 20% FGTS + half notice
- TST OJ 386 (abono pecuniário exempt from INSS/IRRF) — standard TST jurisprudence

### Tertiary (LOW confidence — validate before implementation)

- RAT percentage for rural: assumed 1% (grau de risco leve) — confirm with client's CNAE/FAP
- FGTS balance estimate formula (8% × historical salary sum) — verify against actual Caixa FGTS statement for accuracy

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries already installed, confirmed in package.json
- Architecture: HIGH — directly follows Phase 28 patterns (PayrollRun, payroll-engine reuse)
- Labor law rules: HIGH — CLT articles are well-settled; Lei 12.506/2011 is 15 years old
- Accounting provision format: MEDIUM — JSON stub approach is pragmatic but depends on Phase 32 consuming it correctly

**Research date:** 2026-03-25
**Valid until:** 2026-06-25 (stable — Brazilian labor law rarely changes mid-year; INSS/IRRF tables are already 2026 editions)
