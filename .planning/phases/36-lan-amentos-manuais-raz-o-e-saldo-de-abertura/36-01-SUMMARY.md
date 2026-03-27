---
phase: 36-lan-amentos-manuais-raz-o-e-saldo-de-abertura
plan: "01"
subsystem: backend
tags: [accounting, journal-entries, double-entry, prisma, tdd]
dependency_graph:
  requires: [phase-35-plano-de-contas-e-periodos-fiscais]
  provides: [journal-entry-crud, account-balance-posting, csv-import-lanc03]
  affects: [account-balances, chart-of-accounts, accounting-periods]
tech_stack:
  added: [JournalEntry, JournalEntryLine, JournalEntryType, JournalEntryStatus, LedgerSide]
  patterns: [atomic-transaction-serializable, upsert-balance, raw-sql-closing-balance, multer-csv-import]
key_files:
  created:
    - apps/backend/prisma/migrations/20260602000000_add_journal_entries/migration.sql
    - apps/backend/src/modules/journal-entries/journal-entries.types.ts
    - apps/backend/src/modules/journal-entries/journal-entries.service.ts
    - apps/backend/src/modules/journal-entries/journal-entries.routes.ts
    - apps/backend/src/modules/journal-entries/journal-entries.routes.spec.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/app.ts
decisions:
  - "postJournalEntry uses Serializable isolation to prevent duplicate entry numbers"
  - "closingBalance recomputed via raw SQL UPDATE JOIN to avoid N+1 fetches"
  - "CSV import returns preview only (no auto-create) — frontend calls createJournalEntryDraft per entry"
  - "reversalOf/reversedById use @unique on JournalEntry for 1-1 relationship"
  - "Templates excluded from listEntries (templateName: null filter)"
metrics:
  duration: "25 minutes"
  completed_date: "2026-03-27"
  tasks_completed: 2
  tests_added: 30
  files_created: 5
  files_modified: 2
---

# Phase 36 Plan 01: Journal Entries — Schema, Service, and Routes Summary

**One-liner:** Double-entry journal posting engine with Serializable transaction, AccountBalance upsert, raw-SQL closingBalance recompute, CSV import preview (LANC-03), and 30 integration tests.

## What Was Built

Created the full `journal-entries` backend module — the core posting engine for double-entry bookkeeping. All subsequent accounting features (ledger, trial balance, opening balance) depend on this.

### Prisma Models

- `JournalEntry` — header record with status machine (DRAFT → POSTED / REVERSED), sequential entryNumber, reversal links (reversedById/reversalOf), optional templateName
- `JournalEntryLine` — individual debit/credit lines with LedgerSide enum, amount (Decimal 14,2), lineOrder
- Three new enums: `JournalEntryType` (MANUAL, OPENING_BALANCE, REVERSAL, TEMPLATE_INSTANCE), `JournalEntryStatus` (DRAFT, POSTED, REVERSED), `LedgerSide` (DEBIT, CREDIT)
- Reverse relations added to: `ChartOfAccount`, `AccountingPeriod`, `CostCenter`, `User`, `Organization`

### Service Functions

| Function | Behavior |
|---|---|
| `createJournalEntryDraft` | Validates accounts (active, not synthetic, allowManualEntry), calls `assertBalanced` + `assertPeriodOpen`, creates DRAFT with entryNumber=0 |
| `postJournalEntry` | Serializable tx: guard DRAFT status, `assertPeriodOpen`, get max entryNumber, upsert AccountBalance debit/credit totals, raw SQL UPDATE closingBalance per account nature |
| `reverseJournalEntry` | Validates reason (non-empty), Serializable tx: guard POSTED status, create inverted REVERSAL draft, mark original REVERSED, inline post logic |
| `saveTemplate` | Creates DRAFT with templateName set |
| `listTemplates` | Returns entries where templateName IS NOT NULL |
| `deleteTemplate` | Hard-delete where templateName IS NOT NULL |
| `deleteDraft` | Hard-delete DRAFT-only, rejects POSTED/REVERSED/templates |
| `listEntries` | Paginated, excludes templates, optional filters: periodId, status, entryType, dateRange |
| `getEntry` | Returns single entry with full lines + account details |
| `importCsvJournalEntries` | Parses CSV, normalizes side (DEBITO/D → DEBIT, CREDITO/C → CREDIT), batch-fetches accounts, groups by entryDate+description, calls assertBalanced per group, returns CsvImportPreview (no auto-create per LANC-03) |

### Routes (10 endpoints)

All behind `authenticate`. GET routes use `financial:read`, POST/DELETE use `financial:manage`.

```
GET    /api/org/:orgId/journal-entries               — list (paginated, no templates)
GET    /api/org/:orgId/journal-entries/templates      — list templates
GET    /api/org/:orgId/journal-entries/:id            — single entry with lines
POST   /api/org/:orgId/journal-entries                — create draft
POST   /api/org/:orgId/journal-entries/templates      — save template
POST   /api/org/:orgId/journal-entries/import-csv     — CSV preview (multer 2MB)
POST   /api/org/:orgId/journal-entries/:id/post       — post draft
POST   /api/org/:orgId/journal-entries/:id/reverse    — reverse posted entry
DELETE /api/org/:orgId/journal-entries/templates/:id  — delete template
DELETE /api/org/:orgId/journal-entries/:id            — delete draft
```

Static routes (`/templates`, `/import-csv`) registered BEFORE `/:id` to prevent Express 5 param shadowing.

## Commits

| Task | Commit | Description |
|---|---|---|
| 1 (TDD) | `9fcf6a45` | Prisma migration + types + service (30 tests) |
| 2 | `d765686d` | Routes + app.ts mount |

## Deviations from Plan

None — plan executed exactly as written.

The only minor choice: `reverseJournalEntry` inlines the posting logic (rather than calling `postJournalEntry` separately) to avoid nested transactions within the Serializable tx. This is equivalent and follows the same code path.

## Known Stubs

None — all functions are fully implemented and wired.

## Self-Check: PASSED

All 5 created files exist. Both task commits (9fcf6a45, d765686d) verified in git log.
