# Project Research Summary

**Project:** Protos Farm — Módulo Financeiro Base (EPIC-FN1 a FN4)
**Domain:** Brazilian agricultural financial management (ERP rural)
**Researched:** 2026-03-15
**Confidence:** MEDIUM

## Executive Summary

This module introduces financial management capabilities into an existing, mature agricultural monorepo. The product domain is Brazilian rural ERP — a specialized niche where generic financial software fails because of regulatory instruments unique to Brazil: FUNRURAL withholding, CNAB 240/400 bank file formats, crédito rural with Plano Safra rates, and pre-dated cheques (cheques pré-datados) that remain standard in the interior. The recommended approach is to extend the existing codebase patterns faithfully — collocated modules, Prisma transactions for balance integrity, React Query for frontend state — while layering financial-specific correctness on top: `decimal.js` for all monetary arithmetic, a double-entry ledger design that separates document records (payables/receivables) from ledger movements (financial_transactions), and `producerId` as a first-class dimension on every financial record.

The core risk is building a system that looks complete but fails under Brazilian rural conditions. Eight identified pitfalls fall into two categories: fiscal compliance failures (float arithmetic, missing `producerId` isolation, incorrect crédito rural amortization) that cannot be retrofitted without expensive data migrations, and operational misfires (CNAB layout variance, OFX encoding, 90-day cash flow horizon, strict reconciliation matching) that cause user abandonment. The float arithmetic and `producerId` pitfalls must be addressed in the very first story — US-FN01 and US-FN07 — before any financial data is written. Retrofitting them later requires a full audit of all financial records and a multi-step migration.

The recommended MVP scope is eight stories (US-FN01, FN03, FN07, FN08, FN10, FN11, FN12, FN15) covering bank accounts, core AP/AR lifecycle with aging, and the financial dashboard. This delivers a fully usable financial module for a farm manager. A second wave (FN02, FN04, FN05, FN06, FN09, FN13) adds bank reconciliation, credit cards, and cash flow projection — features with higher ROI but also higher implementation risk. Crédito rural (FN14) and CNAB integration are intentionally deferred to a third wave: they require specialized domain implementation that should not block the core module going live.

## Key Findings

### Recommended Stack

The project already has the critical libraries installed. No new front-end dependencies are needed. On the backend, three libraries must be added: `decimal.js` (promote from transitive to explicit direct dependency — all monetary arithmetic), `date-fns` (richer business-day and aging arithmetic than the `dayjs` transitive dep), and `ofx-js` (OFX file parsing for bank reconciliation). For CSV from neobanks, add `papaparse`; for character encoding of legacy bank exports, add `iconv-lite`. CNAB 240/400 must be implemented as a custom internal module (`modules/cnab/`) rather than depending on an npm package — no actively maintained TypeScript-native CNAB library covers all bank-specific segment variants for rural banks (Sicoob, Sicredi, BB, Bradesco).

**Core technologies:**

- `decimal.js` (^10.4.3): all monetary arithmetic — avoids IEEE 754 errors that break CNAB checksums and bank reconciliation
- `date-fns` (^3.x for CommonJS compat): aging buckets, installment scheduling, business-day calculations
- `ofx-js`: OFX 1.x SGML and 2.x XML parsing for bank reconciliation import (LOW confidence on exact version — verify on npm before adopting; fallback is custom parser using already-installed `@xmldom/xmldom`)
- `papaparse` + `iconv-lite`: CSV import from neobanks and legacy BR bank encodings
- `pdfkit` + `exceljs`: already installed — extend existing patterns for financial report PDF and Excel export
- `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`: native BRL formatting — do not add `numeral.js` (unmaintained) or `dinero.js` v2 (unstable)
- Custom CNAB module (`modules/cnab/layouts/`): bank-specific layouts for BB-240, Bradesco-240, Itaú-400 — fixed-width positional format, ~300-500 lines per bank, testable in isolation

### Expected Features

**Must have (table stakes) — v1:**

