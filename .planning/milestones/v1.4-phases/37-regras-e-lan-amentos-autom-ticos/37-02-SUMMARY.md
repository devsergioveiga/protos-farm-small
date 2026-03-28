---
phase: 37-regras-e-lan-amentos-autom-ticos
plan: '02'
subsystem: accounting
tags:
  [auto-posting, accounting, payables, receivables, payroll, depreciation, stock, legacy-removal]
dependency_graph:
  requires: ['37-01']
  provides: ['LANC-01', 'LANC-02-partial']
  affects:
    [
      'payables',
      'receivables',
      'payroll-runs',
      'payroll-provisions',
      'depreciation-batch',
      'stock-entries',
      'stock-outputs',
      'chart-of-accounts',
    ]
tech_stack:
  added: []
  patterns:
    [
      'non-blocking auto-posting hooks via try/catch after main transaction (D-15)',
      'autoPost alias pattern per D-26',
      'receivePayment alias as CR settlement hook point per D-33',
    ]
key_files:
  created: []
  modified:
    - apps/backend/src/modules/payables/payables.service.ts
    - apps/backend/src/modules/receivables/receivables.service.ts
    - apps/backend/src/modules/payroll-runs/payroll-runs.service.ts
    - apps/backend/src/modules/payroll-provisions/payroll-provisions.service.ts
    - apps/backend/src/modules/depreciation/depreciation-batch.service.ts
    - apps/backend/src/modules/stock-entries/stock-entries.service.ts
    - apps/backend/src/modules/stock-outputs/stock-outputs.service.ts
    - apps/backend/src/modules/chart-of-accounts/chart-of-accounts.service.ts
    - apps/backend/src/app.ts
    - apps/backend/prisma/schema.prisma
    - apps/frontend/src/App.tsx
  deleted:
    - apps/backend/src/modules/accounting-entries/accounting-entries.service.ts
    - apps/backend/src/modules/accounting-entries/accounting-entries.routes.ts
    - apps/backend/src/modules/accounting-entries/accounting-entries.routes.spec.ts
    - apps/backend/src/modules/accounting-entries/accounting-entries.types.ts
    - apps/frontend/src/hooks/useAccountingEntries.ts
    - apps/frontend/src/pages/AccountingEntriesPage.tsx
    - apps/frontend/src/pages/AccountingEntriesPage.css
    - apps/frontend/src/types/accounting-entries.ts
decisions:
  - 'autoPost hooks are always non-blocking (try/catch outside main transaction) per D-15'
  - 'receivePayment exported as alias for settleReceivable — CR settlement hook point per D-33'
  - 'AccountingEntry table was already absent from DB (never migrated) — migrate diff returned empty, prisma generate sufficient'
  - 'payroll-provisions hooks created per-employee with select:{id:true} to capture provision IDs'
  - 'PAYABLE_REVERSAL hook added to reversePayment function (previously had createReversalEntry for payroll-origin only)'
  - 'seedAccountingRules called at end of seedRuralTemplate — idempotent, silently skips if COA not seeded'
metrics:
  duration: '~40 minutes'
  completed_date: '2026-03-27'
  tasks: 3
  files_changed: 16
---

# Phase 37 Plan 02: Wire Auto-Posting Hooks and Remove Legacy Accounting Module Summary

Auto-posting hooks wired into all 6 source modules (CP, CR, payroll, depreciation, stock entry, stock output), legacy AccountingEntry module removed entirely, and default rule seeding integrated into the COA template workflow.

## What Was Built

### Task 1: Wire auto-posting hooks in 6 modules

All 7 service files now call `autoPost` after their main business transactions (non-blocking, per D-15):

| Module                        | Hook point                                | SourceType(s)                                                            |
| ----------------------------- | ----------------------------------------- | ------------------------------------------------------------------------ |
| payables.service.ts           | settlePayment, reversePayment             | PAYABLE_SETTLEMENT, PAYABLE_REVERSAL                                     |
| receivables.service.ts        | settleReceivable, reverseReceivable       | RECEIVABLE_SETTLEMENT, RECEIVABLE_REVERSAL                               |
| payroll-runs.service.ts       | closeRun                                  | PAYROLL_RUN_CLOSE                                                        |
| payroll-provisions.service.ts | calculateMonthlyProvisions (per employee) | PAYROLL_PROVISION_VACATION, PAYROLL_PROVISION_THIRTEENTH                 |
| depreciation-batch.service.ts | runDepreciationBatch (after COMPLETED)    | DEPRECIATION_RUN                                                         |
| stock-entries.service.ts      | createStockEntry                          | STOCK_ENTRY                                                              |
| stock-outputs.service.ts      | createStockOutput                         | STOCK_OUTPUT_CONSUMPTION / STOCK_OUTPUT_TRANSFER / STOCK_OUTPUT_DISPOSAL |

- `receivePayment` exported as alias for `settleReceivable` per D-33 (CR settlement hook point)
- `createPayrollEntries` and `revertPayrollEntries` imports removed from payroll-runs.service.ts
- `createReversalEntry` import removed from payables.service.ts

### Task 2: Remove legacy AccountingEntry module

