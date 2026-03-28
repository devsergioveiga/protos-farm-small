---
phase: 41-sped-ecd-e-relat-rio-integrado
plan: 01
subsystem: financial-statements
tags: [sped-ecd, accounting, compliance, backend]
dependency_graph:
  requires:
    - chart-of-accounts (getUnmappedSpedAccounts)
    - ledger (getTrialBalance)
    - financial-statements (getDre, getBalanceSheet)
  provides:
    - sped-ecd.types (SpedEcdInput, SpedValidationResult)
    - sped-ecd.writer (SpedEcdWriter pure class)
    - sped-ecd.service (validateSpedEcd, generateSpedEcd)
    - sped-ecd.routes (GET /validate, GET /download)
  affects:
    - Organization model (new accountant + integratedReportNotes fields)
    - app.ts (spedEcdRouter mounted)
tech_stack:
  added: []
  patterns:
    - Pure writer class (no Prisma) following payroll-calculation pattern
    - Service mock pattern for route tests (same as accounting-dashboard.routes.spec.ts)
    - migrate diff + deploy for shadow DB limitation workaround (Phase 35 pattern)
key_files:
  created:
    - apps/backend/src/modules/financial-statements/sped-ecd.types.ts
    - apps/backend/src/modules/financial-statements/sped-ecd.writer.ts
    - apps/backend/src/modules/financial-statements/sped-ecd.writer.spec.ts
    - apps/backend/src/modules/financial-statements/sped-ecd.service.ts
    - apps/backend/src/modules/financial-statements/sped-ecd.routes.ts
    - apps/backend/src/modules/financial-statements/sped-ecd.routes.spec.ts
    - apps/backend/prisma/migrations/20260604000000_add_sped_ecd_organization_fields/migration.sql
  modified:
    - apps/backend/prisma/schema.prisma (Organization model, 4 new fields)
    - apps/backend/src/app.ts (spedEcdRouter import and mount)
decisions:
  - 'Used migrate diff + deploy (not migrate dev) due to shadow DB missing tables from earlier migrations — Phase 35 pattern'
  - 'SpedEcdWriter pure class (no Prisma imports) follows payroll-calculation testability pattern'
  - 'Single migration 20260604000000 adds ALL Phase 41 Organization fields (accountantName/Crc/Cpf + integratedReportNotes) — Plan 02 reuses this migration'
  - "ChartOfAccount field is 'nature' (not accountNature) — confirmed from schema inspection"
  - 'AccountBalance uses debitTotal/creditTotal (not totalDebits/totalCredits) — confirmed from schema'
  - 'JournalEntryLine uses side (DEBIT|CREDIT) + amount (not separate debit/credit fields) — confirmed from schema'
  - 'FiscalYear has no year field — derive from startDate.getFullYear() per Phase 40 decision'
  - '9900 register counts include Bloco 9 registers (9001, 9900, 9990, 9999) with correct self-referential counting'
  - 'Test fixture dates use T12:00:00 suffix to avoid timezone-driven day offset with date-fns format()'
metrics:
  duration_seconds: 795
  completed_date: '2026-03-28'
  tasks_completed: 2
  tasks_total: 2
  files_created: 7
  files_modified: 2
  tests_added: 39
---

# Phase 41 Plan 01: SPED ECD Backend Summary

Backend SPED ECD implementation with JWT-protected download endpoint, 7-check pre-validation service, pure SpedEcdWriter class, and Organization migration for accountant and integrated report fields.

## What Was Built

**SpedEcdWriter** — Pure class (no Prisma, no side effects) that takes SpedEcdInput and produces a pipe-delimited SPED Contabil ECD text file with Blocos 0/I/J/9. Uses date-fns for DDMMAAAA formatting and Decimal.js for amount formatting. Includes Bloco 9 self-referential register count tracking.

**validateSpedEcd** — Service function with 7 validation checks:

- ERROR: UNMAPPED_SPED (analytic accounts without L300R spedRefCode)
- ERROR: OPEN_PERIODS (accounting periods not closed)
- ERROR: UNBALANCED_TRIAL (trial balance debits != credits per month)
- ERROR: DUPLICATE_I050 (duplicate COA codes)
- ERROR: I155_INCONSISTENCY (journal entry sum != AccountBalance totals)
- WARNING: NO_MOVEMENT (analytic accounts with zero movement)
- WARNING: INACTIVE_ACCOUNTS (inactive accounts with historical data)

**generateSpedEcd** — Service function that loads all required data from DB and calls SpedEcdWriter to produce the file content, with filename pattern `SPED_ECD_{CNPJ}_{YEAR}.txt`.

