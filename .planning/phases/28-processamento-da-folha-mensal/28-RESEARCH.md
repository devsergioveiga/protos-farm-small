# Phase 28: Processamento da Folha Mensal - Research

**Researched:** 2026-03-24
**Domain:** Payroll processing, batch computation, PDF payslips, salary advances, 13th salary
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Wizard multi-step para iniciar folha: Step 1 (selecionar mês/ano e tipo: mensal/adiantamento/13º), Step 2 (preview com lista de colaboradores e status do ponto), Step 3 (confirmar/excluir colaboradores), Step 4 (processar). Permite recalcular individual antes de fechar.

**D-02:** Bloqueio granular por colaborador — colaboradores sem ponto (espelho) aprovado ficam em status "Pendente" na lista, não entram no processamento. Contador pode processar os demais e incluir os pendentes depois via recálculo. A folha inteira NÃO é bloqueada.

**D-03:** Estorno completo com rollback de CPs. Reverte status COMPLETED→REVERTED, cancela todas as Contas a Pagar geradas (status CANCELLED), destrói holerites, libera espelhos de ponto. Exige confirmação via ConfirmDeleteModal (digitar nome/referência da folha). Sem estorno parcial por colaborador nesta phase.

**D-04:** Layout clássico tabular — cabeçalho (empresa + colaborador + competência), tabela Proventos (rubricas + referência + valor), tabela Descontos (INSS, IRRF, VT, pensão, adiantamento), totais (bruto/descontos/líquido), rodapé com bases INSS/IRRF/FGTS. Usar pdfkit + pdfkit-table (já instalado).

**D-05:** Distribuição: email em lote ao fechar folha (se colaborador tem email cadastrado) + acesso na ficha do colaborador (web) e no app mobile. Histórico dos últimos 12 meses acessível.

**D-06:** Lote gera ZIP com PDFs individuais. Nomes: `holerite_2026-03_JOAO-SILVA.pdf`. Contador pode reenviar individual. Não gera PDF consolidado único.

**D-07:** Registro direto pelo contador (sem workflow de aprovação). Individual ou em lote (dia 15, 40% do salário). Limite configurável por organização (% máximo do salário). Gera recibo PDF automaticamente.

**D-08:** Cada adiantamento gera uma CP individual por colaborador com originType='SALARY_ADVANCE', vencimento = data do adiantamento. Desconto automático na folha como rubrica de desconto.

**D-09:** Tipo de run separado no mesmo módulo PayrollRun. runType = 'THIRTEENTH_FIRST' (1ª parcela até 30/nov, sem descontos) ou 'THIRTEENTH_SECOND' (2ª parcela até 20/dez, com INSS/IRRF). Mesmo wizard, mesma tabela de runs, cálculo diferente. Proporcional por meses trabalhados.

**D-10:** Médias de HE e noturno calculadas pela média dos meses trabalhados no ano. Soma total do ano / meses trabalhados. Usa dados dos timesheets aprovados. Padrão CLT art. 7º.

### Claude's Discretion

- Estrutura exata dos models Prisma (PayrollRun, PayrollRunItem, SalaryAdvance, Payslip, ThirteenthSalary)
- Endpoints REST e query params
- Implementação interna do wizard frontend (steps, validação, loading states)
- Template do recibo PDF de adiantamento
- Lógica de envio de email (nodemailer ou similar)
- Organização dos componentes frontend
- Lógica de DSR sobre horas extras

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOLHA-02 | Processamento em lote com cálculo automático, encargos patronais, preview, recálculo individual, bloqueio se ponto não aprovado, fechamento imutável com estorno | DepreciationRun state machine is the direct pattern; payroll-engine provides all calculation functions; timesheets.status=APPROVED is the gate |
| FOLHA-03 | Adiantamentos salariais: limite configurável, lote (dia 15, 40%), desconto automático na folha, recibo PDF, integração CP | payables.service + originType upsert pattern established; jszip + pdfkit ready; nodemailer ready |
| FOLHA-04 | Holerite PDF individual/lote, email ou app mobile, histórico 12 meses na ficha | pdfkit + pdfkit-table (needs install); jszip (installed); mail.service.ts ready; new tab on employee ficha |
| FOLHA-05 | 13º salário: duas parcelas com lógica diferente, proporcional, médias HE/noturno, recibo PDF, encargos | runType enum extension; timesheets aggregation already available in service |
</phase_requirements>

---

## Summary

Phase 28 implements the full monthly payroll processing cycle. The core backend domain is a `payroll-runs` module that mirrors the already-implemented `depreciation` module (PENDING → PROCESSING → CALCULATED → COMPLETED | ERROR state machine). The payroll engine (Phase 26) already provides all 7 pure calculation functions (INSS, IRRF, FGTS, salário-família, noturno rural, moradia/alimentação, evaluateFormula). Phase 27 delivers approved timesheets with HE/noturno totals. This phase's job is to orchestrate those pieces into a locked payroll run, emit individual payslip PDFs, send email, and create Contas a Pagar.