- Deleted 4 backend files: `accounting-entries.{service,routes,routes.spec,types}.ts`
- Removed `accountingEntriesRouter` import and mount from `app.ts`
- Removed `model AccountingEntry`, `enum AccountingSourceType`, `enum AccountingEntryType` from `schema.prisma`
- Removed `accountingEntries AccountingEntry[]` relations from Organization, Farm, CostCenter models
- `accounting_entries` table was already absent from live DB — `prisma migrate diff` returned empty, `prisma generate` was sufficient
- Deleted 4 frontend files: `AccountingEntriesPage.{tsx,css}`, `useAccountingEntries.ts`, `types/accounting-entries.ts`
- Removed `AccountingEntriesPage` lazy import from `App.tsx` (route `/accounting-entries` kept, redirects to `JournalEntriesPage` per Phase 36 decision)

### Task 3: Seed AccountingRules alongside COA template

- `chart-of-accounts.service.ts` imports `seedAccountingRules` from `auto-posting.service`
- `seedRuralTemplate()` calls `seedAccountingRules(organizationId)` after all COA accounts are created
- `POST /api/org/:orgId/chart-of-accounts/seed` now atomically creates COA accounts + default AccountingRules for all 12 sourceTypes
- `seedAccountingRules` is idempotent: skips existing rules and silently skips accounts not yet in COA

## Decisions Made

1. **Non-blocking pattern everywhere** — All hooks wrapped in `try/catch` outside `withRlsContext` transaction. Business operation already committed when hook fires (D-15).

2. **receivePayment alias** — CR settlement hook point per D-33. `export const receivePayment = settleReceivable` — no duplicate logic, same function with a second export name.

3. **AccountingEntry table already absent** — The table was never actually migrated to the live DB (likely because it was part of an earlier stub that was superseded). `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma` returned empty — only `prisma generate` was needed.

4. **Per-employee provision IDs** — `calculateMonthlyProvisions` creates provisions per employee. Changed `tx.payrollProvision.create` to `select: { id: true }` to capture provision IDs for autoPost calls within the per-employee loop.

5. **PAYABLE_REVERSAL hook scope** — The original code only called `createReversalEntry` for payroll-origin payables. The new hook fires for ALL payable reversals (per D-24 — any settled payable can be reversed to trigger a GL entry). This is a wider scope but correct behavior per the auto-posting design.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written with one notable discovery:

**Observation: AccountingEntry table already absent from DB**

- **Found during:** Task 2 (schema migration step)
- **Issue:** `prisma migrate dev --name remove-legacy-accounting-entries` failed because shadow DB couldn't apply old migrations (pre-existing issue per STATE.md Phase 35 decision)
- **Action:** Used `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` to verify the diff was empty (table never migrated)
- **Fix:** Ran `prisma generate` only — no migration file needed
- **Impact:** No schema migration committed; `accounting_entries` table removal is reflected in schema.prisma and Prisma client

## Known Stubs

None — all hooks wire to real auto-posting service. No placeholder data.

## Verification

- Zero remaining imports of `accounting-entries` module in `apps/backend/src/`
- Zero remaining imports of `AccountingEntryType`, `AccountingSourceType`, `ACCOUNT_CODES` in `apps/backend/src/`
- Zero remaining imports of `AccountingEntriesPage`, `useAccountingEntries` in `apps/frontend/src/`
- 225 tests pass across payables, receivables, payroll-runs, stock-entries, stock-outputs
- 51 tests pass across chart-of-accounts and auto-posting

## Self-Check: PASSED

Files verified to exist:

- apps/backend/src/modules/payables/payables.service.ts — contains `autoPost('PAYABLE_SETTLEMENT'`
- apps/backend/src/modules/receivables/receivables.service.ts — contains `autoPost('RECEIVABLE_SETTLEMENT'` and `receivePayment` alias
- apps/backend/src/modules/payroll-runs/payroll-runs.service.ts — contains `autoPost('PAYROLL_RUN_CLOSE'`
- apps/backend/src/modules/payroll-provisions/payroll-provisions.service.ts — contains `autoPost('PAYROLL_PROVISION_VACATION'`
- apps/backend/src/modules/depreciation/depreciation-batch.service.ts — contains `autoPost('DEPRECIATION_RUN'`
- apps/backend/src/modules/stock-entries/stock-entries.service.ts — contains `autoPost('STOCK_ENTRY'`
- apps/backend/src/modules/stock-outputs/stock-outputs.service.ts — contains `autoPost(outputSourceType`
- apps/backend/src/modules/chart-of-accounts/chart-of-accounts.service.ts — contains `seedAccountingRules(organizationId)`

Files verified to NOT exist:

- apps/backend/src/modules/accounting-entries/ directory — deleted
- apps/frontend/src/pages/AccountingEntriesPage.tsx — deleted
- apps/frontend/src/hooks/useAccountingEntries.ts — deleted

Commits:

- 0b05952c feat(37-02): wire auto-posting hooks in 6 source modules
- fab466ae feat(37-02): remove legacy AccountingEntry module + schema cleanup
- 41ace54b feat(37-02): seed AccountingRules alongside COA rural template
