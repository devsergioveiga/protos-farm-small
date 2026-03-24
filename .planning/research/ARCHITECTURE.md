# Architecture Research

**Domain:** HR and Rural Payroll module integrated into Protos Farm monolith
**Researched:** 2026-03-23
**Confidence:** HIGH — derived from direct analysis of existing codebase (schema 7400+ lines, all modules, cron/batch infrastructure, integration patterns from v1.0–v1.2)

---

## Context: Existing Architecture This Milestone Extends

This is the v1.3 milestone. All architectural contracts established in v1.0–v1.2 apply without exception.

| Existing Component | Relevance to HR/Payroll |
|--------------------|------------------------|
| `modules/payables/` + `tx.payable.create` pattern | Payroll run → Contas a Pagar (salários, FGTS, INSS, IRRF, FUNRURAL) |
| `modules/cost-centers/` + `validateCostCenterItems` (shared) | Labor cost allocated per farm/cost center |
| `modules/field-teams/` + `TeamOperation` + `TeamOperationEntry` | Existing hours data per worker per operation — time tracking integrates here |
| `modules/work-orders/` with `laborHours` + `laborCostPerHour` | Maintenance OS already tracks labor hours; employee link adds precision |
| `shared/cron/` with `node-cron` + Redis distributed lock | Payroll batch processing follows same pattern as depreciation batch |
| `modules/depreciation/` `DepreciationRun` state machine | `PayrollRun` model mirrors this: PENDING → PROCESSING → COMPLETED/ERROR |
| `withRlsContext` / `RlsContext` | Every new module follows this — no exceptions |
| `Money` factory (decimal.js) | All monetary computations: gross salary, deductions, net pay, provisions |
| `generateInstallments` (shared) | Payroll installment-like patterns (13th salary in two parcels) |
| `@xmldom/xmldom` (already installed) | eSocial XML generation — no new dep required |
| `pdfkit` (already installed) | Payslip PDF generation — no new dep required |
| `nodemailer` (already installed) | Payslip email delivery — no new dep required |
| `exceljs` (already installed) | RAIS/DIRF export, bulk employee import |
| `Producer` model | Employees belong to a farm under a producer; FUNRURAL linked to producer's tax regime |
| `modules/suppliers/` | Service providers (prestadores) reuse supplier entity for freelancers/contractors |

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Frontend (React 19)                               │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────────┐  ┌───────────┐  │
│  │ Employees /  │  │ Time Tracking   │  │ Payroll Run    │  │ Safety /  │  │
│  │ Contracts    │  │ Approval        │  │ Dashboard      │  │ eSocial   │  │
│  └──────┬───────┘  └────────┬────────┘  └───────┬────────┘  └─────┬─────┘  │
└─────────┼────────────────────┼────────────────────┼────────────────┼────────┘
          │  REST API          │                    │                │
┌─────────┼────────────────────┼────────────────────┼────────────────┼────────┐
│         │       Backend (Express 5 + TypeScript)   │                │        │
│  ┌──────▼──────────────────────────────────────────▼────────────────▼─────┐ │
│  │                    New HR/Payroll Modules                               │ │
│  │  employees  contracts  job-positions  time-entries  payroll-runs        │ │
│  │  payroll-items  rubrics  vacations  leaves  terminations               │ │
│  │  epi-deliveries  trainings  asos  esocial-events                       │ │
│  └────────────────────────────────┬────────────────────────────────────────┘ │
│                                   │ integration                              │
│  ┌────────────────────────────────▼────────────────────────────────────────┐ │
│  │                  Existing Modules (unchanged)                           │ │
│  │  payables  cost-centers  field-teams  work-orders  producers  farms     │ │
│  └────────────────────────────────┬────────────────────────────────────────┘ │
│                                   │                                          │
│  ┌────────────────────────────────▼────────────────────────────────────────┐ │
│  │              Batch Infrastructure (node-cron + Redis + Prisma)          │ │
│  │  payroll-batch.service  payroll-cron  esocial-queue  provision-cron     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
          │                                         │
