---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Contabilidade e Demonstrações Financeiras
status: Ready to execute
stopped_at: Completed 39-01-PLAN.md — financial-statements backend
last_updated: "2026-03-28T12:40:55.744Z"
progress:
  total_phases: 7
  completed_phases: 4
  total_plans: 18
  completed_plans: 16
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-26)

**Core value:** O proprietário/gerente sabe exatamente quanto tem, quanto deve e quanto vai receber — com visão consolidada por fazenda e conta bancária.
**Current focus:** Phase 39 — DRE, Balanço Patrimonial e Validação Cruzada

## Current Position

Phase: 39 (DRE, Balanço Patrimonial e Validação Cruzada) — EXECUTING
Plan: 2 of 3

## Accumulated Context

### Decisions

Full log: PROJECT.md Key Decisions table.

Key decisions carried from v1.3:

- **PayrollRun state machine mirrors DepreciationRun**: PENDING → PROCESSING → COMPLETED | ERROR — same atomicity pattern
- **Payroll to Payables uses originType + originId upsert**: Prevents duplicate CPs on re-processing
- **tx.payable.create used directly in transactions**: NOT payables.service.createPayable to avoid nested withRlsContext deadlocks
- **eSocial events transmitted in strict order via BullMQ**: table events (S-1010) → cadastral events (S-2200) → periodic events (S-1200)
- **Accounting entry JSON stubs stored in v1.3**: Phase 32 created stubs (debit 6.1.01/6.1.02, credit 2.2.01/2.2.02) — v1.4 will replace with real GL entries
- [Phase 35]: Used prisma migrate diff + deploy instead of migrate dev: shadow DB was missing tables from earlier migrations; diff generates correct SQL from live DB state
- [Phase 35]: rateio remainder goes to largest-percentage share for predictability when equal percentages exist
- [Phase 35]: fiscalPeriodsRouter mounted at /api/org/:orgId with mergeParams:true for param access in sub-routes
- [Phase 35]: Template co-located in src/modules/ not prisma/fixtures/ — tsconfig rootDir ./src excludes prisma/
- [Phase 35]: Legacy 6.x codes in COA template for ACCOUNT_CODES compatibility; Phase 37 will update GL rules
- [Phase 35]: Period close uses ConfirmModal (variant=warning) per CLAUDE.md — never window.confirm
- [Phase 35]: COA tree built client-side from flat array via buildTree() helper — avoids extra API call
- [Phase 36]: PayrollProvision uses provisionType VACATION/THIRTEENTH with totalAmount (EPIC-16 schema) — not vacationProvision/thirteenthProvision fields as described in plan
- [Phase 36]: Opening balance wizard finds COA accounts by code prefix first, then name keyword fallback for resilience
- [Phase 36]: postJournalEntry uses Serializable isolation to prevent duplicate entry numbers
- [Phase 36]: CSV import returns preview only (no auto-create) per LANC-03 spec
- [Phase 36]: Ledger running balance uses SQL window function SUM OVER (ORDER BY entryDate, entryNumber) starting from previousBalance — single query, avoids N+1
- [Phase 36]: getTrialBalance aggregates synthetic accounts recursively, grandTotals from analytic-only to avoid double-counting
- [Phase 36-lan-amentos-manuais-raz-o-e-saldo-de-abertura]: useLedger derives startDate/endDate from fiscalYearId+month client-side — avoids extra API call
- [Phase 36-lan-amentos-manuais-raz-o-e-saldo-de-abertura]: TrialBalancePage uses tab pattern (Balancete + Livro Diário) — single page, two panels per UI-SPEC
- [Phase 36]: /accounting-entries route now points to JournalEntriesPage — full manual entry UI replaces payroll-only accounting entries page
- [Phase 36]: CSV import uses preview-first flow: upload -> importCsv() -> CsvPreviewModal -> createDraft per entry (per LANC-03 spec)
- [Phase 37]: D-17: Idempotency via UNIQUE(sourceType, sourceId) on both PendingJournalPosting and JournalEntry — process() returns silently on duplicate
- [Phase 37]: EXTRACTORS map keyed on AutoPostingSourceType co-located in auto-posting service — no cross-module imports, each extractor fetches its own source data
- [Phase 37]: seedAccountingRules(orgId) must be called after COA seeding — resolves accounts by code prefix startsWith, silently skips if COA not seeded yet
- [Phase 37]: Lancamentos panel uses hidden attribute (not conditional render) to preserve filter state on tab switch
- [Phase 37]: AccountCombobox filters analytic accounts client-side from useChartOfAccounts data already in memory
- [Phase 37]: autoPost hooks are always non-blocking (try/catch outside main transaction) per D-15
- [Phase 37]: receivePayment exported as alias for settleReceivable — CR settlement hook point per D-33
- [Phase 37]: AccountingEntry table was already absent from DB — migrate diff returned empty, prisma generate sufficient
- [Phase 37]: seedAccountingRules called at end of seedRuralTemplate — idempotent, silently skips if COA not seeded
- [Phase 38]: Routes spec uses service mock pattern (matches auto-posting.routes.spec.ts) for better isolation
- [Phase 38-fechamento-mensal-e-concilia-o-cont-bil]: checkPeriodOpen() applied to actual HTTP write routes (pending/retry-batch, pending/:id/retry) not the internal process() function which is not an HTTP endpoint
- [Phase 38]: FiscalYearCard refactored to show PeriodPanel for OPEN periods to accommodate Fechamento button alongside Fechar Periodo action
- [Phase 38]: Reopen dialog implemented inline (not ConfirmModal) because reason textarea is needed but ConfirmModal props do not support it
- [Phase 39-dre-balan-o-patrimonial-e-valida-o-cruzada]: Pure calculators (no Prisma) follow payroll-calculation pattern for testability; consolidated DRE uses AccountBalance, CC-filtered uses JournalEntryLine
- [Phase 39-dre-balan-o-patrimonial-e-valida-o-cruzada]: Cross-validation invariant 2 (DFC) returns PENDING; allPassed=true when no FAILED invariants (PENDING does not fail)

### Pending Todos

- Confirm with customer whether farm legal entities are Simples Nacional or Lucro Real/Presumido (affects FUNRURAL calculation mode)
- Cross-check 2026 INSS and IRRF exact table values against official RFB Instrução Normativa
- Confirm eSocial sandbox credentials and endpoint URLs with client
- Decide where PFX certificate is stored in production (AWS Secrets Manager vs KMS)

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-28T12:40:55.740Z
Stopped at: Completed 39-01-PLAN.md — financial-statements backend
Resume file: None
Next action: Define requirements and create roadmap for v1.4