The primary complexity areas are: (1) the orchestrator service that iterates employees, reads timesheet data, calls engine functions, accumulates results per rubrica, and writes PayrollRunItem records atomically; (2) the immutable closure + rollback logic; (3) the 13th salary proportional calculation using historical timesheets; and (4) the pdfkit-based payslip PDF layout.

**Primary recommendation:** Model PayrollRun after DepreciationRun with individual per-employee transactions (not one big transaction), use originType upsert for CPs, use pdfkit (already installed) for PDFs with column-based layout matching the existing timesheet PDF pattern, and use the existing `mail.service.ts` for email distribution.

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdfkit | 0.17.2 | Payslip and advance receipt PDF generation | Already installed; used in 9+ modules for professional PDFs |
| jszip | 3.10.1 | ZIP bundle of individual payslip PDFs | Already installed; used in geo-parser |
| nodemailer | 8.0.1 | Batch email distribution of payslips | Already installed; mail.service.ts abstraction exists |
| decimal.js | 10.6.0 | All monetary arithmetic | Mandated project-wide; all payroll engine functions use it |
| date-fns | 4.1.0 | Month/date calculations (competência, pro-rata, 5th business day) | Already installed project-wide |
| Prisma 7 | 7.4.1 | ORM for new PayrollRun / PayrollRunItem / SalaryAdvance / Payslip models | Project ORM |

### pdfkit-table — NOT installed

**Important:** The CONTEXT.md mentions pdfkit-table but it is **not** in `apps/backend/package.json`. The existing timesheet PDF (timesheets.service.ts lines 796–830) draws tables manually using `doc.text()` with column width arrays. This is the established pattern. Use the same manual column approach for the payslip, OR install pdfkit-table.

**Recommendation:** Install pdfkit-table to make the rubrica table cleaner.

```bash
cd apps/backend && pnpm add pdfkit-table
cd apps/backend && pnpm add -D @types/pdfkit-table
```

Verify current version:
```bash
npm view pdfkit-table version
# Expected: ~0.1.99
```

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-holidays | 3.26.11 | Holiday calendars for DSR calculation | Already installed; used by time-calculations |
| expr-eval | 2.0.2 | Custom rubrica formula evaluation | Already installed in payroll-engine |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual pdfkit columns | pdfkit-table | pdfkit-table makes structured tables simpler — worth installing |
| jszip for zip | archiver | archiver not installed; jszip already installed and working |

---

## Architecture Patterns

### Recommended Module Structure

```
apps/backend/src/modules/
├── payroll-runs/
│   ├── payroll-runs.service.ts         # Orchestrator: batch, recalc individual, close, revert
│   ├── payroll-runs.routes.ts          # REST endpoints
│   ├── payroll-runs.routes.spec.ts     # Integration tests
│   ├── payroll-runs.types.ts           # Error class, I/O types
│   ├── payroll-calculation.service.ts  # Per-employee calculation (calls payroll-engine)
│   └── payroll-pdf.service.ts          # Payslip PDF generation
├── salary-advances/
│   ├── salary-advances.service.ts      # Individual + batch (day 15) advances
│   ├── salary-advances.routes.ts
│   ├── salary-advances.routes.spec.ts
│   └── salary-advances.types.ts
```

### Pattern 1: PayrollRun State Machine (mirrors DepreciationRun)

**What:** PayrollRun moves through states atomically; each employee is processed in its own transaction to avoid timeout on large payrolls.

**When to use:** All payroll run processing.

```typescript
// State machine: PENDING → PROCESSING → CALCULATED → COMPLETED | ERROR | REVERTED
// CALCULATED = all items computed, preview available, not yet finalized
// COMPLETED = finalized/closed, holerites emitted, CPs created
// REVERTED = estorno applied

// Per-employee transaction pattern (from depreciation-batch.service.ts)
for (const employee of employees) {
  await prisma.$transaction(async (tx) => {
    const item = await tx.payrollRunItem.create({ data: calculatedData });
    // upsert CP with originType + originId constraint
    await tx.payable.upsert({
      where: { originType_originId: { originType: 'PAYROLL_RUN_ITEM', originId: item.id } },
      create: { ...cpData },
      update: {},  // idempotent — do not overwrite on re-process
    });
  });
}
```

**Source:** `apps/backend/src/modules/depreciation/depreciation-batch.service.ts`

### Pattern 2: Timesheet Gate per Collaborator

**What:** Before computing a collaborator, check `timesheet.status === 'APPROVED'`. Those without approved timesheets get `itemStatus = 'PENDING_TIMESHEET'` in the run — they do NOT block the run.

```typescript
// From timesheets.types.ts — TimesheetStatus enum
// Gate: only APPROVED timesheets feed payroll computation
const timesheet = await tx.timesheet.findFirst({
  where: { employeeId, referenceMonth, organizationId, status: 'APPROVED' },
  select: { totalWorked: true, totalOvertime50: true, totalOvertime100: true, totalNightMinutes: true, totalAbsences: true }
});
if (!timesheet) {
  // Create item with status 'PENDING_TIMESHEET' — not computed
  return;
}
```

### Pattern 3: Payroll Calculation Orchestration

