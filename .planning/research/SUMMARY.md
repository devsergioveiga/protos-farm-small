# Project Research Summary

**Project:** Protos Farm — v1.4 Contabilidade e Demonstrações Financeiras
**Domain:** Rural farm accounting, double-entry GL, Brazilian SPED ECD compliance
**Researched:** 2026-03-26 / 2026-03-27
**Confidence:** HIGH (stack, architecture, pitfalls based on direct codebase inspection and official RFB sources); MEDIUM (SPED ECD edge cases, CPC 29 biological asset treatment)

---

## Executive Summary

This milestone adds a full double-entry general ledger and financial statement engine to a system that already has four complete milestones of operational data (payables/receivables, assets/depreciation, stock, HR/payroll). The accounting module does not build new financial infrastructure — it aggregates events from every existing module into journal entries, then produces DRE, Balanço Patrimonial, and DFC alongside a SPED ECD export. The most important design constraint is that the existing `accounting-entries` module is a flat-column stub (used only by payroll integration) and **must be superseded** by a proper two-table `journal_entries` + `journal_entry_lines` schema before any other work can proceed.

The recommended approach is a strictly sequential foundation-first build: chart of accounts and fiscal period management first, then journal entry engine (manual + automatic), then closing workflow, then financial statements, then SPED ECD last. This order is forced by hard dependencies — nothing else produces meaningful output without a valid chart of accounts and open periods. Zero new npm packages are required; the entire milestone is implementable with existing dependencies (pdfkit, decimal.js, exceljs, BullMQ, date-fns, recharts). The custom `SpedEcdWriter` pattern (mirroring the existing `CnabAdapter`) is the right approach for ECD generation since no production-ready Node.js library exists.

The key risks are: (1) the flat-row `AccountingEntry` model being extended instead of replaced, which will permanently block trial balance and cost-center DRE; (2) non-idempotent auto-generation hooks creating duplicate entries on retry; (3) rounding on rateio splits causing trial balance imbalances that the PVA validator will reject; and (4) ignoring the historical data continuity problem — the system needs an opening balance wizard before any financial statement is meaningful. All four risks are preventable with patterns already established in the codebase (StockBalance, CnabAdapter, installment-generator).

---

## Key Findings

### Recommended Stack

The milestone requires zero new npm packages. Every capability needed already exists in the installed dependency set. `pdfkit ^0.17.2` covers DRE/BP/DFC PDF generation following established patterns from payslips and pesticide prescriptions. `decimal.js ^10.6.0` via the existing `Money()` factory handles all monetary arithmetic with correct `ROUND_HALF_UP` for BRL. `exceljs ^4.4.0` covers trial balance and ledger exports. BullMQ (via ioredis) handles async SPED ECD generation for large files. `date-fns ^4.1.0` handles fiscal period and ECD deadline calculations.

The one architectural decision with no off-the-shelf solution is SPED ECD file generation. No production-ready Node.js library exists (the `sped-br` GitHub org is Python-only; `sped-checker` npm package validates only, does not generate). The correct approach is a custom `SpedEcdWriter` class in `src/shared/sped/` using the same record-by-record string accumulation pattern as the existing `CnabAdapter`.

**Core technologies:**

- `pdfkit` (existing): PDF generation for DRE, BP, DFC, closing reports — reuse established page-break pattern
- `decimal.js` via `Money()` (existing): All GL amounts, rateio splits, account balances — mandatory for BRL precision
- `exceljs` (existing): Trial balance and ledger CSV/XLSX export
- Custom `SpedEcdWriter`: SPED ECD Leiaute 9/12 pipe-delimited file — no Node.js library available; mirrors CnabAdapter
- `AccountBalance` incremental cache table: Balance computation (same pattern as `StockBalance`) — no materialized views
- PostgreSQL `WITH RECURSIVE` via `prisma.$queryRaw`: Chart-of-accounts tree traversal — Prisma does not support recursive CTEs natively
- BullMQ (existing): Async SPED ECD generation for large files, same pattern as eSocial batch export

