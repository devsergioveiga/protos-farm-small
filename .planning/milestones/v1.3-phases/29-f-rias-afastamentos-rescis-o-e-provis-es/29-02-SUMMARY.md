---
phase: 29-f-rias-afastamentos-rescis-o-e-provis-es
plan: 02
subsystem: api
tags:
  [
    employee-terminations,
    rescisao,
    trct,
    grrf,
    pdfkit,
    prisma,
    decimal-js,
    clt,
    lei-12506,
    lei-13467,
  ]

requires:
  - phase: 29-f-rias-afastamentos-rescis-o-e-provis-es
    provides: 'Plan 01 — vacation schedules, absences, and payroll provisions foundation'
  - phase: 28-processamento-da-folha-mensal
    provides: 'payroll-engine.service (calculateINSS, calculateIRRF), EngineParams, loadEngineParams pattern, payroll-pdf.service pdfkit pattern'

provides:
  - 'termination-calculation.service: pure calcNoticePeriodDays (Lei 12.506/2011) and calculateTermination for all 5 types'
  - 'termination-pdf.service: generateTRCTPdf (TRCT — CLT Art. 477) and generateGRRFPdf (Lei 8.036/1990)'
  - 'employee-terminations.service: processTermination, confirmTermination, markAsPaid, listTerminations, getTrctPdf, getGrffPdf, getExpiringDeadlines'
  - 'employee-terminations.routes: 8 endpoints — POST create DRAFT, GET list/expiring/:id, PATCH /confirm /pay, GET /:id/trct /:id/grrf'
  - 'DRAFT→PROCESSED→PAID state machine with employee DESLIGADO transition on confirmation'
  - '36 tests passing across calculation unit tests and integration tests'

affects:
  - 29-f-rias-afastamentos-rescis-o-e-provis-es (frontend plan if any)
  - future HR reporting features

tech-stack:
  added: []
  patterns:
    - 'loadEngineParams — reuse payroll-runs pattern for INSS/IRRF tables'
    - 'terminationSelect const — typed select object shared between create and queries'
    - "pdfkit dynamic import — (await import('pdfkit')).default inside Promise<Buffer>"
    - 'Express 5 route ordering — /expiring and /:id/trct registered before /:id to prevent shadowing'

key-files:
  created:
    - apps/backend/src/modules/employee-terminations/termination-pdf.service.ts
    - apps/backend/src/modules/employee-terminations/employee-terminations.service.ts
    - apps/backend/src/modules/employee-terminations/employee-terminations.routes.ts
  modified:
    - apps/backend/src/app.ts
  reference:
    - apps/backend/src/modules/employee-terminations/employee-terminations.types.ts (Task 1)
    - apps/backend/src/modules/employee-terminations/termination-calculation.service.ts (Task 1)
    - apps/backend/src/modules/employee-terminations/termination-calculation.spec.ts (Task 1)
    - apps/backend/src/modules/employee-terminations/employee-terminations.routes.spec.ts (Task 1 stub, used in Task 2)

key-decisions:
  - 'FGTS penalty rates: WITHOUT_CAUSE=40%, MUTUAL_AGREEMENT=20%, others=0% (CLT Art. 18 §1 + Lei 13.467/2017)'
  - 'Notice period via Lei 12.506/2011: 30 + 3 days/year after first, capped at 90'
  - 'MUTUAL_AGREEMENT notice = ceil(full_notice / 2) per Lei 13.467/2017'
  - 'getUTCDate used for all date arithmetic (Phase 28 decision for pro-rata consistency)'
  - 'fgtsBalance can be manually overridden via fgtsBalanceOverride field (customer may have actual FGTS statement)'
  - 'getExpiringDeadlines uses raw prisma (no withRlsContext) with explicit organizationId filter — avoids nested RLS transaction'
  - 'Employee DESLIGADO transition done inside confirmTermination withRlsContext, not a separate call'

patterns-established:
  - 'TRCT PDF layout: title → employee section → termination details → calculation table with proventos/deductions/net → FGTS info → signatures'
  - 'GRRF PDF: simplified cover with FGTS balance, penalty rate, amount to deposit, payment deadline'

requirements-completed:
  - FERIAS-03

duration: 35min
completed: 2026-03-25
---

# Phase 29 Plan 02: Férias, Afastamentos, Rescisão e Provisões Summary

