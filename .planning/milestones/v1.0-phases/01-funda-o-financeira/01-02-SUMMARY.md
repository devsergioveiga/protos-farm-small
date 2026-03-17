---
phase: 01-funda-o-financeira
plan: 02
subsystem: api
tags: [bank-accounts, financial, express, prisma, pdfkit, exceljs, money, febraban]

# Dependency graph
requires:
  - phase: 01-funda-o-financeira/01-01
    provides: Money factory, FEBRABAN_BANK_MAP, BankAccount/BankAccountBalance/BankAccountFarm/FinancialTransaction Prisma models

provides:
  - 8 REST endpoints under /api/org/bank-accounts (CRUD + statement + export + dashboard)
  - BankAccountError class with statusCode
  - createBankAccount with atomic Prisma transaction (balance + OPENING_BALANCE transaction)
  - listBankAccounts with N:N farm filter via junction table
  - getStatement with date range and type filters
  - exportStatement returning Buffer for PDF/Excel/CSV
  - getDashboard aggregating balances by account type
  - 19 passing Jest tests

affects:
  - Plan 01-03 (frontend bank account UI consumes these endpoints)
  - Any future financial module (pattern: financial:* RBAC permissions)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'exportStatement pattern: delegate to format-specific private async functions (exportStatementPdf, exportStatementExcel, exportStatementCsv)'
    - 'Route ordering: /bank-accounts/dashboard and /bank-accounts/:id/statement/export BEFORE /:id and /:id/statement to avoid param capture'
    - 'Money factory used for all monetary arithmetic — no toNumber/parseFloat on Decimal values'
    - 'RBAC for financial module: financial:read/create/update/delete (uses existing financial PermissionModule)'

key-files:
  created:
    - apps/backend/src/modules/bank-accounts/bank-accounts.types.ts
    - apps/backend/src/modules/bank-accounts/bank-accounts.service.ts
    - apps/backend/src/modules/bank-accounts/bank-accounts.routes.ts
    - apps/backend/src/modules/bank-accounts/bank-accounts.routes.spec.ts
  modified:
    - apps/backend/src/app.ts (bankAccountsRouter registered)

key-decisions:
  - 'RBAC uses existing financial:* PermissionModule (not custom bank-accounts:* strings) — financial role already has full financial module access, no changes to permissions.ts needed'
  - 'exportStatement route does not call getBankAccount separately — accountId used directly for filename, avoiding extra DB call in test context'
  - 'Tasks 1 and 2 merged into single commit since export functions are part of same service file'

patterns-established:
  - 'exportStatementPdf uses dynamic import pdfkit (consistent with pesticide-prescriptions pattern)'
  - 'exportStatementExcel uses dynamic import exceljs (consistent with animals.service pattern)'
  - 'exportStatementCsv uses BOM prefix + semicolon separator for Brazilian Excel compatibility'
  - 'withRlsContext wraps all Prisma operations; prisma model accessed via (tx as any) for new models'

requirements-completed:
  - FN-01
  - FN-03

# Metrics
duration: 6min
completed: 2026-03-16
---

# Phase 1 Plan 02: Bank Accounts Backend Module Summary

**8-endpoint Express REST API for bank accounts with atomic balance initialization, N:N farm filtering, statement export (PDF/Excel/CSV), and dashboard — backed by 19 Jest tests**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-16T00:13:40Z
- **Completed:** 2026-03-16T00:19:40Z
- **Tasks:** 2 (merged into 1 commit)
- **Files modified:** 5

## Accomplishments

- Complete bank account CRUD with atomic Prisma transaction: creates BankAccount + BankAccountFarm junction records + BankAccountBalance + FinancialTransaction (OPENING_BALANCE) in a single withRlsContext call
- Statement export in three formats: PDF (pdfkit with header/table/footer), Excel (ExcelJS with bold headers), CSV (BOM + semicolon separator for Brazilian Excel)
- Dashboard endpoint aggregating currentBalance across all active accounts, grouped by BankAccountType, using Money factory for safe decimal arithmetic

## Task Commits

Both tasks implemented together (Task 2 export functions live in the same service file as Task 1):

1. **Tasks 1+2: Bank accounts module** - `7a63d65` (feat)

## Files Created/Modified

- `apps/backend/src/modules/bank-accounts/bank-accounts.types.ts` - BankAccountError, CreateBankAccountInput, UpdateBankAccountInput, StatementQuery, BankAccountOutput, DashboardOutput, ExportFormat
- `apps/backend/src/modules/bank-accounts/bank-accounts.service.ts` - createBankAccount, listBankAccounts, getBankAccount, updateBankAccount, deleteBankAccount, getStatement, exportStatement (PDF/Excel/CSV), getDashboard
- `apps/backend/src/modules/bank-accounts/bank-accounts.routes.ts` - Express Router with 8 endpoints, financial:\* RBAC, handleError pattern
- `apps/backend/src/modules/bank-accounts/bank-accounts.routes.spec.ts` - 19 Jest tests covering all endpoints and edge cases
- `apps/backend/src/app.ts` - bankAccountsRouter imported and registered

## Decisions Made

- Used existing `financial` PermissionModule (`financial:read`, `financial:create`, `financial:update`, `financial:delete`) instead of creating custom `bank-accounts:*` permissions. The `FINANCIAL` role already has full access to the `financial` module, and `MANAGER`/`ADMIN` inherit correctly.
- The `/dashboard` and `/:id/statement/export` routes are registered BEFORE `/:id` and `/:id/statement` to prevent Express parameter capture (standard route ordering pattern for this codebase).
- Tasks 1 and 2 were committed together since the export functions are private helpers inside the same `bank-accounts.service.ts` file — splitting would have created an intermediate broken state.

## Deviations from Plan

None - plan executed exactly as written. Both tasks implemented in sequence within the same commit.

## Issues Encountered

- Lint errors on initial commit: unused `auditService` import in spec, unused `VIEWER_PAYLOAD` constant, unused `TxClient` type import, and unused `toNumber` helper. All fixed inline before commit.
- Test fixture `DASHBOARD_OUTPUT.byType` was missing required `typeLabel` field (TypeScript caught this via tsc --noEmit). Fixed by adding typeLabel to fixture.

## User Setup Required

None - no external service configuration required. All dependencies (pdfkit, exceljs) were already installed in the project.

## Next Phase Readiness

- All 8 endpoints operational and tested
- BankAccountOutput type available for frontend type-sharing
- exportStatement returns Buffer with correct MIME type — ready to wire to frontend download
- Ready for Plan 01-03: bank account frontend UI (list, create, edit, statement view, export buttons)

---

_Phase: 01-funda-o-financeira_
_Completed: 2026-03-16_