### Expected Features

All three research files converge on the same feature dependency chain: Chart of Accounts is the gate for everything else.

**Must have — v1.4 MVP (P1):**

- Hierarchical chart of accounts (5 levels) with pre-loaded rural template (CFC/Embrapa model) and SPED referential account mapping
- Accounting periods with open/closed/reopened status and period-lock enforcement on every GL write
- Automatic journal entry generation for the four highest-volume event types: AP settlement, AR receipt, payroll run close, depreciation run
- Manual journal entries with `assertBalanced()` guard (debits must equal credits) and entry reversal (estorno) with full audit trail
- Opening balance wizard pre-populating from existing module data (bank balances, outstanding CP/CR, asset book values, payroll provisions)
- General ledger (Razão) per account with running balance (saldo progressivo), exportable to CSV/PDF
- Trial balance (Balancete de Verificação) in three-column format
- Monthly closing checklist with automated status queries against existing modules
- DRE with rural layout, vertical/horizontal analysis, comparison columns
- Balanço Patrimonial with rural asset classes (CPC 29 biological assets, terras rurais, crédito rural) and financial indicators
- DFC direct method leveraging existing cash flow classification from v1.0

**Should have — v1.4 completion (P2):**

- DFC indirect method (requires BP working first — CPC 03 R2)
- Per-culture / per-farm DRE drill-down via cost center attribution — the key rural differentiator
- Cross-statement validation panel (DRE net income = BP retained earnings change; DFC = BP cash change; BP assets = liabilities + PL)
- SPED ECD export with pre-submission validation against PVA rules
- PDF integrated financial report with explanatory notes (required for PRONAF/Funcafé credit applications)
- CPC 29 biological asset fair value adjustment with dedicated DRE section (non-cash item, reversed in DFC indirect)
- Executive accounting dashboard

**Defer to v1.5+:**

- Full LALUR / ECF (tax compliance scope, specialist complexity, separate product category)
- Budget planning module (separate product category)
- NF-e emission (requires SEFAZ homologation and digital certificate management)

### Architecture Approach

The architecture is built around 8 new backend modules following the established colocation pattern, plus GL hooks added to 6 existing modules (payroll, depreciation, payables, receivables, stock-entries, stock-outputs). The existing `accounting-entries` module is frozen read-only — it must not be extended. The new module boundary follows a clear write-side (`journal-entries`) / read-side (`ledger`) split with pure calculation engines for DRE/BP/DFC that have no Prisma imports, mirroring the `payroll-calculation.service.ts` pattern that produced 43 tests without a database.

**Major components:**

1. `modules/chart-of-accounts/` — Hierarchical COA CRUD, rural template seed, SPED referential mapping; foundation for all GL writes
2. `modules/fiscal-periods/` — Period open/close/reopen with closing checklist; `assertPeriodOpen()` wired on every GL write
3. `modules/journal-entries/` — Manual and automatic GL write engine; supersedes `accounting-entries` stub; enforces `assertBalanced()` and period lock
4. `modules/accounting-rules/` — Mapping table: `sourceType` → debit/credit account IDs; replaces hardcoded `ACCOUNT_CODES` constants
5. `modules/ledger/` — Read-side: Razão, Balancete, Livro Diário; no writes
6. `modules/financial-statements/` — DRE/BP/DFC orchestrator with pure calculator services (`dre-calculator.service.ts`, `bp-calculator.service.ts`, `dfc-calculator.service.ts`); pdfkit PDF export
7. `modules/sped-ecd/` — `SpedEcdWriter` + block builders for Blocos 0, I, J, K (optional), 9; async via BullMQ; pre-submission validation
8. `modules/accounting-dashboard/` — Executive KPI aggregation endpoint (presentation only, no new data sources)

**Key data model decisions:**

