---
phase: 31-obriga-es-acess-rias-e-esocial
plan: "04"
subsystem: esocial-frontend-income-statements
tags:
  - esocial
  - income-statements
  - pdf-generation
  - rais-consistency
  - frontend
  - backend
dependency_graph:
  requires:
    - "31-03 (eSocial events backend — routes, service, XSD validator, state machine)"
    - "31-01 (EsocialEvent + IncomeStatement Prisma models)"
  provides:
    - "EsocialEventsPage with dashboard, group tabs, download/accept/reject/reprocess"
    - "IncomeStatementsService with PDF generation (RFB model), email send, RAIS consistency"
    - "IncomeStatementsPage with year filter, RAIS banner, table with download/send actions"
  affects:
    - "apps/backend/src/app.ts (incomeStatementsRouter registration)"
    - "apps/frontend sidebar (new pages added)"
tech_stack:
  added:
    - "pdfkit (income statement PDF generation — same as payslip-pdf.service.ts pattern)"
  patterns:
    - "useState+useCallback hook pattern (same as usePayrollRuns)"
    - "TDD: RED test → GREEN implementation → passing"
    - "withRlsContext for all DB operations"
    - "PayrollRunItem aggregation per employee per year"
    - "DIRF abolished 2025 — replaced by direct income statement distribution"
key_files:
  created:
    - apps/frontend/src/hooks/useEsocialEvents.ts
    - apps/frontend/src/pages/EsocialEventsPage.tsx
    - apps/backend/src/modules/income-statements/income-statements.service.ts
    - apps/backend/src/modules/income-statements/income-statements.routes.ts
    - apps/backend/src/modules/income-statements/income-statements.spec.ts
    - apps/frontend/src/hooks/useIncomeStatements.ts
    - apps/frontend/src/pages/IncomeStatementsPage.tsx
  modified:
    - apps/backend/src/app.ts (incomeStatementsRouter import + registration)
decisions:
  - "Used payroll-params:read/write permissions — same as payroll-runs routes (payroll:read/manage not in RBAC enum)"
  - "generateIncomePdf mentions DIRF abolition in section 7 per D-13 requirement"
  - "downloadEvent in useEsocialEvents uses raw fetch (not api.getBlob) to inspect Content-Type and distinguish XML download from XSD validation JSON error response"
  - "/rais-consistency registered before /:id in routes to prevent Express 5 route shadowing"
metrics:
  duration: "~13 minutes"
  completed_date: "2026-03-26"
  tasks: 3
  files_created: 7
  files_modified: 1
  tests_added: 12
  tests_passing: 12
---

# Phase 31 Plan 04: eSocial Events Frontend + Income Statements Full Stack Summary

eSocial management UI with dashboard/event table and complete income statement module generating official RFB-model PDFs from PayrollRunItem aggregation with RAIS consistency report.

## Tasks Completed

### Task 1: eSocial Events frontend page + hook (commit 830cc378)

**`useEsocialEvents.ts`** — hook with fetchEvents, fetchDashboard, generateBatch, downloadEvent, downloadBatch, updateStatus, reprocessEvent. `downloadEvent` uses raw `fetch` (not `api.getBlob`) to inspect Content-Type — returns `EsocialXsdError` when backend returns JSON validation errors instead of XML blob.

**`EsocialEventsPage.tsx`** — full page per D-09 and D-12:
- Dashboard cards row: Total Eventos, Pendentes (amber), Exportados (blue), Rejeitados (red)
- Group tabs: Tabela | Nao Periodicos | Periodicos | SST (per D-07)
- Event table with per-status action buttons:
  - PENDENTE: Download XML button (transitions to EXPORTADO)
  - EXPORTADO: Accept (CheckCircle) + Reject (XCircle) buttons
  - REJEITADO: Reprocess (RefreshCw) + View reason (Eye) buttons
- Rejection reason modal with required textarea (per D-11)
- XSD validation errors modal with field/message table using AlertTriangle icon (per D-06)
- Generate batch modal with event type selector and optional competencia
- Semantic table with aria-labels, role="tablist", role="dialog" on modals
- No `window.confirm` used