**Employee termination module with pure calculation (5 rescision types, Lei 12.506/2011 notice, 40%/20%/0% FGTS penalty), TRCT/GRRF PDF generation via pdfkit, DRAFT→PROCESSED→PAID state machine, and 36 tests passing**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-03-25T00:00:00Z
- **Completed:** 2026-03-25
- **Tasks:** 2 (Task 1 pre-committed as df184131, Task 2 committed as 040275a4)
- **Files modified:** 7 (4 created, 1 modified, 2 from Task 1)

## Accomplishments

- Pure calculation functions: `calcNoticePeriodDays` (30+3/yr capped at 90) and `calculateTermination` covering all 5 types (WITHOUT_CAUSE, WITH_CAUSE, VOLUNTARY, SEASONAL_END, MUTUAL_AGREEMENT) with correct FGTS penalty rates
- TRCT PDF with full legal layout (employer/employee data, calculation table, bruto/INSS/IRRF/líquido/FGTS penalty, signature block) and simplified GRRF cover page
- CRUD service with DRAFT→PROCESSED→PAID state machine; `confirmTermination` transitions employee to DESLIGADO and stamps processedAt
- 8 REST endpoints with proper Express 5 route ordering (/expiring and /:id/trct before /:id)
- 36 total tests passing (23 calculation unit tests + 13 integration tests)

## Task Commits

1. **Task 1: Termination calculation service** - `df184131` (feat)
2. **Task 2: Termination service, routes, PDF generation** - `040275a4` (feat)

**Plan metadata:** (docs commit — see state update)

## Files Created/Modified

- `apps/backend/src/modules/employee-terminations/termination-calculation.service.ts` — Pure functions: calcNoticePeriodDays, calculateTermination, FGTS_PENALTY map
- `apps/backend/src/modules/employee-terminations/employee-terminations.types.ts` — TerminationInput, TerminationResult, CreateTerminationInput, TerminationOutput, EmployeeData
- `apps/backend/src/modules/employee-terminations/termination-pdf.service.ts` — generateTRCTPdf, generateGRRFPdf using pdfkit dynamic import pattern
- `apps/backend/src/modules/employee-terminations/employee-terminations.service.ts` — processTermination, confirmTermination, markAsPaid, listTerminations, getTrctPdf, getGrffPdf, getExpiringDeadlines
- `apps/backend/src/modules/employee-terminations/employee-terminations.routes.ts` — 8 endpoints with employeeTerminationsRouter
- `apps/backend/src/app.ts` — Registered employeeTerminationsRouter

## Decisions Made

- **FGTS penalty**: WITHOUT_CAUSE=40%, MUTUAL_AGREEMENT=20% (Lei 13.467/2017), others=0%. These rates are in `FGTS_PENALTY` constant for single source of truth.
- **MUTUAL_AGREEMENT notice**: half of full notice rounded up (`Math.ceil(full/2)`).
- **fgtsBalanceOverride**: Optional field — if provided, uses the manual value (contador has the actual CAIXA FGTS statement). Otherwise estimates from 8% \* gross per payroll item.
- **getExpiringDeadlines** uses raw prisma (not withRlsContext) with explicit `organizationId` filter — cleaner for a simple alerting query without a full RLS transaction.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `tsc --noEmit` on full monorepo ran OOM (pre-existing issue on large codebase — 300+ modules). Used targeted `NODE_OPTIONS=--max-old-space-size=4096 tsc --noEmit --skipLibCheck` filtered to new files. Two minor TypeScript errors found and fixed: implicit `any` in reduce callback and unused `@ts-expect-error` directive.

## Known Stubs

None — all calculation values are wired from real DB data (salary history, vacation periods, payroll items).

## Next Phase Readiness

- Employee termination backend complete. Frontend can consume the 8 endpoints.
- TRCT/GRRF PDFs generate correctly with legal layout.
- Expiring deadline query ready for dashboard alerting.

---

_Phase: 29-f-rias-afastamentos-rescis-o-e-provis-es_
_Completed: 2026-03-25_

## Self-Check: PASSED

- termination-pdf.service.ts: FOUND
- employee-terminations.service.ts: FOUND
- employee-terminations.routes.ts: FOUND
- Commit df184131 (Task 1): FOUND
- Commit 040275a4 (Task 2): FOUND