- Two-table GL: `JournalEntry` (header) + `JournalEntryLine` (account, side, amount, cost center) — never flat columns
- `AccountBalance` incremental cache table updated in the same Prisma transaction as journal entry posting (mirrors `StockBalance`)
- `PendingJournalPosting` queue table with `UNIQUE(sourceType, sourceId)` constraint for idempotent auto-generation
- `ChartOfAccount.isFairValueAdjustment: Boolean` flag required for CPC 29 DFC indirect reversal logic
- `FiscalYear` model with `startDate`/`endDate` (not just `year: Int`) to support safra-aligned fiscal years

### Critical Pitfalls

All 4 research files independently identified the same failure modes. Consensus is strong on all five.

1. **Flat-row AccountingEntry extended instead of replaced** — Creates a schema where trial balance requires UNION hacks, cost-center splits are impossible, and SPED I155 generation is blocked. Prevention: create `journal_entries` + `journal_entry_lines` tables in Phase 1 and freeze the old table read-only immediately.

2. **Non-idempotent auto-generation hooks create duplicate GL entries** — The existing `createPayrollEntries` has no duplicate guard. Prevention: add `UNIQUE(sourceType, sourceId)` constraint and `PendingJournalPosting` queue table before wiring any new module hooks. This is a pre-existing bug needing a hotfix now.

3. **Rateio rounding breaks trial balance and SPED ECD validation** — Naive `total * rate` per line accumulates rounding error; PVA validator rejects files where `SUM(debits) != SUM(credits)` to the centavo. Prevention: `rateio()` utility in `packages/shared` where the largest-share line absorbs the remainder (adapt `installment-generator.ts` pattern); store percentages as `DECIMAL(7,6)`.

4. **Period closing without immutability enforcement allows retroactive edits** — Auto-generated entries land in closed periods when source records are edited retroactively. Prevention: `assertPeriodOpen()` must be called on every GL write path, wired before any module integration begins.

5. **Historical data continuity gap** — System has 4 milestones of operational data with no corresponding GL history. Opening balance wizard must be built before any financial statement is meaningful. Prevention: "Saldo de Abertura" wizard pre-populates from existing modules; no retroactive GL generation needed.

---

## Implications for Roadmap

The dependency chain from FEATURES.md is strict and leaves no room for parallel phasing:

```
ChartOfAccounts + FiscalPeriods (foundation)
    → JournalEntries engine (write side)
        → AutomaticRules + ModuleHooks (event integration)
            → Closing checklist + period lock (workflow)
                → DRE + BP (statements)
                    → DFC direct (cash flow)
                        → DFC indirect + per-culture DRE (advanced statements)
                            → SPED ECD (compliance export)
```

### Phase 1: Plano de Contas e Períodos Fiscais

**Rationale:** Hard gate for everything else. No GL write can proceed without a valid COA and an open period. This phase also introduces the two-table schema that unfreezes the rest of the milestone and establishes all shared utilities.
**Delivers:** `ChartOfAccount` model + rural template seed (CFC/Embrapa model + SPED referential mapping), `FiscalPeriod` + `FiscalYear` models, `AccountBalance` cache table, `assertPeriodOpen()` utility, `assertBalanced()` utility, `rateio()` utility, COA CRUD API + frontend page, `isFairValueAdjustment` flag in model
**Addresses:** EPIC-C1 (Chart of Accounts, Accounting Periods, SPED referential mapping, Cost center linkage)
**Avoids:** Pitfall 1 (flat-row extension), Pitfall 3 (period immutability), Pitfall 2 (rounding utilities built here), Pitfall 8 (safra fiscal year support via `FiscalYear.startDate/endDate`)
**Research flag:** Standard patterns — PostgreSQL recursive CTE + Prisma self-referential model are well-documented; no additional research needed

### Phase 2: Lançamentos Manuais e Saldo de Abertura