**What:** Per-employee calculation sequence using existing engine functions.

```typescript
// Sequence for MONTHLY run (from payroll-engine functions):
// 1. Get salary from EmployeeSalaryHistory (latest effectiveAt <= referenceMonth)
// 2. Calculate pro-rata if admissionDate within month
// 3. Calculate HE 50% = overtime50Minutes * hourlyRate * 0.5
// 4. Calculate DSR on HE: dsrValue = heValue * (weeklyRest / (totalDays - weeklyRest))
//    — DSR standard: monthly = 4 Sundays, or use totalHolidays+Sundays from date-holidays
// 5. calculateRuralNightPremium() for noturno
// 6. calculateRuralUtilityDeductions() for moradia/alimentação
// 7. grossSalary = base + HE50 + HE100 + DSR + noturno + salFamilia + utilityProvisions
// 8. calculateINSS(grossSalary, brackets, ceiling)
// 9. calculateIRRF({ grossSalary, inssContribution, dependents, alimony, ... })
// 10. calculateFGTS(grossSalary) — employer contribution (informativo)
// 11. discountAdvance = pending SalaryAdvance for this employee this month
// 12. netSalary = grossSalary - INSS - IRRF - VT - utilityDeductions - advances
// Employer charges: INSS 20% + RAT (variable) + FGTS 8% = creates separate CP

// Key: all math in Decimal, round to 2dp at end of each step
```

**Source:** `apps/backend/src/modules/payroll-engine/payroll-engine.service.ts`

### Pattern 4: CP Upsert for Idempotency

**What:** Contas a Pagar created via upsert with originType + originId unique constraint prevents duplicates on re-processing.

```typescript
// From STATE.md decision:
// "Payroll to Payables uses originType + originId upsert: Prevents duplicate CPs on re-processing"
// originType values for this phase:
//   'PAYROLL_RUN_ITEM'     — net salary CP per employee
//   'SALARY_ADVANCE'       — advance CP per employee
//   'PAYROLL_EMPLOYER_INSS' — INSS patronal CP per run
//   'PAYROLL_EMPLOYER_FGTS' — FGTS CP per run
// Due date rules:
//   net salary → 5th business day of following month
//   FGTS       → 7th of following month
//   INSS/IRRF  → 20th of following month
```

**Source:** `apps/backend/src/modules/payables/payables.service.ts` + STATE.md

### Pattern 5: pdfkit Payslip PDF Layout

**What:** Classic tabular holerite layout using pdfkit. Pattern matches timesheet PDF (manual column widths).

```typescript
// Dynamic import pattern (established in project):
const PDFDocument = (await import('pdfkit')).default;
const doc = new PDFDocument({ size: 'A4', margin: 50 });
const chunks: Buffer[] = [];
doc.on('data', (chunk: Buffer) => chunks.push(chunk));
doc.on('end', () => resolve(Buffer.concat(chunks)));

// Layout sections:
// 1. Cabeçalho: empresa (nome, CNPJ), colaborador (nome, CPF, cargo, admissão), competência
// 2. Tabela Proventos: [Código | Descrição | Referência | Valor]
// 3. Tabela Descontos: [Código | Descrição | Referência | Valor]
// 4. Totais: Total Proventos | Total Descontos | Salário Líquido
// 5. Rodapé: Base INSS | Base IRRF | FGTS (mês) | FGTS acumulado
// 6. Linha assinatura: "Declaro que recebi a importância líquida de R$ _____"

// Column widths (A4 usable = 495px with 50px margins):
const colWidths = [50, 200, 100, 100]; // código, descrição, referência, valor
```

**Source:** `apps/backend/src/modules/timesheets/timesheets.service.ts` lines 771–844

### Pattern 6: JSZip for Batch PDF Bundle

**What:** Generate ZIP with individual PDFs named `holerite_YYYY-MM_NOME-COLABORADOR.pdf`.

```typescript
import JSZip from 'jszip';

const zip = new JSZip();
for (const item of completedItems) {
  const pdf = await generatePayslipPdf(item);
  const filename = `holerite_${referenceMonth}_${item.employeeName.toUpperCase().replace(/\s+/g, '-')}.pdf`;
  zip.file(filename, pdf);
}
const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
```

**Source:** `apps/backend/src/modules/farms/geo-parser.ts` (JSZip usage pattern)

### Pattern 7: Email Distribution via mail.service.ts

**What:** Use existing `sendMail` with PDF attachment after run closes.

```typescript
import { sendMail } from '../../shared/mail/mail.service';

// Per employee with email:
await sendMail({
  to: employee.email,
  subject: `Holerite ${monthLabel} - ${orgName}`,
  text: `Segue em anexo seu holerite de ${monthLabel}.`,
  attachments: [{
    filename: `holerite_${referenceMonth}_${slugName}.pdf`,
    content: pdfBuffer,
    contentType: 'application/pdf',
  }],
});
```

**Source:** `apps/backend/src/shared/mail/mail.service.ts`

### Pattern 8: 13th Salary Calculation

**What:** Two separate runTypes in the same PayrollRun model. Proportional by months worked.