┌─────────▼──────────────────┐     ┌───────────────▼─────────────────────────┐
│   Mobile (React Native +   │     │   PostgreSQL 16 + Prisma 7               │
│   Expo) — Time Tracking    │     │   New tables: employees, contracts,       │
│   with geolocation +       │     │   time_entries, payroll_runs,            │
│   offline sync             │     │   payroll_items, rubrics, etc.           │
└────────────────────────────┘     └─────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|---------------|----------------|
| `modules/employees/` | Employee master record — personal, fiscal, employment data | `employees.service.ts` + CRUD routes |
| `modules/contracts/` | Employment contracts (CLT, safra, intermitente, experiência, aprendiz) and salary history | `contracts.service.ts` — links Employee + Farm |
| `modules/job-positions/` | Job titles, salary bands, work schedules, headcount | `job-positions.service.ts` |
| `modules/time-entries/` | Time clock records: clock-in/out, geolocation, manual, linked to operation | `time-entries.service.ts`; mobile-first |
| `modules/time-approval/` | Espelho de ponto, approval workflow (mirrors `purchase-requests` approval pattern) | Reuses `approval-rules` infrastructure |
| `modules/payroll-runs/` | Payroll calculation engine + run orchestration + payslip PDF | `payroll-engine.service.ts` + `payroll-batch.service.ts` |
| `modules/payroll-items/` | Line-item breakdown per employee per run (rubrics, amounts, bases) | Owned by payroll-runs, not standalone routes |
| `modules/rubrics/` | Configurable earnings/deductions rubrics (INSS tables, IRRF tables, FUNRURAL %, rural specifics) | `rubrics.service.ts` — seeded with defaults, org-customizable |
| `modules/vacations/` | Vacation scheduling, calculation (30-day rural), fractionation | `vacations.service.ts` |
| `modules/leaves/` | Absences: medical leave, accident (CAT), maternity, license | `leaves.service.ts` |
| `modules/terminations/` | TRCT, homologação, GRRF, unemployment insurance | `terminations.service.ts` — complex multi-step |
| `modules/payroll-provisions/` | Monthly vacation + 13th-salary accrual with CC allocation (mirrors `maintenance-provisions` pattern) | `payroll-provisions.service.ts` |
| `modules/epi-deliveries/` | EPI delivery record per employee, expiry alerts | `epi-deliveries.service.ts` |
| `modules/trainings/` | NR-31 training matrix, certificates, expiry | `trainings.service.ts` |
| `modules/asos/` | ASO/PCMSO records, expiry alerts | `asos.service.ts` |
| `modules/esocial-events/` | eSocial XML generation, transmission log, status tracking | `esocial-xml.service.ts` + `esocial-transmission.service.ts` |
| `modules/hr-dashboard/` | HR KPIs: headcount, turnover, cost per CC, compliance score | `hr-dashboard.service.ts` |

---

## Recommended Project Structure

Backend additions (all under `apps/backend/src/`):