**Rationale:** Manual journal entry engine must exist before any module integration. The opening balance wizard must be available before financial statements produce meaningful output.
**Delivers:** `JournalEntry` + `JournalEntryLine` tables and service, manual entry form with `assertBalanced()`, entry reversal (estorno) with audit trail, opening balance wizard pre-populating from existing modules, General Ledger (Razão) read view, Trial Balance (Balancete de Verificação) in three-column format
**Addresses:** EPIC-C2 (manual entries, reversal, Razão, Balancete); Pitfall 7 (historical data continuity)
**Avoids:** Pitfall 4 (flat-row schema replaced by new tables here), Pitfall 3 (period lock enforced from first write)
**Research flag:** Standard patterns — double-entry two-table schema is industry standard; no additional research needed

### Phase 3: Regras e Lançamentos Automáticos

**Rationale:** The highest-value deliverable. Connects all 4 existing milestones to the GL engine without manual re-entry. Must follow Phase 2 (writes to new tables). `PendingJournalPosting` queue is the idempotency mechanism.
**Delivers:** `AccountingRule` model and admin UI, `PendingJournalPosting` queue table with BullMQ processor, GL hooks for payroll close, depreciation run, AP settlement, AR receipt, stock entries/outputs; accounting dashboard "missing postings" alert section; fix for existing `createPayrollEntries` duplicate bug
**Addresses:** EPIC-C2 (automatic journal entries — all module event types); differentiator "zero manual mapping for standard farms"
**Avoids:** Pitfall 5 (non-idempotent triggers via queue + unique constraint), Pitfall 10 (FUNRURAL — two separate accounts: `3.1.03 FUNRURAL s/ Vendas` vs. `FUNRURAL Patronal` in payroll rules)
**Research flag:** Needs phase research — mapping rules for all 40-60 auto-generation rule types, FUNRURAL producer vs. employer account code distinction, and cost center attribution requirements per event type need precise Brazilian accounting guidance before implementation

### Phase 4: Fechamento Mensal

**Rationale:** Cannot close a period without confirmed postings from all modules. Phase 3 (auto-generation) must be complete first. Period close is the workflow gate before financial statements carry legal weight.
**Delivers:** Monthly closing checklist with automated status queries (payroll closed? depreciation posted? bank reconciliation done?), period lock enforcement on all GL writes, controlled reopening with audit log (`reopenedBy`, reason), accounting bank reconciliation (razão vs. extrato) as second layer on v1.0 bank reconciliation
**Addresses:** EPIC-C3 (closing checklist, accounting bank reconciliation, period lock and controlled reopening)
**Avoids:** Pitfall 3 (retroactive edits after close — period lock fully operational here)
**Research flag:** Standard patterns — closing checklist pattern already established in codebase (sanitary protocols, payroll close workflow)

### Phase 5: DRE e Balanço Patrimonial

**Rationale:** Financial statements are the primary end-user deliverable. DRE and BP are built together because cross-validation (DRE net income = BP retained earnings change) requires both simultaneously.
**Delivers:** Pure `DreCalculatorService` and `BpCalculatorService` (no Prisma imports, independently testable), DRE with rural layout + vertical/horizontal analysis + comparison columns, BP with CPC 29 biological asset classes + financial indicators (Liquidez Corrente, Liquidez Seca, Endividamento Geral, PL/hectare), cross-statement validation panel (4 invariant checks), PDF integrated financial report with explanatory notes
**Addresses:** EPIC-C4 (DRE), EPIC-C5 (BP), differentiator "per-culture DRE drill-down" (via cost center filter on journal entries), differentiator "cross-statement validation panel"
**Avoids:** Pitfall 9 (CPC 29 fair value — dedicated `Variação Valor Justo Ativo Biológico` DRE section using `isFairValueAdjustment` flag set in Phase 1), Pitfall 6 (J100/J150 subtotals derived from same GL query as trial balance, never computed independently)
**Research flag:** Needs phase research — CPC 29 biological asset DRE section layout and exact rural account group codes for fair value adjustments are sparsely documented; verify against current CFC/Embrapa model before implementation

### Phase 6: DFC e Dashboard Executivo

