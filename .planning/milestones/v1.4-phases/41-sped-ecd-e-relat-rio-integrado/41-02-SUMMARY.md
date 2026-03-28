---
phase: 41-sped-ecd-e-relat-rio-integrado
plan: 02
subsystem: financial-statements
tags: [integrated-report, pdf, pdfkit, financial-statements, backend]
dependency_graph:
  requires:
    - financial-statements (getDre, getBalanceSheet, getDfc)
    - Organization model (integratedReportNotes field from Plan 01 migration)
  provides:
    - integrated-report.service (generateIntegratedReport, saveNotes, getNotes)
    - integrated-report.routes (GET /download, PATCH /notes, GET /notes)
  affects:
    - app.ts (integratedReportRouter mounted)
tech_stack:
  added: []
  patterns:
    - pdfkit dynamic import buffer pattern (same as pesticide-prescriptions.service.ts)
    - Service mock pattern for route tests (same as sped-ecd.routes.spec.ts)
    - Intl.NumberFormat('pt-BR') for Brazilian currency formatting
key_files:
  created:
    - apps/backend/src/modules/financial-statements/integrated-report.service.ts
    - apps/backend/src/modules/financial-statements/integrated-report.routes.ts
    - apps/backend/src/modules/financial-statements/integrated-report.routes.spec.ts
  modified:
    - apps/backend/src/app.ts (integratedReportRouter import and mount)
decisions:
  - "Used await new Promise<Buffer>(...) pattern (not return new Promise) to properly type the buffer before assembling { buffer, filename } return object"
  - "generateIntegratedReport takes fiscalYearId without month — derives endMonth from fiscalYear.endDate for annual report perspective"
  - "DRE/BP/DFC data fetched with .catch(() => null) so PDF renders even when financial data is absent"
  - "integratedReportNotes already exists on Organization from Plan 01 migration — no new migration needed"
metrics:
  duration_seconds: 316
  completed_date: "2026-03-28"
  tasks_completed: 1
  tasks_total: 1
  files_created: 3
  files_modified: 1
  tests_added: 12
---

# Phase 41 Plan 02: Integrated Report PDF Backend Summary

pdfkit-based multi-section PDF report generator (capa+indice+DRE+BP+DFC+notas explicativas) with Brazilian R$ formatting and notes autosave CRUD endpoints.

## What Was Built

**generateIntegratedReport** — Async function that loads Organization, FiscalYear, and optionally a CostCenter name, fetches DRE/BP/DFC data for the fiscal year end month, and generates a 6-section A4 PDF using pdfkit buffer pattern. Returns `{ buffer: Buffer; filename: string }`.

**PDF Sections:**
1. Capa — org name, CNPJ (XX.XXX.XXX/XXXX-XX format), fiscal year, accountant name/CRC
2. Indice — table of contents with 4 items
3. DRE — sectioned income statement with ytd amounts in R$ Brazilian format, automatic page breaks, bold section totals
4. BP — ativo and passivo/PL groups with indicator box (liquidez corrente, endividamento geral, ROE, PL/ha)
5. DFC Metodo Direto — three activity sections (operacional/investimento/financiamento) with cash summary
6. Notas Explicativas — 3-4 auto-generated notes + optional org-specific notes from integratedReportNotes field

**formatBrl** — `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` wrapping function, exported for test use.

**saveNotes / getNotes** — Prisma CRUD for `integratedReportNotes` field on Organization model.

**integratedReportRouter** — Three endpoints:
- `GET /org/:orgId/integrated-report/download?fiscalYearId=...` — returns PDF buffer with application/pdf Content-Type
- `PATCH /org/:orgId/integrated-report/notes` — body `{ notesText: string }`, returns `{ ok: true }`
- `GET /org/:orgId/integrated-report/notes` — returns `{ notesText: string | null }`

All endpoints require `authenticate` + `checkPermission('financial:read')`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Promise return type mismatch — resolve(Buffer) vs expected { buffer, filename }**
- **Found during:** TypeScript type check
- **Issue:** Original structure used `return new Promise(...)` with `resolve(Buffer.concat(chunks))` but function return type is `Promise<{ buffer: Buffer; filename: string }>`
- **Fix:** Changed to `const buffer = await new Promise<Buffer>(...)` then `return { buffer, filename }` after the Promise
- **Files modified:** integrated-report.service.ts
- **Commit:** 0c665470

## Known Stubs

None. All endpoints return real data or gracefully handle absent fiscal data (catch → null → renders fallback message in PDF).

## Self-Check: PASSED