```typescript
// Months worked = months from admissionDate (or Jan 1 if older) to Nov 30/Dec 31
// proportionalFactor = monthsWorked / 12  (round down partial months per CLT)

// HE/noturno averages:
// Fetch all APPROVED timesheets for the year (referenceYear)
// avgHE50 = sum(totalOvertime50) / monthsWorked
// avgHE100 = sum(totalOvertime100) / monthsWorked
// avgNight = sum(totalNightMinutes) / monthsWorked

// 1ª parcela (THIRTEENTH_FIRST): salary * proportionalFactor / 2
//   No INSS, no IRRF deductions. No CP for INSS/IRRF.
// 2ª parcela (THIRTEENTH_SECOND): full 13th with HE averages
//   grossThirteenth = (salary + heAvgs + nightAvg) * proportionalFactor
//   INSS on gross (separate bracket for 13th — same table)
//   IRRF on (gross - INSS - dependents)
//   Net = gross - INSS - IRRF - first_parcel_already_paid
```

### Anti-Patterns to Avoid

- **Single transaction for all employees:** Will timeout on payrolls > 50 employees. Use per-employee transactions like DepreciationRun.
- **Generating CPs without upsert:** Creates duplicates if run is retried after partial failure. Always upsert with originType + originId.
- **Blocking the full run for pending timesheets:** Per D-02, only individual employees are blocked, not the run. Create a `PENDING_TIMESHEET` item.
- **Storing PDF files on disk:** Use in-memory Buffer, return as response stream. Project has no file storage infrastructure for generated PDFs (uploads/ directory is for user uploads only).
- **Hardcoding DSR days:** Use date-holidays (already installed) to count Sundays + public holidays in the reference month.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| INSS progressive calculation | Custom bracket logic | `calculateINSS()` in payroll-engine | Already implemented with correct 2026 Portaria MPS/MF nº 13 values |
| IRRF with 2026 redutor | Custom IRRF logic | `calculateIRRF()` in payroll-engine | Lei 15.079/2024 redutor already implemented and unit-tested |
| FGTS calculation | Custom percentage logic | `calculateFGTS()` in payroll-engine | Handles ceiling correctly |
| Noturno rural premium | Custom night premium | `calculateRuralNightPremium()` in payroll-engine | Correct 21h-5h, 25%, 60min hour rules |
| Moradia/alimentação caps | Custom cap logic | `calculateRuralUtilityDeductions()` in payroll-engine | Correct Lei 5.889/1973 caps |
| Custom rubrica formulas | Custom evaluator | `evaluateFormula()` in payroll-engine | Uses expr-eval safely |
| Salary-família benefit | Custom eligibility check | `calculateSalaryFamily()` in payroll-engine | Correct income limits |
| Holiday detection for DSR | Custom calendar | date-holidays (installed) | Already instantiated in time-calculations |
| Email sending | Raw nodemailer setup | `sendMail()` in shared/mail/mail.service.ts | SMTP config wired, attachment support included |
| Duplicate CP prevention | Guard clauses | originType + originId unique constraint + upsert | Database-level idempotency |

**Key insight:** The payroll engine (Phase 26) was built precisely so Phase 28 does NOT have to implement calculations. PayrollRun is an orchestrator that calls these pure functions.

---

## Common Pitfalls

### Pitfall 1: Shadow DB out of sync for migrations

**What goes wrong:** `prisma migrate dev` fails because shadow DB doesn't match current schema.

**Why it happens:** Consistent issue across Phases 25, 26, 27 on this project.

**How to avoid:** Use established pattern: `prisma db push` to validate schema, then `prisma migrate resolve --applied <name>` after manually creating migration SQL.

**Warning signs:** Error message mentioning shadow database during `migrate dev`.

### Pitfall 2: Route shadowing — `/effective` vs `/:id`

**What goes wrong:** Express 5 route `/payroll-runs/:id` captures `/payroll-runs/preview` as id="preview".

**Why it happens:** Param routes are greedy.

**How to avoid:** Register specific named routes BEFORE param routes (established in Phase 26 for payroll-tables).

```typescript
// Correct order:
router.get('/payroll-runs/active', ...)        // specific first
router.get('/payroll-runs/:id', ...)            // param second
```

### Pitfall 3: DSR calculation divergence

**What goes wrong:** DSR (Descanso Semanal Remunerado) calculated as a fixed factor produces wrong values for months with different Sunday/holiday counts.

**Why it happens:** DSR formula varies by number of rest days in month.

**How to avoid:** Use date-holidays to count actual Sundays + national holidays in the reference month. Formula: `dsrValue = overtimeTotal * (restDays / (workDays))`.

### Pitfall 4: Payslip PDF not stored persistently

**What goes wrong:** Payslip endpoint returns PDF on demand but recalculation after run closes loses original values.

**Why it happens:** Run becomes immutable but PDF is regenerated from current data.

**How to avoid:** At close time, store `payslipPdfBuffer` as a Bytes field in PayrollRunItem (Prisma `@db.ByteA`), OR store the payslip JSON snapshot. Regenerating from snapshot ensures historical accuracy. Alternative (simpler): store serialized JSON rubrica lines in `PayrollRunItem.lineItemsJson`.