### Task 2a: Income statements backend — TDD (commits 43bf8409, 730e1b2e)

**RED (43bf8409):** 12 failing tests covering generateStatements aggregation, totalTaxable/totalInss/totalIrrf/totalExempt/dependentDeduction, downloadStatement PDF buffer, sendStatements email/skip, getRaisConsistency true/false.

**GREEN (730e1b2e):** Full implementation passing all 12 tests:

`IncomeStatementsService`:
- `generateStatements`: queries COMPLETED PayrollRuns for yearBase (Jan–Dec), aggregates PayrollRunItems per employee, upserts via unique `(organizationId, employeeId, yearBase)` constraint
- `generateIncomePdf`: pdfkit A4 PDF with 7 official sections per D-13 RFB model — fonte pagadora (CNPJ), beneficiaria (CPF/PIS), rendimentos tributaveis, deducoes (INSS + dependentes), IRRF retido, rendimentos isentos (salary-family + 13th first parcel), informacoes complementares (DIRF abolition note)
- `dependentDeduction = dependents.length * 2275.08` (annual IRRF table 2025/2026)
- `sendStatements`: generates PDF per employee, sends via sendMail with attachment, updates sentAt/sentTo, skips employees without email (per D-14)
- `getRaisConsistency`: counts S-2200/S-1200/S-2299 event coverage for active employees (per D-15)

`incomeStatementsRouter`: 5 routes with `/rais-consistency` registered before `/:id` to prevent Express 5 route shadowing. Registered in app.ts before employeesRouter.

### Task 2b: Income statements frontend page + hook (commit 281d5cfe)

**`useIncomeStatements.ts`** — hook with fetchStatements, generateStatements, downloadStatement, sendStatements, fetchRaisConsistency. Same useState+useCallback pattern.

**`IncomeStatementsPage.tsx`** — per D-12, D-15, D-16:
- Year selector (numeric input, min 2000, unlimited history per D-16)
- RAIS banner: explains eSocial replacement since 2023, "Verificar Consistencia" button, shows OK (green) or warning (amber) result with missing employee list (per D-15)
- Action buttons: "Gerar Informes" (primary) + "Enviar por Email" (secondary batch send per D-14)
- Table: COLABORADOR / CPF / ANO-BASE / TRIBUTAVEL / INSS / IRRF / ISENTOS / ENVIADO / ACOES
- Per-row Download PDF and Enviar por Email icon buttons (per D-14)
- Empty state with FileText icon and "Gerar Informes" CTA

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wrong permission names in income-statements.routes.ts**
- **Found during:** Task 2a TypeScript compilation
- **Issue:** Plan specified `payroll:manage` and `payroll:read` permissions which don't exist in the RBAC permissions.ts enum
- **Fix:** Changed to `payroll-params:write` and `payroll-params:read` matching the existing pattern in `payroll-runs.routes.ts`
- **Files modified:** `apps/backend/src/modules/income-statements/income-statements.routes.ts`
- **Commit:** 730e1b2e

**2. [Rule 1 - Bug] Implicit any types in service filter callbacks**
- **Found during:** Task 2a TypeScript compilation
- **Issue:** `employeeIds.filter((id) => ...)` callbacks inferred as `any` due to Prisma result type inference
- **Fix:** Added explicit `(id: string)` type annotations and `as string[]` cast
- **Files modified:** `apps/backend/src/modules/income-statements/income-statements.service.ts`
- **Commit:** 730e1b2e

## Known Stubs

None — all data sources are wired to real API endpoints. PDF generation uses pdfkit with real PayrollRunItem aggregation.

## Self-Check: PASSED

All 7 created files found on disk. All 4 commits verified in git log:
- 830cc378: feat(31-04): add eSocial events frontend page and hook
- 43bf8409: test(31-04): add failing tests for income-statements service
- 730e1b2e: feat(31-04): implement income statements backend
- 281d5cfe: feat(31-04): add income statements frontend page and hook