```
modules/
├── employees/
│   ├── employees.routes.ts
│   ├── employees.service.ts
│   ├── employees.types.ts
│   └── employees.routes.spec.ts
├── contracts/
│   ├── contracts.routes.ts
│   ├── contracts.service.ts
│   ├── contracts.types.ts
│   └── contracts.routes.spec.ts
├── job-positions/
│   ├── job-positions.routes.ts
│   ├── job-positions.service.ts
│   ├── job-positions.types.ts
│   └── job-positions.routes.spec.ts
├── time-entries/
│   ├── time-entries.routes.ts
│   ├── time-entries.service.ts
│   ├── time-entries.types.ts
│   └── time-entries.routes.spec.ts
├── time-approval/
│   ├── time-approval.routes.ts
│   ├── time-approval.service.ts
│   └── time-approval.types.ts
├── rubrics/
│   ├── rubrics.routes.ts
│   ├── rubrics.service.ts
│   └── rubrics.types.ts
├── payroll-runs/
│   ├── payroll-runs.routes.ts
│   ├── payroll-runs.service.ts        ← orchestration
│   ├── payroll-engine.service.ts      ← calculation engine (pure functions)
│   ├── payroll-batch.service.ts       ← async batch processor (mirrors depreciation-batch)
│   ├── payslip.service.ts             ← PDF generation (reuses pdfkit)
│   ├── payroll-runs.types.ts
│   └── payroll-runs.routes.spec.ts
├── payroll-provisions/
│   ├── payroll-provisions.routes.ts
│   ├── payroll-provisions.service.ts
│   └── payroll-provisions.types.ts
├── vacations/
│   ├── vacations.routes.ts
│   ├── vacations.service.ts
│   └── vacations.types.ts
├── leaves/
│   ├── leaves.routes.ts
│   ├── leaves.service.ts
│   └── leaves.types.ts
├── terminations/
│   ├── terminations.routes.ts
│   ├── terminations.service.ts        ← complex: TRCT + payable + eSocial S-2299
│   └── terminations.types.ts
├── epi-deliveries/
│   ├── epi-deliveries.routes.ts
│   ├── epi-deliveries.service.ts
│   └── epi-deliveries.types.ts
├── trainings/
│   ├── trainings.routes.ts
│   ├── trainings.service.ts
│   └── trainings.types.ts
├── asos/
│   ├── asos.routes.ts
│   ├── asos.service.ts
│   └── asos.types.ts
├── esocial-events/
│   ├── esocial-events.routes.ts
│   ├── esocial-events.service.ts      ← status + dashboard
│   ├── esocial-xml.service.ts         ← XML generation per event type
│   ├── esocial-transmission.service.ts ← HTTP send to gov API + status polling
│   └── esocial-events.types.ts
└── hr-dashboard/
    ├── hr-dashboard.routes.ts
    ├── hr-dashboard.service.ts
    └── hr-dashboard.types.ts

shared/cron/
├── payroll-provision.cron.ts          ← monthly accrual (mirrors maintenance-provision.cron.ts)
└── esocial-retry.cron.ts              ← retry failed eSocial transmissions
```

Frontend additions (all under `apps/frontend/src/`):

```
pages/
├── EmployeesPage.tsx                  ← list + EmployeeModal (create/edit)
├── EmployeeDetailPage.tsx             ← ficha completa (tabs: contrato, holerites, férias, EPIs, operações)
├── JobPositionsPage.tsx
├── TimeEntriesPage.tsx                ← espelho de ponto + approval flow
├── RubricsPage.tsx                    ← tabelas INSS/IRRF, parâmetros
├── PayrollRunsPage.tsx                ← list + trigger + status polling
├── PayrollRunDetailPage.tsx           ← per-employee breakdown, approve, download PDF
├── VacationsPage.tsx                  ← calendar view + scheduling modal
├── LeavesPage.tsx
├── TerminationsPage.tsx
├── EpiDeliveriesPage.tsx
├── TrainingsPage.tsx
├── AsosPage.tsx
├── EsocialEventsPage.tsx              ← status dashboard, retry
└── HrDashboardPage.tsx

types/
├── employee.ts
├── contract.ts
├── time-entry.ts
├── payroll.ts
├── vacation.ts
└── esocial.ts
```

Mobile additions (under `apps/mobile/`):

```
app/(app)/
├── time-clock.tsx                     ← clock in/out with geolocation
└── time-entries.tsx                   ← personal time history

services/db/
└── time-entry-repository.ts           ← offline SQLite store (mirrors operation-repository.ts)
```

---

## Architectural Patterns

### Pattern 1: PayrollRun State Machine (mirrors DepreciationRun)

**What:** Payroll processing is a multi-step computation that must not be partial. A `PayrollRun` record tracks state: `PENDING → PROCESSING → COMPLETED | ERROR`. The HTTP endpoint creates the run synchronously then hands off to a batch service that processes all employees for that competence period.

**When to use:** Any computation that touches many employees (monthly payroll, 13th salary, vacation batch recalculation).

**Trade-offs:** Requires polling or SSE for progress feedback. Simpler than a full queue (no BullMQ needed given existing Redis lock pattern works for depreciation).