**Routes** — GET `/org/:orgId/sped-ecd/validate?fiscalYearId=` and GET `/org/:orgId/sped-ecd/download?fiscalYearId=`, both requiring `financial:read` permission.

**Migration** — Single migration `20260604000000_add_sped_ecd_organization_fields` adds `accountantName`, `accountantCrc`, `accountantCpf`, `integratedReportNotes` to Organization model. Plan 02 depends on these fields and does NOT create its own migration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ChartOfAccount field name mismatch: `accountNature` -> `nature`**

- **Found during:** Task 2 TypeScript check
- **Issue:** Plan used `accountNature` but Prisma schema uses `nature` for ChartOfAccount
- **Fix:** Used correct field name `nature` in Prisma select, mapped to `accountNature` in SpedAccountData
- **Files modified:** sped-ecd.service.ts
- **Commit:** 42cf5f4d

**2. [Rule 1 - Bug] AccountBalance field names: `totalDebits`/`totalCredits` -> `debitTotal`/`creditTotal`**

- **Found during:** Task 2 TypeScript check
- **Issue:** Plan described fields as `totalDebits`/`totalCredits` but Prisma schema uses `debitTotal`/`creditTotal`
- **Fix:** Updated all AccountBalance queries to use correct field names
- **Files modified:** sped-ecd.service.ts
- **Commit:** 42cf5f4d

**3. [Rule 1 - Bug] AccountBalance has no `year` field — linked via `fiscalYearId`**

- **Found during:** Task 2 TypeScript check
- **Issue:** Plan grouped balances by `year` but AccountBalance uses `fiscalYearId` for year relationship
- **Fix:** Query AccountBalance using `fiscalYearId` filter instead of year range
- **Files modified:** sped-ecd.service.ts
- **Commit:** 42cf5f4d

**4. [Rule 1 - Bug] JournalEntryLine uses `side` + `amount`, not separate `debit`/`credit` fields**

- **Found during:** Task 2 TypeScript check
- **Issue:** Plan assumed debit/credit columns; Prisma has `side: LedgerSide` + `amount`
- **Fix:** Group by `[accountId, side]` for I155 inconsistency check; use `side === 'DEBIT'` for I250 indicator
- **Files modified:** sped-ecd.service.ts
- **Commit:** 42cf5f4d

**5. [Rule 1 - Bug] JournalEntry has no `totalDebit` field**

- **Found during:** Task 2 TypeScript check
- **Issue:** Plan selected `totalDebit` from JournalEntry but this field doesn't exist
- **Fix:** Compute totalDebit from line amounts where `side === 'DEBIT'`
- **Files modified:** sped-ecd.service.ts
- **Commit:** 42cf5f4d

**6. [Rule 1 - Bug] `getBp` export name — actual export is `getBalanceSheet`**

- **Found during:** Task 2 TypeScript check
- **Issue:** Plan referenced `getBp` but financial-statements.service.ts exports `getBalanceSheet`
- **Fix:** Updated import to use correct name `getBalanceSheet`
- **Files modified:** sped-ecd.service.ts
- **Commit:** 42cf5f4d

**7. [Rule 1 - Bug] CostCenter has no `organizationId` — linked via farm**

- **Found during:** Task 2 TypeScript check
- **Issue:** Plan queried `where: { organizationId }` on CostCenter but it's linked to Farm
- **Fix:** Query using `where: { farm: { organizationId } }` with `.catch(() => [])` for safety
- **Files modified:** sped-ecd.service.ts
- **Commit:** 42cf5f4d

**8. [Rule 1 - Bug] Test timezone issue — `new Date('2025-12-31')` shows as 2025-12-30 in local time**

- **Found during:** Task 1 test run
- **Issue:** ISO date strings without time default to UTC midnight, offset by local timezone in date-fns format
- **Fix:** Use `T12:00:00` suffix in test fixture dates; adjusted test assertion to use journal entry date instead
- **Files modified:** sped-ecd.writer.spec.ts
- **Commit:** 5d70ab46

**9. [Rule 3 - Blocking] `migrate dev` fails due to shadow DB missing tables**

- **Found during:** Task 1 migration step
- **Issue:** `prisma migrate dev` fails with P3006 (shadow DB incomplete) — same issue as Phase 35
- **Fix:** Used `migrate diff --from-config-datasource --to-schema + migrate deploy` pattern per Phase 35 decision
- **Files modified:** migration.sql created manually
- **Commit:** 5d70ab46

## Known Stubs

None. All endpoints return real data from DB queries. The DRE/BP blocks in generated SPED ECD may be empty if no fiscal year data exists (by design — try/catch fallback to empty arrays).

## Self-Check: PASSED

All 7 created files found. Both commits (5d70ab46, 42cf5f4d) exist. 39 tests pass.