### Pitfall 5: req.params cast missing (Express 5)

**What goes wrong:** TypeScript error on `req.params.id`.

**Why it happens:** Express 5 params return `string | string[]`.

**How to avoid:** Always `const id = req.params.id as string` — mandated in CLAUDE.md.

### Pitfall 6: 13th salary — do not deduct advances from 1ª parcela

**What goes wrong:** Salary advances for November are deducted from both the monthly folha AND the 13th first parcel.

**Why it happens:** Advance deduction logic indiscriminately scans all pending advances.

**How to avoid:** For THIRTEENTH_FIRST and THIRTEENTH_SECOND, only deduct advances that were explicitly flagged as "desconto no 13º" — or simply: never deduct monthly salary advances from 13th salary parcelas (they are separate payroll events).

### Pitfall 7: pdfkit-table not installed

**What goes wrong:** `import pdfkitTable from 'pdfkit-table'` fails at runtime.

**Why it happens:** Package is mentioned in project notes but NOT in apps/backend/package.json (confirmed by inspection).

**How to avoid:** Either install it (`pnpm add pdfkit-table`), OR use the manual column approach already established in timesheets.service.ts (preferred if pdfkit-table install is risky).

---

## Code Examples

### PayrollRun State Machine Transition

```typescript
// Source: apps/backend/src/modules/depreciation/depreciation-batch.service.ts (adapted)

// State transitions for PayrollRun:
// PENDING     → PROCESSING   (when batch starts)
// PROCESSING  → CALCULATED   (all items computed, preview ready)
// CALCULATED  → COMPLETED    (closed/finalized, holerites sent, CPs created)
// CALCULATED  → PROCESSING   (recalculate individual employee)
// COMPLETED   → REVERTED     (estorno)
// any state   → ERROR        (on unrecoverable exception)

const VALID_PAYROLL_TRANSITIONS = {
  START:     { PENDING: 'PROCESSING' },
  CALCULATE: { PROCESSING: 'CALCULATED' },
  CLOSE:     { CALCULATED: 'COMPLETED' },
  REVERT:    { COMPLETED: 'REVERTED' },
  ERROR:     { PROCESSING: 'ERROR', CALCULATED: 'ERROR' },
};
```

### Employee Salary Lookup

```typescript
// Get salary effective at reference month
const salaryRecord = await tx.employeeSalaryHistory.findFirst({
  where: {
    employeeId,
    effectiveAt: { lte: new Date(`${referenceYear}-${referenceMonth}-28`) },
  },
  orderBy: { effectiveAt: 'desc' },
  select: { salary: true },
});
// Fall back to contract salary if no history entry
const salary = salaryRecord
  ? new Decimal(salaryRecord.salary)
  : new Decimal(contract.salary);
```

### Pro-rata Calculation

```typescript
// Days worked in month for employees admitted mid-month
const daysInMonth = getDaysInMonth(referenceYear, referenceMonthNum);
const admissionDay = admissionDate.getDate();
const daysWorked = admissionDate.getMonth() === referenceMonthNum - 1
  && admissionDate.getFullYear() === referenceYear
  ? daysInMonth - admissionDay + 1
  : daysInMonth;
const proRataFactor = new Decimal(daysWorked).div(daysInMonth);
const proRataSalary = salary.mul(proRataFactor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
```

### Payable Creation with originType Upsert

```typescript
// Source: apps/backend/src/modules/payables/payables.types.ts + STATE.md
// PayableCategory.PAYROLL already exists in enum

await tx.payable.upsert({
  where: {
    // Requires @@unique([originType, originId]) constraint on Payable model
    originType_originId: {
      originType: 'PAYROLL_RUN_ITEM',
      originId: payrollRunItemId,
    },
  },
  create: {
    organizationId,
    farmId: employee.primaryFarmId,
    supplierName: employee.name,
    category: 'PAYROLL',
    description: `Salário ${monthLabel} - ${employee.name}`,
    totalAmount: netSalary.toDecimalPlaces(2),
    dueDate: fifthBusinessDay,
    status: 'PENDING',
    originType: 'PAYROLL_RUN_ITEM',
    originId: payrollRunItemId,
    costCenterItems: [],
  },
  update: {}, // idempotent
});
```

**Note:** Check if `originType` + `originId` unique constraint already exists on the Payable model from Phase 25 schema migration, or add it in Phase 28's migration.

### Email with PDF attachment