**Example:**
```typescript
// payroll-runs.routes.ts
router.post('/', authenticate, requirePermission('hr:payroll:run'), async (req, res) => {
  const run = await createPayrollRun(ctx, input); // creates PENDING record
  void runPayrollBatch(run.id);                   // fire-and-forget, like depreciation cron
  res.status(202).json({ id: run.id, status: 'PENDING' });
});

// payroll-batch.service.ts — mirrors depreciation-batch.service.ts
export async function runPayrollBatch(runId: string): Promise<void> {
  const lockKey = `payroll:run:${runId}`;
  const locked = await redis.set(lockKey, '1', 'EX', 1800, 'NX');
  if (!locked) return;
  // ... fetch contracts, compute each employee, create PayrollItem rows, generate Payables in tx
}
```

### Pattern 2: Payroll → Payables Integration (mirrors asset-acquisitions pattern)

**What:** When a payroll run completes (or is approved), financial entries are created atomically in a transaction using `tx.payable.create` directly — never by calling `payables.service.createPayable()`. This avoids nested `withRlsContext` deadlocks.

**When to use:** Any payroll event that creates a financial obligation: monthly payroll, 13th salary parcels, termination payments, vacation payments, FGTS/INSS/IRRF guide generation.

**Critical:** Document this as the established pattern in the service file comment.

**Example:**
```typescript
// Inside payroll-batch.service.ts — inside prisma.$transaction(async (tx) => { ... })
// CRITICAL: tx.payable.create directly (NOT payables.service) to avoid deadlocks
await tx.payable.create({
  data: {
    organizationId,
    farmId,
    producerId: contract.producerId,
    supplierName: employee.fullName,
    category: 'PAYROLL',
    description: `Folha ${month}/${year} — ${employee.fullName}`,
    totalAmount: netPay,
    dueDate: paymentDate,
    installments: { create: [{ number: 1, amount: netPay, dueDate: paymentDate }] },
    costCenterItems: { create: ccItems },
  },
});
```

### Pattern 3: eSocial XML Generation (xmldom already available)

**What:** eSocial events are generated as XML strings using `@xmldom/xmldom` (already installed). Each event type (S-2200 admission, S-1200 payroll, S-2299 termination, etc.) has a dedicated generator function. Signed XML is transmitted to the eSocial REST API. The `EsocialEvent` model tracks transmission status.

**When to use:** Any employee lifecycle change that triggers a mandatory government notification.