**Rationale:** DFC direct method reuses v1.0 cash flow classification (already built). DFC indirect method requires BP beginning/ending balances — Phase 5 must be complete first. Executive dashboard is presentation-only (no new data sources).
**Delivers:** `DfcCalculatorService` (direct + indirect), DFC direct using v1.0 cash event classification aggregated into CPC 03 R2 sections (Operacional, Investimento, Financiamento), DFC indirect method with working capital deltas and non-cash reversal (depreciation, provisions, biological asset fair value via `isFairValueAdjustment`), DFC cross-validation against BP cash change, executive accounting dashboard with 12-month trend charts (Recharts, already installed)
**Addresses:** EPIC-C6 (DFC direct + indirect), executive dashboard differentiator
**Avoids:** Pitfall 9 (CPC 29 phantom income correctly reversed in DFC indirect)
**Research flag:** Needs phase research — DFC indirect method CPC 03 R2 reconciliation line items and biological asset fair value reversal treatment need verification against official CVM source

### Phase 7: SPED ECD

**Rationale:** Strictly last. Requires validated closed-period balances and a working financial statement pipeline. Cannot produce a valid file before all other phases compute correct data.
**Delivers:** Custom `SpedEcdWriter` class in `src/shared/sped/`, all ECD block builders (Blocos 0, I, J, K optional, 9), key registers: I010, I050, I100, I150/I155, I200/I250, I350/I355, J150/J210, pre-submission validator against PVA rules (I050 uniqueness, period balance, analytic-only postings), async BullMQ generation for large files, safra fiscal year support in `DT_INI`/`DT_FIN`
**Addresses:** EPIC-C7 (SPED ECD generation + pre-submission validation)
**Avoids:** Pitfall 6 (structural mismatches — pre-validator checks all I050 constraints before file is written), Pitfall 8 (safra fiscal year via `FiscalYear.startDate/endDate` from Phase 1, never hardcoded), Pitfall 2 (rateio rounding — assertion `abs(sumDebits - sumCredits) < 0.005` before each I150/I155 block)
**Research flag:** Needs phase research — SPED ECD Leiaute 11 vs. 12 specific record differences (I155 and I157 changes for 2025 fiscal year); rural account referential codes L300R; current PGE validator version for CI integration

### Phase Ordering Rationale

- Phases 1 and 2 are strictly foundational and cannot be parallelized with anything. Every subsequent phase writes to tables and uses utilities created here.
- Phase 3 (automatic rules) is the highest-value phase but depends on Phase 2 (tables) and Phase 1 (period enforcement and COA).
- Phase 4 (closing workflow) must precede financial statements because official statements require closed periods.
- Phases 5 and 6 are both statement phases but DFC indirect depends on BP balances, so Phase 5 precedes Phase 6.
- Phase 7 (SPED ECD) is explicitly last — it validates and exports what all prior phases computed.
- The system becomes useful to a working contador at Phase 4 completion (trial balance + period close) and fully useful at Phase 5 completion (DRE + BP available for review and credit applications).

### Research Flags

Phases needing deeper research during planning:

- **Phase 3:** Brazilian accounting rules for all 40-60 auto-generation rule types; FUNRURAL producer vs. employer account code distinction (two different legal instruments); cost center attribution requirements per event type
- **Phase 5:** CPC 29 biological asset DRE presentation and exact account group codes for `Variação Valor Justo Ativo Biológico` in Brazilian rural GAAP; verify against current CFC/Embrapa rural chart-of-accounts model
- **Phase 6:** DFC indirect method CPC 03 R2 reconciliation items; biological asset fair value reversal treatment; verify against official CVM publication
- **Phase 7:** SPED ECD Leiaute 11 vs. 12 specific record differences (I155, I157 changes for 2025 fiscal year); L300R rural referential account codes; PGE validator version for CI use

Phases with standard patterns (skip research-phase):

- **Phase 1:** PostgreSQL recursive CTE, self-referential Prisma model, period management — well-documented and directly analogous to existing patterns
- **Phase 2:** Two-table double-entry schema, manual entry form with balance validation, reversal pattern — industry standard
- **Phase 4:** Closing checklist pattern already established in codebase (sanitary protocols module, payroll close); period lock is a straightforward service guard