- Cadastro de contas bancárias com saldo em tempo real do sistema (US-FN01)
- Extrato por conta com export PDF/Excel (US-FN03)
- Lançamento de contas a pagar com parcelamento e rateio por centro de custo (US-FN07)
- Baixa de pagamento com valor efetivo diferente do original (juros, desconto, multa) (US-FN08)
- Aging de CP com faixas de vencimento e alertas proativos (US-FN10)
- Lançamento de contas a receber com FUNRURAL e categorias rurais (US-FN11)
- Baixa de recebimento com flag de inadimplência e PDD simplificado (US-FN12)
- Dashboard financeiro: saldo total, aging CP, CR esperado 30d, resultado do mês (US-FN15)

**Should have (differentiators) — v1.x:**

- Conciliação bancária com import OFX/CSV e score de confiança no matching (US-FN06)
- Gestão de cartão corporativo: fatura vira lançamento de CP (US-FN02 + FN05)
- Transferências entre contas com tarifa e aplicações/resgates (US-FN04)
- Gestão de cheques pré-datados como entidade de primeira classe (US-FN09)
- Fluxo de caixa projetado com horizon de 12 meses e cenários (US-FN13)

**Defer (v2+):**

- Gestão de crédito rural com cronograma SAC/Price/Bullet e carência (US-FN14)
- CNAB 240/400 remessa/retorno
- Open Finance / integração bancária automática (Fase 5)
- Emissão de boletos e CPR
- Módulo fiscal / NF-e import

**Anti-features to avoid explicitly:** Open Finance (6-12 meses de homologação BACEN), emissão de boleto (convênio bancário individual), NF-e import (módulo fiscal separado), previsão de caixa com IA (dados históricos insuficientes nos primeiros 2 anos).

### Architecture Approach

The financial module follows the established collocated-module pattern of the existing 69 backend modules: one directory per subdomain, each with `routes.ts`, `service.ts`, and `types.ts`. The critical architectural decision is separating the document layer (payable/receivable records) from the ledger layer (`FinancialTransaction` table as audit trail) and the balance aggregate (`BankAccountBalance` updated atomically in every Prisma transaction that moves money). This mirrors the existing `StockBalance` pattern in `modules/stock-entries/` and avoids the "recompute balance from transaction history" anti-pattern. Every balance mutation runs inside a single `withRlsContext` Prisma transaction to guarantee consistency. Frontend follows the existing React Query + invalidation pattern — no financial state in React Context.

**Major components:**

1. `bank-accounts` — BankAccount + BankAccountBalance + FinancialTransaction ledger foundation; required by all other modules
2. `payables` + `receivables` — AP/AR document lifecycle: create → approve → settle; cost center apportionment as child rows; FUNRURAL on receivables
3. `payables-aging` — read-only aggregation service on payables; isolated to prevent coupling with write path
4. `bank-reconciliation` — OFX/CSV parse → preview → confirm flow; scored matching engine
5. `credit-cards` + `card-invoices` — corporate card lifecycle; closing invoice generates a payable
6. `cash-flow` — read-only projection service; must consume open AP, open AR, cheques in A_COMPENSAR state, and crédito rural installments across a 12-month horizon
7. `credit-rural` — amortization schedule generator (SAC/Price/Bullet with carência); generates installment payables on contract creation
8. `fin-dashboard` — pure aggregation across all modules; read-only, no service-to-service calls
9. `cheques` — pre-dated cheque entity with state machine (EMITIDO → A_COMPENSAR → COMPENSADO/DEVOLVIDO/CANCELADO)
10. Custom `cnab` utility — bank-specific adapters for CNAB 240/400 remessa/retorno generation and parsing

### Critical Pitfalls

1. **Float monetary arithmetic** — Use `decimal.js` for every monetary calculation from day one. Establish a `Money` type in `packages/shared/src/types/money.ts` before US-FN07 ships. Call `toNumber()` only at serialization boundaries. CNAB files represent amounts as integers in centavos — convert only at I/O boundary. Cost: HIGH to fix in production.

2. **Missing `producerId` on financial records** — Brazilian rural farms have multiple fiscal entities (proprietário, meeiro, arrendatário) sharing one physical farm. Bank accounts and AP/CR must carry `producerId` as a required FK from the first migration. Attaching only to `farmId` causes fiscal compliance failure and is expensive to backfill. Address in US-FN01.