```typescript
// Source: apps/backend/src/shared/mail/mail.service.ts
import { sendMail } from '../../shared/mail/mail.service';

await sendMail({
  to: employee.email!,
  subject: `Holerite ${competenciaLabel} — ${orgName}`,
  text: `Prezado(a) ${employee.name},\n\nSegue em anexo seu holerite referente a ${competenciaLabel}.\n\nAtenciosamente,\n${orgName}`,
  attachments: [{
    filename: `holerite_${referenceMonth}_${normalizedName}.pdf`,
    content: pdfBuffer,
    contentType: 'application/pdf',
  }],
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat INSS rate | Progressive bracket accumulation | Phase 26 | Must use calculateINSS() — never hand-roll |
| Fixed IRRF table | 2026 redutor (Lei 15.079/2024) | Phase 26 | Must use calculateIRRF() with redutor params |
| Single PayrollRun transaction | Per-employee individual transactions | Phase 27 design (mirrors Phase 22 depreciation) | Prevents DB timeout on large payrolls |
| Payable originType as nullable | originType + originId unique constraint | Phase 25 schema | Enables upsert idempotency |

**Deprecated/outdated:**
- pdfkit-table note in STATE.md: listed as new dependency but NOT yet installed — install in Wave 0 or use manual columns.
- DIRF: abolished in 2025 per REQUIREMENTS.md Out of Scope section.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend runtime | ✓ | 24.12.0 | — |
| pdfkit | Payslip PDF | ✓ | 0.17.2 | — |
| jszip | ZIP bundle of PDFs | ✓ | 3.10.1 | — |
| nodemailer | Email distribution | ✓ | 8.0.1 | — |
| decimal.js | Monetary arithmetic | ✓ | 10.6.0 | — |
| date-fns | Date calculations | ✓ | 4.1.0 | — |
| date-holidays | DSR/overtime holiday calendar | ✓ | 3.26.11 | — |
| pdfkit-table | Structured PDF tables | ✗ | — | Use manual column layout (established pattern) |
| SMTP server | Email delivery in production | ✓ (configured) | localhost:1025 (dev) | Dev uses MailHog or null transport |

**Missing dependencies with no fallback:**
- None that block execution.

**Missing dependencies with fallback:**
- pdfkit-table: NOT installed. Either `pnpm add pdfkit-table` in Wave 0, or use manual column layout from timesheets.service.ts pattern. Manual approach is simpler and avoids a new dependency.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.7 + @swc/jest |
| Config file | apps/backend/jest.config.js |
| Quick run command | `cd apps/backend && pnpm jest --testPathPattern="payroll-runs" --no-coverage` |
| Full suite command | `cd apps/backend && pnpm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOLHA-02 | PayrollRun batch processes employees, creates items, gates on timesheet status | unit | `pnpm jest payroll-runs.routes.spec` | ❌ Wave 0 |
| FOLHA-02 | Estorno reverts COMPLETED→REVERTED, cancels CPs, unlocks timesheets | unit | `pnpm jest payroll-runs.routes.spec` | ❌ Wave 0 |
| FOLHA-02 | State machine transitions only allow valid paths | unit | `pnpm jest payroll-calculation.spec` | ❌ Wave 0 |
| FOLHA-02 | Pro-rata calculation correct for mid-month admission | unit | `pnpm jest payroll-calculation.spec` | ❌ Wave 0 |
| FOLHA-03 | Salary advance creates CP with correct originType | unit | `pnpm jest salary-advances.routes.spec` | ❌ Wave 0 |
| FOLHA-03 | Batch advance (day 15) creates advances for all active employees | unit | `pnpm jest salary-advances.routes.spec` | ❌ Wave 0 |
| FOLHA-04 | Payslip PDF generated with correct proventos/descontos | unit (buffer check) | `pnpm jest payroll-pdf.spec` | ❌ Wave 0 |
| FOLHA-05 | 13th salary THIRTEENTH_FIRST: no INSS/IRRF deductions | unit | `pnpm jest payroll-calculation.spec` | ❌ Wave 0 |
| FOLHA-05 | 13th salary proportional factor calculation | unit | `pnpm jest payroll-calculation.spec` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd apps/backend && pnpm jest --testPathPattern="payroll-runs|salary-advances|payroll-calculation|payroll-pdf" --no-coverage`
- **Per wave merge:** `cd apps/backend && pnpm test --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/payroll-runs/payroll-runs.routes.spec.ts` — FOLHA-02 routes
- [ ] `apps/backend/src/modules/payroll-runs/payroll-calculation.service.spec.ts` — calculation unit tests
- [ ] `apps/backend/src/modules/payroll-runs/payroll-pdf.service.spec.ts` — PDF buffer tests
- [ ] `apps/backend/src/modules/salary-advances/salary-advances.routes.spec.ts` — FOLHA-03 routes
- [ ] Migration file for new PayrollRun/PayrollRunItem/SalaryAdvance/Payslip models
- [ ] pdfkit-table install (optional): `cd apps/backend && pnpm add pdfkit-table`

---

## Prisma Model Design (Claude's Discretion)

The following model structures are recommended based on project patterns.

### PayrollRun

```prisma
model PayrollRun {
  id             String          @id @default(uuid())
  organizationId String
  referenceMonth DateTime        @db.Date        // First day of month: 2026-03-01
  runType        PayrollRunType                  // MONTHLY | ADVANCE | THIRTEENTH_FIRST | THIRTEENTH_SECOND
  status         PayrollRunStatus @default(PENDING)
  triggeredBy    String
  closedAt       DateTime?
  closedBy       String?
  revertedAt     DateTime?
  revertedBy     String?
  totalGross     Decimal?        @db.Decimal(14, 2)
  totalNet       Decimal?        @db.Decimal(14, 2)
  employeeCount  Int             @default(0)
  notes          String?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  organization Organization       @relation(...)
  items        PayrollRunItem[]

  @@unique([organizationId, referenceMonth, runType])
  @@map("payroll_runs")
}