---

## Confidence Assessment

| Area         | Confidence                                                                                                                                                                                                                                                                                          | Notes                                                                                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | HIGH                                                                                                                                                                                                                                                                                                | Zero new packages confirmed. All existing library versions verified on npm registry March 2026. SpedEcdWriter approach confirmed — no Node.js library exists for ECD generation.                            |
| Features     | HIGH                                                                                                                                                                                                                                                                                                | Brazilian accounting law (Lei 6.404/76), CPC standards, SPED ECD obligations, and rural accounting requirements are officially published. Competitor landscape verified against Aegro, Omie, Senior, TOTVS. |
| Architecture | HIGH                                                                                                                                                                                                                                                                                                | Based on direct codebase inspection of all 4 prior milestones. Existing patterns (StockBalance, CnabAdapter, payroll-calculation.service.ts) are directly applicable and confirmed.                         |
| Pitfalls     | HIGH for integration pitfalls (derived from direct code analysis of existing accounting-entries, payroll, depreciation modules); MEDIUM for CPC 29 biological asset GL treatment (principle clear, Brazilian application sparsely documented); LOW for safra-year edge cases (community forum only) |

**Overall confidence:** HIGH for Phases 1-4 and 7. MEDIUM for Phases 5-6 (CPC 29 fair value treatment, DFC indirect reconciliation) — these need phase-level research before requirements are written.

### Gaps to Address

- **CPC 29 fair value account codes:** The exact Brazilian rural account group structure for biological asset fair value adjustments (gain and loss accounts) needs verification against a current CFC/Embrapa chart-of-accounts model before the rural seed data is designed in Phase 1. Do not hardcode account codes without this verification.
- **SPED ECD Leiaute 12 scope:** Architecture references Leiaute 9 as the base. The 2025 fiscal year ECD uses Leiaute 12 (alphanumeric CNPJ support + I155/I157 record changes). Confirm current layout version and changed records before Phase 7 begins.
- **pdfkit-table dependency decision:** If trial balance PDFs exceed ~200 line items (large chart of accounts), `pdfkit-table ^0.1.45` may be needed. Verify pdfkit 0.17.2 compatibility before adding to avoid mid-phase dependency issues.
- **Existing `createPayrollEntries` duplicate bug:** The current payroll module creates duplicate GL entries if called more than once for the same run. This is a confirmed bug that needs a hotfix (idempotency guard) independently of when Phase 3 is executed — it should be addressed as a standalone fix on the current branch.

---

## Sources

### Primary (HIGH confidence)

- RFB SPED ECD official documentation (sped.rfb.gov.br) — block structure, Leiaute 9/11/12, L300R rural referential accounts
- CVM CPC 03 R2 (official) — DFC direct and indirect method requirements
- CPC 29 / IAS 41 (official, via Unifaj academic publication) — biological asset fair value treatment
- Direct codebase inspection — `accounting-entries` module, `payroll-runs.service.ts`, `StockBalance` pattern, `CnabAdapter` pattern, `installment-generator.ts`
- npm registry (March 2026) — pdfkit 0.17.2, decimal.js 10.6.0, exceljs 4.4.0 verified

### Secondary (MEDIUM confidence)

- Qive Blog, Econet — SPED ECD 2025 obligations and deadlines
- Senior ERP documentation — integration contábil patterns reference
- Aegro, Omie product analysis — rural accounting competitor feature landscape
- Square Books engineering post — double-entry schema pattern (accounts + journal_entries + book_entries)
- Journalize.io DB schema post — journal entry / ledger line schema pattern
- CNA Brasil — rural accounting Brazilian particularities

### Tertiary (LOW confidence)

- pdfkit-table 0.1.45 compatibility with pdfkit 0.17 — community, needs verification before use
- Safra-year fiscal calendar ECD submission edge cases — community forum only; needs RFB official source

---

_Research completed: 2026-03-27_
_Ready for roadmap: yes_
