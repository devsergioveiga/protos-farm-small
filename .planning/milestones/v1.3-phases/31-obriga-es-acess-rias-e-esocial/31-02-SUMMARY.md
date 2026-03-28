---
phase: 31-obriga-es-acess-rias-e-esocial
plan: '02'
subsystem: tax-guides
tags: [payroll, tax-guides, fgts, inss, irrf, funrural, sefip, darf, gps, backend, frontend]
dependency_graph:
  requires: ['31-01']
  provides: ['tax-guides-module', 'TaxGuidesService', 'TaxGuidesPage', 'useTaxGuides']
  affects: ['payables-module']
tech_stack:
  added: []
  patterns:
    - 'PayrollRunItem aggregate for tax totals'
    - 'PayrollLegalTable effective-date lookup for FUNRURAL rate'
    - 'upsert with unique constraint (orgId+guideType+referenceMonth) for idempotency'
    - 'pdfkit for DARF/GPS PDF generation'
    - 'Fixed-width ASCII SEFIP .RE file generation'
    - 'originType TAX_GUIDE on Payable for financial integration'
key_files:
  created:
    - apps/backend/src/modules/tax-guides/tax-guides.service.ts
    - apps/backend/src/modules/tax-guides/tax-guides.routes.ts
    - apps/backend/src/modules/tax-guides/tax-guides.spec.ts
    - apps/frontend/src/hooks/useTaxGuides.ts
    - apps/frontend/src/pages/TaxGuidesPage.tsx
  modified:
    - apps/backend/src/app.ts
decisions:
  - 'Used payroll-params:read/write permissions (not payroll:read/manage) to match existing permission enum'
  - 'FUNRURAL uses PayrollLegalTable FUNRURAL type with scalarValues[key=rate] — falls back to 2.7% if no table found'
  - 'Due date weekend adjustment: Saturday+2 (Monday), Sunday+1 (Monday)'
  - 'SEFIP .RE uses FPAS 604 (rural employer with employed workers)'
  - 'Download button disabled when status=PENDING since file not yet generated'
  - 'taxGuidesRouter registered before employeesRouter in app.ts to avoid Express 5 route shadowing'
metrics:
  duration: ~20min
  completed: '2026-03-26T13:49:18Z'
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 1
  tests_added: 19
---

# Phase 31 Plan 02: Tax Guides Full Stack Summary

Tax guides module (ESOCIAL-01): backend service aggregating PayrollRunItem totals to generate FGTS/INSS/IRRF/FUNRURAL guides with downloadable files (SEFIP .RE, DARF PDF, GPS PDF), automatic Contas a Pagar creation with originType TAX_GUIDE, and frontend page with listing/filters/download.

## Tasks Completed

| Task | Name                                              | Commit   | Files                                                                   |
| ---- | ------------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| 1    | Tax guides backend service + routes + tests (TDD) | d8c84eab | tax-guides.service.ts, tax-guides.routes.ts, tax-guides.spec.ts, app.ts |
| 2    | Tax guides frontend page + hook                   | 519295bc | useTaxGuides.ts, TaxGuidesPage.tsx                                      |

## What Was Built

### Backend (`tax-guides.service.ts`)

`TaxGuidesService` class with 3 public methods:

1. **`generateGuides(orgId, input, userId)`** — Within `withRlsContext` transaction:
   - Aggregates `PayrollRunItem` for `fgtsAmount`, `inssAmount`, `irrfAmount`, `grossSalary`
   - FUNRURAL amount = `grossSalary_sum * rate / 100` where rate comes from `PayrollLegalTable` (type FUNRURAL, effective-date lookup), fallback 2.7%
   - Due dates: FGTS=7th, INSS/IRRF/FUNRURAL=20th of next month; weekends roll to Monday
   - Upserts `TaxGuide` (unique on orgId+guideType+referenceMonth — idempotent)
   - Upserts `Payable` with `originType: 'TAX_GUIDE'`, `category: 'TAXES'`
   - Returns array of `TaxGuideOutput` with computed `alertLevel`