enum PayrollRunType {
  MONTHLY
  ADVANCE
  THIRTEENTH_FIRST
  THIRTEENTH_SECOND
  @@map("payroll_run_type")
}

enum PayrollRunStatus {
  PENDING
  PROCESSING
  CALCULATED
  COMPLETED
  ERROR
  REVERTED
  @@map("payroll_run_status")
}
```

### PayrollRunItem

```prisma
model PayrollRunItem {
  id             String   @id @default(uuid())
  payrollRunId   String
  employeeId     String
  status         String   @default("CALCULATED")  // CALCULATED | PENDING_TIMESHEET | ERROR
  // Salary components (Decimal for all monetary)
  baseSalary     Decimal  @db.Decimal(10, 2)
  proRataDays    Int?
  overtime50     Decimal  @db.Decimal(10, 2)  @default(0)
  overtime100    Decimal  @db.Decimal(10, 2)  @default(0)
  dsrValue       Decimal  @db.Decimal(10, 2)  @default(0)
  nightPremium   Decimal  @db.Decimal(10, 2)  @default(0)
  salaryFamily   Decimal  @db.Decimal(10, 2)  @default(0)
  grossSalary    Decimal  @db.Decimal(10, 2)
  // Deductions
  inssAmount     Decimal  @db.Decimal(10, 2)  @default(0)
  irrfAmount     Decimal  @db.Decimal(10, 2)  @default(0)
  vtDeduction    Decimal  @db.Decimal(10, 2)  @default(0)
  housingDeduction Decimal @db.Decimal(10, 2) @default(0)
  foodDeduction  Decimal  @db.Decimal(10, 2)  @default(0)
  advanceDeduction Decimal @db.Decimal(10, 2) @default(0)
  otherDeductions Decimal @db.Decimal(10, 2)  @default(0)
  netSalary      Decimal  @db.Decimal(10, 2)
  // Employer charges (informativo)
  fgtsAmount     Decimal  @db.Decimal(10, 2)  @default(0)
  inssPatronal   Decimal  @db.Decimal(10, 2)  @default(0)
  // Rubrica line items snapshot for PDF
  lineItemsJson  Json?
  // PDF storage
  payslipBuffer  Bytes?
  payslipSentAt  DateTime?
  createdAt      DateTime @default(now())

  payrollRun PayrollRun @relation(...)
  employee   Employee   @relation(...)

  @@unique([payrollRunId, employeeId])
  @@map("payroll_run_items")
}
```

### SalaryAdvance

```prisma
model SalaryAdvance {
  id             String   @id @default(uuid())
  organizationId String
  employeeId     String
  referenceMonth DateTime @db.Date
  amount         Decimal  @db.Decimal(10, 2)
  advanceDate    DateTime @db.Date
  batchId        String?  // Groups same-day batch
  notes          String?
  payableId      String?  @unique  // CP gerado
  deductedInRunId String? // PayrollRunId onde foi descontado
  createdBy      String
  createdAt      DateTime @default(now())

  organization Organization @relation(...)
  employee     Employee     @relation(...)

  @@index([organizationId, referenceMonth])
  @@index([employeeId, referenceMonth])
  @@map("salary_advances")
}
```

---

## Endpoint Design (Claude's Discretion)

```
# PayrollRuns
POST   /org/:orgId/payroll-runs                     # Create run (step 1 wizard)
GET    /org/:orgId/payroll-runs                     # List runs (with filters: month, type, status)
GET    /org/:orgId/payroll-runs/:id                 # Get run details + items
POST   /org/:orgId/payroll-runs/:id/process         # Start batch processing (step 4)
POST   /org/:orgId/payroll-runs/:id/recalculate/:employeeId  # Recalculate individual
POST   /org/:orgId/payroll-runs/:id/close           # Finalize (CALCULATED → COMPLETED)
POST   /org/:orgId/payroll-runs/:id/revert          # Estorno (COMPLETED → REVERTED)
GET    /org/:orgId/payroll-runs/:id/payslips        # Download ZIP of all PDFs
GET    /org/:orgId/payroll-runs/:id/items/:itemId/payslip  # Download individual PDF

# SalaryAdvances
POST   /org/:orgId/salary-advances                  # Create individual advance
POST   /org/:orgId/salary-advances/batch            # Create batch (day 15, 40% rule)
GET    /org/:orgId/salary-advances                  # List advances (filter: month, employee)
GET    /org/:orgId/salary-advances/:id/receipt      # Download advance receipt PDF