3. **CNAB layout variance per bank** — FEBRABAN CNAB 240 is a standard that every major bank overrides with proprietary extensions. Implement a `CnabAdapter` interface per bank code from the start. Do not write a single `generateCnab240()` function. Start with BB (341) and Caixa (104) for PRONAF/PRONAMP coverage. Address in US-FN08.

4. **Cheques pré-datados as balance distortion** — Pre-dated cheques must be a first-class entity with `dataPrevista`, not a metadata field on a payment. The cash flow projection must consume cheques in `A_COMPENSAR` state at `dataPrevista`, not at issue date. Dashboard must always label "saldo bancário real" vs "saldo contábil". Address in US-FN09.

5. **Crédito rural amortization ignoring carência and Plano Safra rates** — PRONAF/PRONAMP contracts have subsidized rates, grace periods (carência), and agricultural-year-aligned payment schedules. Store the Plano Safra reference year on each contract; store rates as database records with effective date ranges, not hardcoded. Address in US-FN14.

6. **Reconciliation matching too strict** — OFX bank descriptions never match internal AP descriptions exactly. A scored matching engine with weighted criteria (amount exact match, date proximity within 3 business days, FUNRURAL net-vs-gross tolerance) is required. Exact-string matching produces near-zero auto-match rates and user abandonment. Address in US-FN06.

7. **OFX encoding failure** — Brazilian banks export OFX files in ISO-8859-1 with comma as decimal separator. Generic OFX parsers target North American banks (UTF-8, period decimal). Use `iconv-lite` for encoding detection and normalize decimal separators before parsing. Address in US-FN06.

8. **Seasonal cash flow horizon too short** — Agricultural income is concentrated in 2-3 months per year. A 90-day projection is useless for farm finance. US-FN13 must explicitly require a 12-month forward projection horizon. The saldo-negativo alert must fire at future projected dates.

## Implications for Roadmap

Based on the dependency analysis in ARCHITECTURE.md and FEATURES.md, the build order is strictly data-model-driven. No financial feature can exist without bank accounts; no projection can exist without AP/AR data. This maps cleanly to six phases.

### Phase 1: Fundacao Financeira (Foundation)

**Rationale:** All other financial modules reference `BankAccount`, `BankAccountBalance`, and `FinancialTransaction`. These must exist first. This phase also establishes the `Money` type and `producerId` FK — the two pitfalls that cannot be retrofitted.
**Delivers:** Bank account CRUD with real-time balance, account statement with export, `Money` type in shared package, `producerId` required on all financial entities, categories/chart of accounts pre-seeded.
**Addresses:** US-FN01 (contas bancárias), US-FN03 (extrato e saldo)
**Avoids:** Float arithmetic pitfall, `producerId` isolation pitfall — both must be established here before any financial data is written

### Phase 2: Nucleo AP/AR (Core Payables and Receivables)

**Rationale:** The AP/AR document lifecycle is the operational core of the module. This is what users interact with daily. It depends only on bank accounts (Phase 1). Aging queries are included here as a read-only service over payables — not a separate phase, as the data is already present.
**Delivers:** Full AP lifecycle (create, approve, settle, multi-instalment with correct `decimal.js` rounding, cost center apportionment), full AR lifecycle (create, receive, FUNRURAL deduction field, PDD flag), aging report with 7 due-date buckets and configurable alerts, export CSV/PDF/Excel.
**Addresses:** US-FN07 (contas a pagar + baixa), US-FN08 (baixa pagamento), US-FN10 (aging CP alertas), US-FN11 (contas a receber), US-FN12 (baixa recebimento inadimplência)
**Avoids:** Float arithmetic must be enforced here with `decimal.js`; FUNRURAL field introduced on AR from the start

### Phase 3: Dashboard Financeiro (Financial Dashboard)

**Rationale:** With Phase 1 (balances) and Phase 2 (AP/AR data) complete, the dashboard has all the data it needs. Releasing dashboard at this point gives users an immediately valuable landing page and validates the data model with real usage before building more complex features.
**Delivers:** Dashboard page with total balance across accounts, AP aging summary, AR expected 30d, monthly result, top expense categories, multi-farm aggregation toggle.
**Addresses:** US-FN15 (dashboard financeiro consolidado)
**Avoids:** Dashboard must show "saldo bancário real" vs "saldo contábil" labeling from day one — never merge them

### Phase 4: Instrumentos de Pagamento (Payment Instruments)

