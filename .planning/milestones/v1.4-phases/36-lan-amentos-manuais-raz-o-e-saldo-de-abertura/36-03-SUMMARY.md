---
phase: 36-lan-amentos-manuais-raz-o-e-saldo-de-abertura
plan: '03'
subsystem: backend
tags: [accounting, ledger, razao-contabil, balancete, livro-diario, pdfkit, exceljs, tdd]
dependency_graph:
  requires: [36-01-journal-entries, phase-35-chart-of-accounts]
  provides: [ledger-razao, balancete-verificacao, livro-diario, pdf-csv-xlsx-exports]
  affects: [journal-entries, account-balances, chart-of-accounts]
tech_stack:
  added: []
  patterns:
    [
      sql-window-function-running-balance,
      synthetic-account-recursive-aggregation,
      pdfkit-pipe-response,
      exceljs-xlsx-buffer,
    ]
key_files:
  created:
    - apps/backend/src/modules/ledger/ledger.types.ts
    - apps/backend/src/modules/ledger/ledger.service.ts
    - apps/backend/src/modules/ledger/ledger.routes.ts
    - apps/backend/src/modules/ledger/ledger.routes.spec.ts
  modified:
    - apps/backend/src/app.ts
decisions:
  - 'Ledger running balance uses SQL window function SUM OVER (ORDER BY entryDate, entryNumber) starting from previousBalance — avoids N+1 and computes in single query'
  - 'previousBalance fetched from AccountBalance.closingBalance of the month before startDate — if no record exists, uses 0'
  - 'getTrialBalance aggregates synthetic accounts recursively via getAccountValues() — avoids double-counting in grandTotals by summing analytic-only accounts'
  - 'grandTotals splits by nature (DEVEDORA/CREDORA) for debit/credit columns — standard balancete format'
  - 'getDailyBook amount filter applied in service layer after Prisma query — simpler than raw SQL HAVING'
  - 'Export routes registered before data routes in ledger.routes.ts — prevents Express 5 param shadowing'
  - 'CSV export uses BOM + semicolon separator (Brazilian standard) with DD/MM/YYYY date format'
metrics:
  duration: '5 minutes'
  completed: '2026-03-27'
  tasks_completed: 2
  tests_added: 16
  files_created: 4
  files_modified: 1
---

# Phase 36 Plan 03: Ledger, Trial Balance, and Daily Book Summary

**One-liner:** Razão contábil com saldo progressivo via SQL window function, balancete de verificação 3 colunas com agregação sintética, e livro diário com exportação PDF/CSV/XLSX.

## What Was Built

### Task 1: Ledger Service + Types + Tests

Created `ledger.types.ts` with interfaces: `LedgerOutput`, `LedgerLine`, `TrialBalanceOutput`, `TrialBalanceRow`, `DailyBookOutput`, `DailyBookEntry`, and filter interfaces.

Created `ledger.service.ts` with 8 exported functions:

- **`getLedger`**: Fetches account info, computes `previousBalance` from `AccountBalance.closingBalance` of prior month, then runs a `$queryRaw` SQL window function (`SUM OVER (ORDER BY entryDate, entryNumber)`) that computes the running balance in a single query starting from `previousBalance`.

- **`getTrialBalance`**: Loads all active COA accounts + `AccountBalance` rows for the given fiscal year + month. Uses a recursive `getAccountValues()` helper to aggregate synthetic (parent) accounts from children. Computes `grandTotals` from analytic-only accounts to avoid double-counting. Returns `isBalanced` flag via `movementDebit === movementCredit` Decimal comparison.

- **`getDailyBook`**: Queries POSTED entries in date range with `include: { lines: { include: { account } } }`, supports optional `entryType` filter and `minAmount`/`maxAmount` service-layer filter.

- **`exportLedgerCsv`**: Builds BOM + semicolon CSV with headers `Data;Numero;Historico;Debito;Credito;Saldo`, dates in DD/MM/YYYY format.

- **`exportLedgerPdf`**: pdfkit A4 document with account header, saldo anterior, columnar table with D/C/Saldo, saldo final.

- **`exportTrialBalancePdf`**: pdfkit landscape A4 with 8-column balancete table, indentation by account level, totals row.

- **`exportTrialBalanceXlsx`**: ExcelJS workbook "Balancete" sheet with bold header row, green background, bold synthetic rows, currency format on numeric columns.

- **`exportDailyBookPdf`**: pdfkit with Termo de Abertura, entries grouped by lançamento with D/C lines, Termo de Encerramento footer.

### Task 2: Ledger Routes + app.ts Mount

Created `ledger.routes.ts` with 8 endpoints at `/api/org/:orgId/ledger/*`:

| Endpoint                     | Service                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| GET `/razao`                 | `getLedger`                                                                                    |
| GET `/razao/export/csv`      | `exportLedgerCsv` → `text/csv`                                                                 |
| GET `/razao/export/pdf`      | `exportLedgerPdf` → `application/pdf`                                                          |
| GET `/balancete`             | `getTrialBalance`                                                                              |
| GET `/balancete/export/pdf`  | `exportTrialBalancePdf` → `application/pdf`                                                    |
| GET `/balancete/export/xlsx` | `exportTrialBalanceXlsx` → `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| GET `/diario`                | `getDailyBook`                                                                                 |
| GET `/diario/export/pdf`     | `exportDailyBookPdf` → `application/pdf`                                                       |

All routes require `authenticate` + `checkPermission('financial:read')`. Export routes registered before data routes to prevent Express 5 param shadowing.

`ledgerRouter` mounted in `app.ts` at `/api`.

## Test Results

16/16 tests passing:

- Ledger returns running balance with correct structure
- Empty lines array returned when no entries
- 401 without auth (all 3 endpoints)
- LedgerError surfaces correct HTTP status code
- costCenterId filter passed through correctly
- CSV content-type and Content-Disposition correct
- PDF exports return `application/pdf`
- XLSX returns correct spreadsheet content-type
- Trial balance 3-column structure with isBalanced flag
- Daily book chronological entries with lines
- entryType filter passed through correctly

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — all data flows are wired to real DB queries. PDF and XLSX exports contain real data.

## Self-Check: PASSED

All created files exist on disk. Both task commits verified:

- `f7b6745a` — feat(36-03): ledger service with razao, balancete, and diario + exports
- `bf5fd25a` — feat(36-03): ledger routes + mount in app.ts