# Employee payslip history (for ficha tab)
GET    /org/:orgId/employees/:id/payslips           # Last 12 months list
GET    /org/:orgId/employees/:id/payslips/:month    # Download specific payslip PDF
```

---

## Permission Considerations

The existing `payroll-params:read/write` module covers payroll configuration. For payroll runs (processing, closing, reverting), a new permission module is recommended: `payroll:close` for closure and reversal (high-criticality), or re-use `payroll-params:write` for consistency.

Pattern from CONTEXT.md: "HR endpoints use farms:read permission (hr module not yet in PermissionModule type)". Same approach can work for payroll runs — use `payroll-params:write` for MANAGER/FINANCIAL roles until a dedicated `payroll` module is added to PermissionModule.

---

## Frontend Integration Notes

### Sidebar Addition

Add to existing 'RH' group in `apps/frontend/src/components/layout/Sidebar.tsx`:
```typescript
{ to: '/payroll-runs', icon: Receipt, label: 'Folha de Pagamento' },
{ to: '/salary-advances', icon: Wallet, label: 'Adiantamentos' },
```

### New Routes in App.tsx

```typescript
<Route path="/payroll-runs" element={<PayrollRunsPage />} />
<Route path="/salary-advances" element={<SalaryAdvancesPage />} />
```

### Employee Ficha — New "Holerites" Tab

The COLAB-05 requirement (ficha completa) specifies holerites tab. Add to EmployeePage/EmployeeProfilePage a new tab that calls `GET /org/:orgId/employees/:id/payslips`.

### Wizard Pattern

Use the established modal/multi-step pattern. Header shows step indicator (1 of 4). Body is scrollable. Footer has Back/Next/Process buttons. State managed with `useState<WizardStep>` inside the component.

---

## Open Questions

1. **Payable model — does originType+originId unique constraint exist?**
   - What we know: STATE.md says "schema constraint added in Phase 25" but Payable model in schema.prisma (line 5665) shows `originType String?` without a visible @@unique
   - What's unclear: Was the @@unique actually added or only discussed?
   - Recommendation: Verify schema line ~5665 for Payable model @@unique constraint; if missing, add in Wave 0 migration

2. **Timesheet LOCKED status — set when?**
   - What we know: TimesheetStatus has LOCKED state; payrollRunId field exists on Timesheet; STATE.md says "time entries locked by payrollRunId"
   - What's unclear: Does LOCKED state get set on timesheet when PayrollRunItem is created, or when run CLOSES?
   - Recommendation: Lock (set payrollRunId + status=LOCKED) when PayrollRunItem is created for that employee; unlock on REVERT

3. **Payslip persistence strategy**
   - What we know: Run becomes immutable after COMPLETED; historical accuracy required
   - What's unclear: Store as Bytes in DB (simple but large) or JSON snapshot (smaller but requires re-render)
   - Recommendation: Store `lineItemsJson` (rubrica lines with amounts) + regenerate PDF on demand from snapshot; avoid Bytes column for large teams

4. **pdfkit-table: install or manual columns?**
   - What we know: Not installed; timesheet PDF uses manual columns successfully
   - Recommendation: Manual columns — zero new dependency, established pattern, faster implementation

---

## Sources

### Primary (HIGH confidence)

- `apps/backend/src/modules/payroll-engine/payroll-engine.service.ts` — All 7 calculation functions verified
- `apps/backend/src/modules/payroll-engine/payroll-engine.types.ts` — Type contracts for engine
- `apps/backend/src/modules/depreciation/depreciation-batch.service.ts` — State machine + per-employee tx pattern
- `apps/backend/src/modules/timesheets/timesheets.service.ts` — Timesheet gate + pdfkit PDF pattern
- `apps/backend/src/modules/payables/payables.service.ts` — CP upsert pattern
- `apps/backend/src/shared/mail/mail.service.ts` — Email with attachment
- `apps/backend/src/shared/rbac/permissions.ts` — Permission modules and role defaults
- `apps/backend/prisma/schema.prisma` (lines 7673–8175) — Employee, EmployeeContract, Timesheet, PayrollRubrica models verified
- `apps/backend/package.json` — Confirmed pdfkit 0.17.2, jszip 3.10.1, nodemailer 8.0.1 installed; pdfkit-table NOT installed
- `.planning/phases/28-processamento-da-folha-mensal/28-CONTEXT.md` — Locked decisions D-01 through D-10

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` — Project decisions for PayrollRun state machine, CP upsert, INSS progressive
- `apps/frontend/src/components/layout/Sidebar.tsx` — RH group structure confirmed
- `apps/frontend/src/types/payroll.ts` — Existing payroll types (rubricas only, no run types yet)

### Tertiary (LOW confidence)

- DSR calculation formula (Sundays/holidays ratio) — from CLT / labor law knowledge; needs validation against 2026 PONTO-03 implementation in time-calculations

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json; versions confirmed via npm view
- Architecture: HIGH — DepreciationRun pattern directly applicable; all engine functions confirmed; CP upsert confirmed
- Pitfalls: HIGH — shadow DB, route shadowing, and pdfkit-table issues are confirmed recurring problems in this codebase
- DSR formula: MEDIUM — standard CLT knowledge, consistent with date-holidays library already in use

**Research date:** 2026-03-24
**Valid until:** 2026-05-01 (stable stack; legal tables change annually in January)