**Rationale:** Bank transfers, credit cards, and pre-dated cheques are extensions of the AP/AR core. They depend on payables and bank accounts being solid. Cheques must be its own entity (not a metadata field) to correctly feed the Phase 5 cash flow projection.
**Delivers:** Transfers between accounts (with tariff and investment/redemption), corporate credit card CRUD, card invoice import and closing (closing generates a payable), pre-dated cheque entity with state machine and state transitions, cheque integration into bank balance labels.
**Addresses:** US-FN04 (transferências), US-FN02 (cartões corporativos), US-FN05 (fatura cartão), US-FN09 (cheques pré-datados)
**Avoids:** Cheques-as-balance-distortion pitfall — data model must be correct here for cash flow to work in Phase 5

### Phase 5: Conciliacao e Fluxo de Caixa (Reconciliation and Cash Flow)

**Rationale:** Reconciliation needs bank accounts (Phase 1), payables/receivables (Phase 2), and real transaction history. Cash flow projection needs all open AP/AR, cheques, and recurring entries — requiring Phases 2 and 4 to be complete first. Both features have higher implementation risk and should be validated against real bank data.
**Delivers:** OFX/CSV bank statement import with parse → preview → confirm flow, scored matching engine (amount+date+FUNRURAL tolerance), 12-month cash flow projection with scenarios (optimistic/realistic/pessimistic), negative-balance-at-future-date alerts, harvest income planning fields.
**Addresses:** US-FN06 (conciliação bancária), US-FN13 (fluxo de caixa projetado)
**Avoids:** OFX encoding pitfall (iconv-lite + decimal normalization), reconciliation strict-matching pitfall (confidence-scored engine), seasonal-horizon pitfall (12-month mandatory)

### Phase 6: Credito Rural (Rural Credit)

**Rationale:** Rural credit is a high-value differentiator but also the most domain-specific and highest-complexity feature. It depends on payables (generates installment CP records). Deferring it allows the core module to go live and accumulate real data before implementing amortization schedules. This is the only phase that should have deeper research during planning.
**Delivers:** PRONAF/PRONAMP/Funcafé/CPR operation registration, SAC/Price/Bullet amortization schedule generator with carência, Plano Safra rate database (updated annually), installment payables auto-generated on contract creation, crop-calendar-aligned due dates, crédito rural installments feeding into Phase 5 cash flow projection.
**Addresses:** US-FN14 (gestão de operações de crédito rural)
**Avoids:** Crédito rural amortization pitfall — carência, rate equalization, agricultural-year alignment must all be explicit acceptance criteria

### Phase Ordering Rationale

- Phases 1 → 2 → 3 are strict data-model dependencies: accounts must exist before transactions, transactions must exist before aggregations.
- Phase 4 is isolated enough to begin in parallel with Phase 3 after Phase 2 is stable, but cheques must precede Phase 5 cash flow.
- Phase 5 requires real historical data (3+ months from Phases 2-3) for reconciliation validation; starting it early with synthetic data produces false confidence.
- Phase 6 is intentionally last — it is the most complex, most domain-specific, and least blocking for initial user adoption.

### Research Flags

Phases needing deeper research during planning:

- **Phase 6 (Crédito Rural):** BCB MCR amortization rules, Plano Safra rate equalization tables, carência modeling for each credit line type (Custeio, Investimento, Comercialização). This is specialist domain knowledge — research before implementation.
- **Phase 5 (Conciliação):** Validate `ofx-js` current npm status and maintenance before adopting; if unmaintained, fall back to custom OFX parser using already-installed `@xmldom/xmldom`. Collect real OFX samples from BB, Bradesco, Sicoob before designing matching engine.

Phases with established patterns (skip research-phase):

- **Phase 1 (Fundação):** Direct extension of existing `StockBalance` pattern — well-documented in codebase. No new patterns.
- **Phase 2 (AP/AR):** Standard payables/receivables with existing module structure. FUNRURAL is a field, not a new subsystem.
- **Phase 3 (Dashboard):** Pure read aggregation, existing `fin-dashboard` aggregation pattern documented in ARCHITECTURE.md.
- **Phase 4 (Instrumentos):** Extends existing AP patterns. Cheques are a new entity but straightforward state machine.