2. **`listGuides(orgId, query)`** — Paginated listing with filters; computes `daysUntilDue` and `alertLevel` (danger ≤5, warning 6-10, none >10) for each guide

3. **`downloadGuide(orgId, guideId)`** — Generates file based on type:
   - FGTS → SEFIP .RE fixed-width ASCII (records 10/20/30/32/40/50/99, FPAS 604)
   - INSS/IRRF → DARF PDF via pdfkit (receita code, competencia, valor, CNPJ)
   - FUNRURAL → GPS PDF via pdfkit (code 2100, competencia, valor total)
   - Updates guide status to GENERATED after file generation

### Routes (`tax-guides.routes.ts`)

- `POST /org/:orgId/tax-guides/generate` — permission `payroll-params:write`
- `GET /org/:orgId/tax-guides` — permission `payroll-params:read`
- `GET /org/:orgId/tax-guides/:id/download` — permission `payroll-params:read`

Registered before `employeesRouter` in `app.ts` to avoid Express 5 route shadowing.

### Tests (`tax-guides.spec.ts`) — 19 tests

- 10 tests: `generateGuides` (4 types created, correct amounts per type, FUNRURAL table lookup, payable with TAX_GUIDE, due dates, weekend adjustment, idempotency)
- 5 tests: `listGuides` (alertLevel computed correctly for danger/warning/none, guideType filter)
- 4 tests: `downloadGuide` (SEFIP .RE buffer, DARF PDF, GPS PDF, 404 on missing guide)

### Frontend

**`useTaxGuides.ts`** — Hook following `usePayrollRuns` pattern:

- `fetchGuides(params)` — paginated list with optional filters
- `generateGuides(input)` — POST to /generate, sets successMessage
- `downloadGuide(id, type, month)` — `api.getBlob` + programmatic anchor click, correct extension (.RE for FGTS, .pdf for others)

**`TaxGuidesPage.tsx`** — Full listing page:

- Header with breadcrumb and "Gerar Guias" primary CTA
- Filters: month picker (competência), guide type dropdown, status dropdown
- Table columns: TIPO (badge), COMPETÊNCIA (MM/YYYY), VENCIMENTO (DD/MM/YYYY), VALOR (BRL), STATUS (chip), ALERTA (icon), AÇÕES (download button)
- Alert icons: `AlertTriangle` (yellow, warning ≤10 days), `AlertCircle` (red, danger ≤5 days) per D-03
- Download button disabled when `status === 'PENDING'`
- Empty state: FileText icon + description + "Gerar Guias" CTA
- Skeleton loading (4 pulse divs)
- `GenerateGuidesModal`: month picker + type checkboxes (no `window.confirm`)
- Accessible: semantic `<table>` with `<caption>`, `aria-label`, `aria-required`, `role="alert"` on errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Permission string mismatch**

- **Found during:** Task 1 TypeScript check
- **Issue:** Plan specified `payroll:manage` and `payroll:read` permissions, but the permission type enum uses `payroll-params:write` and `payroll-params:read` (matching payroll-runs.routes.ts pattern)
- **Fix:** Updated routes to use `payroll-params:write` and `payroll-params:read`
- **Files modified:** `apps/backend/src/modules/tax-guides/tax-guides.routes.ts`
- **Commit:** d8c84eab (part of same task commit)

**2. [Rule 1 - Bug] Decimal formatting — FUNRURAL amount "270" vs "270.00"**

- **Found during:** Task 1 test run
- **Issue:** `Decimal.toDecimalPlaces(2).toString()` returns "270" for whole numbers, not "270.00"
- **Fix:** Changed to `new Decimal(basis.mul(rate).div(100).toFixed(2))` for consistent 2-decimal string
- **Files modified:** `apps/backend/src/modules/tax-guides/tax-guides.service.ts`
- **Commit:** d8c84eab (part of same task commit)

## Known Stubs

None — all data flows from real PayrollRunItem aggregation through to frontend display.

## Self-Check: PASSED

All 5 created files exist. Both commits (d8c84eab, 519295bc) verified in git log.
