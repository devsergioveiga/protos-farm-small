---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 04-instrumentos-de-pagamento/04-02-PLAN.md
last_updated: '2026-03-16T23:26:01.341Z'
last_activity: 2026-03-16 — PayablesPage complete (3 tabs, 4 modals, aging, calendar, CNAB retorno, sidebar badge)
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 19
  completed_plans: 16
  percent: 80
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15)

**Core value:** O proprietário/gerente sabe exatamente quanto tem, quanto deve e quanto vai receber — com visão consolidada por fazenda e conta bancária.
**Current focus:** Phase 1 — Fundação Financeira

## Current Position

Phase: 2 of 6 (Núcleo AP/AR)
Plan: 1 of 7 in current phase
Status: executing
Last activity: 2026-03-16 — PayablesPage complete (3 tabs, 4 modals, aging, calendar, CNAB retorno, sidebar badge)

Progress: [████████░░] 80% (phase 02: 5/7 plans complete)

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
| ----- | ----- | ----- | -------- |
| -     | -     | -     | -        |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

_Updated after each plan completion_
| Phase 01-funda-o-financeira P01 | 6min | 2 tasks | 9 files |
| Phase 01-funda-o-financeira P02 | 6min | 2 tasks | 5 files |
| Phase 01-funda-o-financeira P03 | 30min | 2 tasks | 7 files |
| Phase 02-n-cleo-ap-ar P01 | 9min | 2 tasks | 6 files |
| Phase 02-n-cleo-ap-ar P03 | 20min | 2 tasks | 4 files |
| Phase 02-n-cleo-ap-ar P04 | 14min | 2 tasks | 11 files |
| Phase 02-n-cleo-ap-ar P05 | 35min | 2 tasks | 10 files |
| Phase 02-n-cleo-ap-ar P07 | 5min | 2 tasks | 0 files |
| Phase 03-dashboard-financeiro P01 | 4min | 2 tasks | 5 files |
| Phase 03-dashboard-financeiro P02 | 7min | 1 tasks | 7 files |
| Phase 04-instrumentos-de-pagamento P01 | 10min | 2 tasks | 8 files |
| Phase 04-instrumentos-de-pagamento P05 | 5min | 2 tasks | 5 files |
| Phase 04-instrumentos-de-pagamento P02 | 11min | 2 tasks | 7 files |
| Phase 04-instrumentos-de-pagamento P03 | 12min | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Phase 1]: producerId obrigatório como FK em BankAccount desde a primeira migration — sem isso não há isolamento fiscal por produtor rural
- [Phase 1]: Tipo Money (decimal.js) deve ser estabelecido em packages/shared antes de qualquer dado financeiro ser gravado — retrofitting exige auditoria completa
- [Phase 2]: CNAB deve usar padrão CnabAdapter por banco (não uma função genérica) — bancos rurais (Sicoob, Sicredi, BB) têm extensões proprietárias
- [Phase 4]: Cheques pré-datados são entidade de primeira classe com máquina de estados — não campo metadata em pagamento
- [Phase 5]: Horizonte de fluxo de caixa é 12 meses obrigatório — sazonalidade agrícola torna 90 dias inútil
- [Phase 5]: Antes de implementar, verificar status do ofx-js no npm; fallback: @xmldom/xmldom (já instalado) + parser SGML customizado
- [Phase 01-funda-o-financeira]: Money implemented as factory function (not class) so Money(100) works without new keyword
- [Phase 01-funda-o-financeira]: BankAccount.producerId nullable: org-level accounts have no producer, rural producer accounts have FK
- [Phase 01-funda-o-financeira]: Migration created manually via db push + migrate resolve due to shadow database stale cultivar issue
- [Phase 01-funda-o-financeira P02]: RBAC uses existing financial:\* PermissionModule — no changes to permissions.ts required; FINANCIAL role already has full access
- [Phase 01-funda-o-financeira P02]: Route ordering critical — /dashboard and /:id/statement/export must precede /:id and /:id/statement to avoid param capture
- [Phase 01-funda-o-financeira]: Backend returns arrays directly (not { data: [] }) — useBankAccounts hooks corrected after human-verify
- [Phase 01-funda-o-financeira]: Statement view is inline expanded panel per account card — stays within 3-level navigation depth
- [Phase 01-funda-o-financeira]: Saldo projetado shows '--' placeholder — interface prepared for future AR/AP integration without blocking plan 03
- [Phase 02-n-cleo-ap-ar P01]: UTC date methods (setUTCMonth/getUTCMonth) in generateInstallments to avoid timezone-shift bug with midnight UTC base dates
- [Phase 02-n-cleo-ap-ar P01]: PERCENTAGE tolerance 0.01% in validateCostCenterItems to handle floating-point near-100 sums without rejecting valid inputs
- [Phase 02-n-cleo-ap-ar]: FUNRURAL recalculated in renegotiation from original funruralRate field, preserving stored-at-creation invariant for new CR
- [Phase 02-n-cleo-ap-ar]: CR settlement = BankAccountBalance INCREMENT (CREDIT) vs CP settlement = DECREMENT (DEBIT) — symmetric opposite operations
- [Phase 02-n-cleo-ap-ar]: BB (001) uses segments P+Q in CNAB 240; Sicoob (756) uses A+B with Banco Cooperado field at positions 53-57 — enforced via adapter pattern
- [Phase 02-n-cleo-ap-ar]: CNAB retorno ourNumber = payableId with dashes removed, truncated — deterministic matching without extra DB column
- [Phase 02-n-cleo-ap-ar]: useOverdueCount hook polled at sidebar mount — lightweight, no global state store needed
- [Phase 02-n-cleo-ap-ar]: CnabRetornoModal uses direct fetch() with FormData for multipart upload — api service only handles JSON
- [Phase 02-n-cleo-ap-ar]: Plan 02-07 acted as final human-verify gate for complete AP/AR module — sidebar integration and routes were completed in plans 02-05/02-06, human verification approved full CP+CR end-to-end flow
- [Phase 03-dashboard-financeiro]: totalBankBalance only from BankAccountBalance.currentBalance — never add pending CP/CR
- [Phase 03-dashboard-financeiro]: totalBankBalancePrevYear always null — no historical balance snapshot table exists
- [Phase 03-dashboard-financeiro]: Recharts Formatter type requires value and name params typed as T | undefined — typed accordingly to match generic overload
- [Phase 03-dashboard-financeiro]: Financial Dashboard uses local farmId state (not FarmContext.selectedFarmId) — avoids polluting global farm selection per spec
- [Phase 04-instrumentos-de-pagamento]: Permission actions are create/read/update/delete (not write) — transfers routes use financial:create for POST, financial:delete for DELETE, financial:read for GET
- [Phase 04-instrumentos-de-pagamento]: TRANSFER and TRANSFER_FEE as separate referenceTypes in FinancialTransaction — enables filtering fee transactions from principal ledger entries in statements
- [Phase 04-instrumentos-de-pagamento]: deleteTransfer reverses BankAccountBalance atomically (increment fromAccount, decrement toAccount, add fee back) and removes FinancialTransactions — preserves BankAccountBalance integrity
- [Phase 04-instrumentos-de-pagamento]: Route ordering: /alert-count and /accounting-balance registered before /:id in checksRouter to avoid Express param capture
- [Phase 04-instrumentos-de-pagamento]: CHECK_COMPENSATION referenceType distinguishes check compensation from other FinancialTransactions in bank statement
- [Phase 04-instrumentos-de-pagamento]: Same-account validation in TransferModal renders as error banner — applies to both fields simultaneously
- [Phase 04-instrumentos-de-pagamento]: Delete confirmation in TransfersPage uses inline popover — proportional to risk, no full destructive modal needed

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 5]: ofx-js — verificar manutenção ativa no npm antes de adotar. Fallback documentado: @xmldom/xmldom
- [Phase 5]: Coletar amostras reais de OFX de BB, Bradesco, Sicoob antes de projetar o motor de matching
- [Phase 6]: Verificar rates atuais do Plano Safra 2025/2026 no BCB MCR antes de implementar — dados de treino podem estar desatualizados
- [Phase 6]: Obter manuais de layout CNAB Sicoob/Sicredi antes de implementar adapters para crédito rural

## Session Continuity

Last session: 2026-03-16T23:25:49.640Z
Stopped at: Completed 04-instrumentos-de-pagamento/04-02-PLAN.md
Resume file: None