## Confidence Assessment

| Area         | Confidence | Notes                                                                                                                                                                                                                                                                                                                                      |
| ------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stack        | MEDIUM     | Existing libs (pdfkit, exceljs, iconv-lite) are HIGH confidence — already in project. `ofx-js` is LOW confidence — verify on npm. `date-fns` v4 vs v3 CommonJS compat needs verification. Custom CNAB is the correct call but requires upfront investment.                                                                                 |
| Features     | HIGH       | US-FN01 to US-FN15 are taken directly from PROJECT.md (primary source). Competitor analysis (Aegro, Siagri) is MEDIUM — training data, not verified. FUNRURAL and CNAB domain claims are HIGH — stable regulations.                                                                                                                        |
| Architecture | HIGH       | Derived from direct codebase analysis of 69 existing modules. Patterns (StockBalance, cost center apportionment, BulkImport flow) are confirmed implementations, not suggestions.                                                                                                                                                          |
| Pitfalls     | MEDIUM     | Float arithmetic, producerId isolation, CNAB variance, cheque balance distortion, and crédito rural amortization are HIGH confidence — domain-grounded. OFX encoding specifics for each bank and Plano Safra current rates are MEDIUM — training data, should be verified against current documentation before Phase 5 and 6 respectively. |

**Overall confidence:** MEDIUM-HIGH — architecture and features are solid; stack has two items needing npm verification; pitfall prevention is actionable.

### Gaps to Address

- **`ofx-js` npm status:** Run `npm info ofx-js` before Phase 5 implementation. If unmaintained, use `@xmldom/xmldom` (already installed) for OFX 2.x XML and a custom SGML parser for OFX 1.x. Document decision before starting US-FN06.
- **`date-fns` v4 ESM compat:** Run `node -e "require('date-fns')"` after install to verify CommonJS compat with backend. Fall back to `date-fns` v3 (`^3.6.0`) if v4 pure ESM causes bundling issues.
- **Plano Safra current rates:** Before Phase 6, fetch current PRONAF/PRONAMP rates from BCB MCR (febraban.org.br or bcb.gov.br) for 2025/2026 Plano Safra. Rates in training data reflect 2024 Plano Safra — likely changed.
- **Sicoob/Sicredi CNAB layouts:** These cooperatives dominate rural banking in Brazil but have non-standard CNAB layouts not covered in FEBRABAN base spec. Obtain their layout manuals before implementing Phase 6 CNAB adapters.
- **Real OFX samples from BR banks:** Reconciliation matching engine cannot be designed in the abstract. Collect real (anonymized) OFX exports from BB, Bradesco, Itaú, and Sicoob before Phase 5 implementation.

## Sources

### Primary (HIGH confidence)

- `PROJECT.md` — US-FN01 to US-FN15 requirements, acceptance criteria, out-of-scope items
- `apps/backend/src/modules/` (69 modules) — existing architectural patterns, confirmed implementations
- `apps/backend/prisma/schema.prisma` — ProducerFarmBond types, RLS architecture, StockBalance pattern reference
- `apps/backend/src/database/rls.ts` — organizationId isolation model
- `packages/shared/src/constants/design-tokens.ts` — design system token contracts
- FEBRABAN CNAB 240/400 standard structure — widely documented, HIGH confidence on format
- BCB Manual de Crédito Rural (MCR) — PRONAF/PRONAMP amortization rules
- Lei 8.212/1991, art. 25 — FUNRURAL 1.5% on gross rural revenue

### Secondary (MEDIUM confidence)

- npm ecosystem knowledge through August 2025 — `ofx-js`, `papaparse`, `date-fns` v4 ESM compat
- Brazilian rural ERP landscape (Aegro, Siagri, AgroSoft, GestãoAgro) — competitor feature analysis
- Brazilian OFX file encoding practices from major banks — training data, not verified against current bank documentation
- Plano Safra 2024/2025 interest rates — may be stale for current Plano Safra

### Tertiary (LOW confidence)

- `ofx-js` current npm version and maintenance status — verify with `npm info ofx-js` before adoption
- Sicoob/Sicredi specific CNAB layout extensions — obtain official layout manuals before implementation

---

_Research completed: 2026-03-15_
_Ready for roadmap: yes_
