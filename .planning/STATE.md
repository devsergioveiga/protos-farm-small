---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Contabilidade e Demonstrações Financeiras
status: Phase complete — ready for verification
stopped_at: Phase 37 context gathered
last_updated: "2026-03-27T18:41:49.596Z"
progress:
  total_phases: 7
  completed_phases: 2
  total_plans: 9
  completed_plans: 9
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-26)

**Core value:** O proprietário/gerente sabe exatamente quanto tem, quanto deve e quanto vai receber — com visão consolidada por fazenda e conta bancária.
**Current focus:** Phase 36 — lan-amentos-manuais-raz-o-e-saldo-de-abertura

## Current Position

Phase: 36 (lan-amentos-manuais-raz-o-e-saldo-de-abertura) — EXECUTING
Plan: 5 of 5

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

### Pending Todos

- Confirm with customer whether farm legal entities are Simples Nacional or Lucro Real/Presumido (affects FUNRURAL calculation mode)
- Cross-check 2026 INSS and IRRF exact table values against official RFB Instrução Normativa
- Confirm eSocial sandbox credentials and endpoint URLs with client
- Decide where PFX certificate is stored in production (AWS Secrets Manager vs KMS)

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-27T18:41:49.590Z
Stopped at: Phase 37 context gathered
Resume file: .planning/phases/37-regras-e-lan-amentos-autom-ticos/37-CONTEXT.md
Next action: Define requirements and create roadmap for v1.4