**Trade-offs:** eSocial layout version S-1.3 (NT 05/2025) must be targeted — not the older S-1.0/S-1.1. Digital certificate (A1 PKCS#12) is needed for production; bypass with unsigned XML in development/staging.

**Example:**
```typescript
// esocial-xml.service.ts
export function generateS2200(employee: EmployeeForEsocial): string {
  const doc = new DOMImplementation().createDocument(
    'http://www.esocial.gov.br/schema/evt/evtAdmissao/v03_00_00',
    'eSocial', null
  );
  // ... build XML tree using xmldom
  return new XMLSerializer().serialize(doc);
}
```

### Pattern 4: Time Entry → Payroll Linkage

**What:** `TimeEntry` records link to `Employee` and optionally to a `TeamOperationEntry` (existing model). The payroll engine aggregates approved time entries for the competence period to compute worked hours, overtime, night premium (21h–5h rural), and hour bank delta. This is a read-only integration — the payroll engine reads `TeamOperationEntry` but never writes to it.

**When to use:** Monthly payroll computation and time-based cost allocation per operation.

**Trade-offs:** Requires a migration to add `employeeId` as nullable FK on `TeamOperationEntry` (or a join table). Mobile time entries sync through the same offline queue as operations.

### Pattern 5: Mobile Offline Time Clock

**What:** Clock-in/out with geolocation captured on mobile. Stored in SQLite via a new `time-entry-repository.ts` (mirrors `operation-repository.ts`). Synced via the existing offline queue with operation type `TIME_ENTRY`. Backend validates geo-fence against the employee's assigned farm.

**When to use:** All field worker time tracking.

**Trade-offs:** Geo-fence validation happens server-side on sync; offline mode accepts any clock-in and flags for supervisor review if outside boundaries.

---

## Data Flow

### Payroll Run Flow (Primary Flow)

```
HR Manager triggers run (POST /payroll-runs)
        ↓
Creates PayrollRun { status: PENDING }  → responds 202
        ↓
runPayrollBatch(runId) — async, Redis-locked
        ↓
For each active contract in competence period:
    1. Aggregate approved TimeEntries → workedHours, overtimeHours, nightHours
    2. Apply rubric tables: gross = baseSalary + overtime + nightPremium + alimentação + moradia
    3. Compute INSS bracket → inssDeduction
    4. Compute IRRF bracket (after INSS) → irrfDeduction
    5. Compute FUNRURAL (patronal, on gross) → funruralAmount
    6. Compute FGTS (8% of gross) → fgtsAmount
    7. net = gross - inssDeduction - irrfDeduction - advanceDeductions
    8. Create PayrollItem record
        ↓
prisma.$transaction:
    9. Update PayrollRun { status: PROCESSING → COMPLETED }
   10. tx.payable.create per employee (category: PAYROLL, dueDate: payment date)
   11. tx.payable.create for INSS guide (category: TAXES)
   12. tx.payable.create for FGTS guide (category: TAXES)
   13. tx.payable.create for IRRF guide (category: TAXES)
        ↓
Trigger eSocial S-1200 event generation (async, non-blocking)
        ↓
Frontend polls GET /payroll-runs/:id → shows COMPLETED + summary
```

### Time Entry Sync Flow (Mobile)

```
Worker clocks in on mobile (offline or online)
        ↓
time-entry-repository.ts → SQLite local store
        ↓ (on connectivity)
offline-queue.ts → POST /time-entries/sync (batch)
        ↓
Backend: validate geo-fence, detect overlaps, flag anomalies
        ↓
TimeEntry records created with status PENDING_APPROVAL
        ↓
Supervisor reviews espelho de ponto → APPROVED
        ↓
PayrollEngine reads APPROVED entries for period
```

### eSocial Event Flow

```
Employee lifecycle event occurs (hire, payroll, termination, leave)
        ↓
Corresponding module calls createEsocialEvent(type, referenceId)
        ↓
EsocialEvent created { status: PENDING, xmlContent: null }
        ↓
esocial-retry.cron.ts (or immediate trigger):
    generateXML(event) → xmlContent
    transmitToGov(xmlContent) → receiptNumber | error
        ↓
EsocialEvent updated { status: TRANSMITTED | ERROR, receiptNumber, sentAt }
        ↓
Poll government API for processing result → PROCESSED | REJECTED
        ↓
Dashboard shows compliance status per event type
```

### Vacation Provision Flow (mirrors maintenance-provision pattern)

```
payroll-provision.cron.ts → runs monthly (1st of month, 3am)
        ↓
For each org → for each active contract:
    vacationProvision = grossSalary / 12 * (1 + 1/3)
    thirteenthProvision = grossSalary / 12
        ↓
Create PayrollProvision records for accrual tracking
        ↓
Future: tx.payable.create when vacation is actually paid out
```

---

## Integration Points

### New Modules → Existing Modules

| Integration | Direction | Mechanism | Notes |
|-------------|-----------|-----------|-------|
| `payroll-runs` → `payables` | Payroll creates CP | `tx.payable.create` inside `$transaction` | CRITICAL: not via `payables.service` |
| `payroll-runs` → `cost-centers` | Labor cost rateio | `validateCostCenterItems` from `@protos-farm/shared` | Same as all other CC allocations |
| `time-entries` → `field-teams` (`TeamOperationEntry`) | Link hours to operations | Read-only FK: `timeEntryId` on `TeamOperationEntry` | Migration adds nullable FK |
| `employees` → `producers` | Employee's CPF/fiscal link | `Employee.producerFarmLinkId` optional FK | Safristas tied to producer's rural fiscal entity |
| `contracts` → `farms` | Employee assigned to farm | `Contract.farmId` FK | Drives FUNRURAL calculation and CC |
| `terminations` → `payables` | TRCT creates CP | Same `tx.payable.create` pattern | Plus GRRF guide payable |
| `asos` → notifications | Expiry alert | `shared/cron` polls, uses existing notifications module | Same pattern as stock-alerts |
| `epi-deliveries` → products | EPI items from stock | `Product.productType = 'EPI'` filter | Reuses product catalog, no separate table |

### New Modules → External Systems

| External System | Integration Pattern | Library | Notes |
|----------------|---------------------|---------|-------|
| eSocial REST API (gov.br) | HTTP POST XML, poll for result | `node-fetch` or `https` built-in | Requires PKCS#12 cert for production |
| eSocial XML Schema S-1.3 | XML generation | `@xmldom/xmldom` (already installed) | Target NT 05/2025 layout |
| Payslip PDF | PDF generation | `pdfkit` (already installed) | Mirror `pesticide-prescriptions` PDF pattern |
| Payslip email | Email delivery | `nodemailer` (already installed) | Mirror `notifications` pattern |
| Bulk employee import | XLSX/CSV parse | `exceljs` (already installed) | Mirror `animals` bulk import pattern |

### Modifications to Existing Models

| Model | Change | Rationale |
|-------|--------|-----------|
| `PayableCategory` enum | Already has `PAYROLL` + `TAXES` — no change needed | Payroll payables use existing categories |
| `TeamOperationEntry` | Add nullable `timeEntryId String?` FK | Links official time record to team operation entry |
| `Organization` | Add HR-related relation collections | Standard pattern for all new models |
| `Farm` | Add `employees` relation | Each farm has contracted employees |
| `User` | Add nullable `employeeId String?` FK | Maps system users to employee records (optional) |

---

## Build Order (Dependency-Respecting)

Dependencies flow top-down. Each group can only start after the previous group is complete.

### Group 1 — Foundation (no dependencies on new modules)
- `job-positions` — standalone master data (cargos, faixas salariais)
- `rubrics` — standalone configuration (INSS/IRRF/FUNRURAL tables)
- `employees` — core entity; depends only on existing `farms`, `producers`

### Group 2 — Contracts and Schedules (depends on Group 1)
- `contracts` — depends on `employees`, `job-positions`, `farms`
- `time-entries` (backend model + sync endpoint) — depends on `employees`, `contracts`

### Group 3 — Time Approval and Mobile (depends on Group 2)
- `time-approval` — depends on `time-entries`, reuses `approval-rules` infrastructure
- Mobile `time-clock` screen — depends on `time-entries` sync endpoint

### Group 4 — Payroll Engine (depends on Groups 1-3)
- `payroll-runs` — depends on all above + `payables`, `cost-centers`
- `payroll-provisions` cron — depends on `payroll-runs` models

### Group 5 — Lifecycle Events (depends on Groups 1-4)
- `vacations` — depends on `contracts`, `payroll-runs`
- `leaves` — depends on `employees`, `contracts`
- `terminations` — depends on `employees`, `contracts`, `payroll-runs`, `payables`
- Salary advance (`payroll-runs` sub-feature) — depends on `payroll-runs`

### Group 6 — Compliance and Safety (depends on Group 1, mostly standalone)
- `epi-deliveries` — depends on `employees`, `products` (EPI type)
- `trainings` — depends on `employees`
- `asos` — depends on `employees`

### Group 7 — eSocial (depends on all above)
- `esocial-events` XML generation + transmission — depends on events from Groups 1-6
- `esocial-retry.cron.ts` — depends on `esocial-events`

### Group 8 — Reports and Dashboard (depends on all above)
- `hr-dashboard` — aggregates from all HR modules
- RAIS/DIRF export endpoints — depends on `payroll-runs`, `employees`
- Informe de rendimentos PDF — depends on `payroll-runs`

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–200 employees | node-cron batch is sufficient — same as depreciation. No BullMQ needed. |
| 200–2000 employees | Payroll batch may take 10–60s; acceptable. Add progress streaming via SSE if UX requires it. |
| 2000+ employees | Partition batch by farm (already possible with Redis lock per runId). BullMQ migration straightforward since Redis already present. |

### Scaling Priorities

1. **First bottleneck — payroll calculation time:** The engine is CPU-bound (tax bracket computation per employee). Solution: run in background (already the pattern), expose progress endpoint.
2. **Second bottleneck — eSocial transmission:** Gov API is slow and rate-limited. Solution: already async via cron. Add exponential backoff in `esocial-retry.cron.ts`.

---

## Anti-Patterns

### Anti-Pattern 1: Calling payables.service Inside Payroll Transaction

**What people do:** `await createPayable(ctx, payableInput)` inside a `prisma.$transaction()` block when finalizing payroll.

**Why it's wrong:** `createPayable` calls `withRlsContext` which opens a nested transaction. In Prisma 7 with PostgreSQL, nested `$transaction` calls with different clients deadlock.

**Do this instead:** Use `tx.payable.create(...)` directly inside the transaction, as established by `asset-acquisitions.service.ts` (the comment in that file is canonical).

### Anti-Pattern 2: Separate PayrollItem Routes

**What people do:** Create a full CRUD module for `PayrollItem` with its own routes.

**Why it's wrong:** Payroll items are owned by a payroll run. They are computed, not manually created. Exposing create/update routes invites data integrity issues.

**Do this instead:** `PayrollItem` has no create/update routes. Access is via `GET /payroll-runs/:id/items`. The payroll engine writes items atomically during the run.

### Anti-Pattern 3: Storing Calculated Tax Values as Business Logic in the DB

**What people do:** Put INSS/IRRF bracket tables as hardcoded values in the schema (enum or constant column).

**Why it's wrong:** Government updates brackets annually (sometimes mid-year). Hardcoded schema values require a migration for every table update.

**Do this instead:** `Rubric` model stores configurable tables with effective dates. The payroll engine fetches the rubric valid for the competence period. Seed data provides 2025 defaults; org can override.

### Anti-Pattern 4: One eSocial Module Doing Everything

**What people do:** Create one monolithic `esocial.service.ts` that handles admission, payroll, termination, leaves, and all other events.

**Why it's wrong:** Each event type has different data requirements, validation rules, and triggers. A single module becomes impossible to test and maintain.

**Do this instead:** Each module triggers its own eSocial event via a shared `createEsocialEvent(type, referenceId, orgId)` helper. The `esocial-events` module handles XML generation and transmission generically using the reference to load the required data.

### Anti-Pattern 5: Mixing Employee (RH) with User (Auth)

**What people do:** Add HR fields (CPF, PIS, bank account for salary) directly to the existing `User` model.

**Why it's wrong:** Many employees are not system users (field workers without smartphones). Many users are not employees (consultants, admins). Coupling them creates nullability explosion and auth complexity.

**Do this instead:** `Employee` is a separate entity. An optional `employeeId` FK on `User` links them when the person has both a system account and an employment contract. `Contract.createdBy` references `User.id`; `Contract.employeeId` references `Employee.id`.

---

## Sources

- Direct codebase analysis: `apps/backend/prisma/schema.prisma` (7400+ lines), `modules/asset-acquisitions/`, `modules/depreciation/`, `modules/field-teams/`, `modules/payables/`, `modules/maintenance-provisions/`
- Existing batch infrastructure: `shared/cron/depreciation.cron.ts` — DepreciationRun state machine pattern
- Integration contract: `asset-acquisitions.service.ts` comment on `tx.payable.create` deadlock avoidance
- eSocial layout: [Brazil eSocial NT 05/2025 production](https://mercans.com/resources/statutory-alerts/brazil-esocial-layout-update-nt-05-2025-moves-to-production/) — S-1.3 schema
- eSocial events S-1200/S-2200: [@xmldom/xmldom](https://www.npmjs.com/package/@xmldom/xmldom) — already in backend package.json
- Brazilian rural labor: Lei 5.889/73, NR-31, FUNRURAL Lei 10.256/2001

---

*Architecture research for: HR and Rural Payroll module (v1.3), Protos Farm monolith*
*Researched: 2026-03-23*
