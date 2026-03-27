# Feature Research

**Domain:** Rural Farm Accounting & Financial Statements — Brazilian Farm Management ERP
**Researched:** 2026-03-27
**Confidence:** HIGH — Brazilian accounting law (Lei 6.404/76, CPC/NBC standards), SPED ECD format, and rural accounting particularities are officially published and unambiguous. Competitive landscape verified against Aegro, Omie, Senior, and TOTVS documentation. ECD 2026 layout requirements verified against RFB official publications.

---

## Context: What Already Exists

This accounting module is built on top of four shipped milestones. It does NOT build new financial infrastructure — it consumes every existing module as a source of accounting events:

| Existing Module | Role in Accounting |
|---|---|
| `bank-accounts` / `reconciliation` (v1.0) | Source of cash movements for DFC; banco vs razão reconciliation |
| `payables` / `receivables` (v1.0) | AP/AR source for automatic journal entries |
| `cash-flow` (v1.0) | DFC classification already exists on each cash event |
| `rural-credit` (v1.0) | Long-term debt entries in Balanço Patrimonial |
| `stock-entries` / `stock-outputs` / `stock-inventories` (EPIC-10) | Inventory cost entries, COGS entries |
| `assets` / `depreciation` (v1.2) | Fixed asset entries, accumulated depreciation, disposals, CPC 06 leasing |
| `payroll` / `provisions` (v1.3) | Salary expense, INSS/FGTS/FUNRURAL payables, vacation/13th provisions |
| `purchase-orders` / `receiving` (v1.1) | Supplier invoice cost allocation |
| `field-operations` / `harvests` | Cost of production allocation to crop/livestock cost centers |
| `cost-centers` | Already spans all modules; accounting just maps them to DRE/BP lines |

**The accounting module's primary job is:** receive events from these modules → generate double-entry journal entries → aggregate into trial balance → produce DRE, BP, DFC → export SPED ECD.

---

## Feature Landscape

### Table Stakes — Chart of Accounts (EPIC-C1)

These are non-negotiable. Without a correct chart of accounts, nothing else in accounting works.

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| Hierarchical chart of accounts (5 levels) | Mandatory for double-entry bookkeeping, SPED ECD registration, and financial statement aggregation. Rural entities need groups: Ativo Circulante (Caixa, Bancos, Estoques, Produtos Agrícolas, Ativos Biológicos Circulantes), Ativo Não Circulante (Imobilizado, Ativos Biológicos Permanentes, Investimentos), Passivo, PL, Receitas (Vendas Safra, Pecuária, Serviços), Custos (Custo de Produção por Cultura), Despesas Operacionais | HIGH | Must support both synthetic (group) accounts and analytic (posting) accounts. Synthetic accounts aggregate; only analytic accounts receive postings. |
| Pre-loaded rural chart of accounts template | Farms cannot build from scratch. Industry standard follows CFC/Embrapa model. Accounts for ativos biológicos (CPC 29), rural depreciation rates (IN RFB 1.700/2017), FUNRURAL, Livro Caixa Digital (LCDPR) must be present out of the box | MEDIUM | Template should follow Plano de Contas Referencial da RFB for SPED ECD — specifically accounts starting with 3.11/3.12 for rural result accounts. Farms can extend but not delete seeded accounts |
| SPED referential account mapping | Each chart of accounts entry must map to the RFB referential plan (Tabelas L100, L300, L300R for rural). Required for ECD export. Without this mapping, SPED file is rejected | HIGH | Rural result accounts (3.11.xx) are separate from general accounts (3.0.xx). The system must enforce that each analytic account is mapped before allowing period close. |
| Accounting periods and fiscal year | Brazilian fiscal year = calendar year (Jan–Dec) for most rural entities. Periods must have status: Aberto, Em Fechamento, Fechado. Posting to a closed period must be blocked | MEDIUM | Reopening a closed period must require explicit permission (accounting:reopen) and generate audit log entry. |
| Cost center → accounting account linkage | Every cost center already exists in the system. Accounting needs bidirectional linkage: a posting on CC "Soja — Fazenda Boa Vista" maps to DRE line "Custo de Produção — Lavoura" | MEDIUM | This is how per-crop and per-farm DRE is generated. Not cost center management itself (already built) — just the accounting mapping table. |

---

### Table Stakes — Journal Entries and Ledger (EPIC-C2)

The core of double-entry accounting. Every transaction becomes debit/credit pairs.

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| Automatic journal entry generation from module events | The primary value proposition: when a payable is paid, a PO is received, depreciation runs, or payroll closes, journal entries are generated automatically via mapping rules. Without this, the accountant re-enters everything manually | HIGH | Mapping rules table: event type → (debit account, credit account, amount source, cost center). Each module generates events; accounting subscribes. Events to cover: AP payment, AR receipt, stock entry/output, depreciation, payroll run, provision, asset disposal, bank transfer |
| Manual journal entries with double-entry validation | Accountants need to post adjustments, accruals, corrections not covered by automatic rules. System must enforce debits = credits on save. | MEDIUM | Support for compound entries (multiple debit/credit lines in one voucher). Mandatory fields: date, description, accounts, amounts, cost center. |
| Journal entry templates | Recurring entries (monthly provisions, accruals, depreciation supplements) should be templated to avoid repetition | LOW | Template stores accounts + amounts/formulas; accountant reviews and posts. |
| CSV import of journal entries | Accountants migrating from external tools or posting bulk adjustments need CSV import | MEDIUM | Format: date, description, account_code, debit, credit, cost_center. Validate: account exists, debits = credits per voucher, period is open. |
| Entry reversal (estorno) with full audit trail | Incorrect entries must be reversed, not deleted. Brazilian accounting law requires immutable records. Reversal creates a new counter-entry linked to the original | MEDIUM | Reversal must copy original entry with inverted amounts, link to original ID, set reason field. Original entry status: "Estornado". Both appear in ledger. |
| General ledger (Razão) per account with running balance | Accountants and auditors need to drill into any account and see every posting with running balance (saldo progressivo). This is the primary daily-use view. | MEDIUM | Filter by date range, cost center, period. Export to CSV/PDF. Running balance starts from account's carry-forward balance. |
| Trial balance (Balancete de Verificação) | Monthly view proving debits = credits = zero net. Shows opening balance + movements + closing balance for every analytic account. Required by auditors and for SPED ECD. | MEDIUM | Three-column format (saldo anterior, movimentos, saldo atual). Support comparison vs prior month or prior year. |
| Day book (Livro Diário) | Legal document required by Lei 6.404/76. Chronological listing of all journal entries. Must be generated for SPED ECD Registro J. | MEDIUM | Generated per fiscal year. Exported as part of SPED ECD J010/J050/J100 records. |

---

### Table Stakes — Monthly Closing (EPIC-C3)

Without structured closing, periods bleed into each other and financial statements are unreliable.

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| Monthly closing checklist with dependent steps | Closing has a fixed sequence: (1) confirm all bank reconciliations, (2) confirm all module postings (payroll, depreciation, stock), (3) run trial balance, (4) post manual adjustments, (5) lock period. A checklist with status indicators ensures nothing is skipped | HIGH | Each checklist step queries the relevant module: "Are all depreciation runs complete for this period?", "Is payroll closed?", "Is bank reconciliation marked done?". Steps can be marked overridden with justification. |
| Accounting bank reconciliation (razão vs. extrato) | The v1.0 module reconciled bank statements vs. system cash entries. Accounting adds a second layer: the bank account in the general ledger must also match the bank statement. This is the contábil layer on top of the financeiro layer. | HIGH | Query: sum of ledger entries to bank account X in period = bank statement ending balance. Discrepancies show as unreconciled items. Common source: timing differences (checks in transit, deposits in transit). |
| Period lock and controlled reopening | Once closed, no postings allowed. Reopening requires explicit permission and generates audit event. Essential for statement reliability. | LOW | Permission: accounting:period:reopen. Reopening logs: user, timestamp, reason. All statements regenerated after reopen. |

---

### Table Stakes — Financial Statements (EPIC-C4, C5, C6)

The output users actually need. Without these, the accounting module has no end-user value.

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| DRE (Income Statement) with rural layout | Mandatory for Lucro Real and Lucro Presumido entities. Rural DRE has specific structure: Receita Bruta (vendas safra + pecuária + serviços) → (-) Deduções (FUNRURAL, impostos sobre receita) → Receita Líquida → (-) Custo de Produção (insumos + mão de obra + depreciação máquinas + custo terra) → Lucro Bruto → (-) Despesas Operacionais → Resultado Operacional → (+/-) Resultado Financeiro → Lucro/Prejuízo Líquido | HIGH | Layout must be configurable — each DRE line maps to one or more chart of accounts groups. Supports comparison columns: actual vs. budget, current year vs. prior year. |
| DRE vertical and horizontal analysis | Accountants and farm owners need % analysis: what % of revenue is each cost line? Year-over-year % change? These are standard analytical columns in Brazilian financial reporting. | MEDIUM | Vertical: each line as % of net revenue. Horizontal: % change vs. prior period (or prior year). Computed on the fly from the aggregated values. |
| DRE by cost center / culture / farm | The key rural differentiator: "Did the soy harvest make money? Did the cattle operation?" Multi-dimensional DRE filtered by cost center. | HIGH | Requires that all journal entries carry cost center attribution. Aggregation: cost center tree maps to crop/livestock/farm dimensions. |
| Balanço Patrimonial (Balance Sheet) with rural asset classes | BP must correctly represent: Ativos Biológicos (CPC 29 — animals at fair value, crops in formation at cost), Terras Rurais (not depreciated), Imobilizado rural, Estoques de insumos (already in stock module), Dívidas de crédito rural (PRONAF, CPR). | HIGH | Ativos Biológicos at fair value is a CPC 29 requirement — the system must support posting fair value adjustments. Land is not depreciated in Brazil (RFB IN 1.700/2017). |
| BP financial indicators | Farm investors and banks require quick ratios: Índice de Liquidez Corrente, Liquidez Seca, Endividamento Geral, PL/hectare, Imobilização PL. Computed from BP balances automatically. | MEDIUM | PL/hectare is rural-specific — requires farm area from the farms module (already built). |
| DFC direct method | Shows actual cash receipts and payments by category. Simpler for farm owners to understand. Partially built in v1.0 cash flow module — accounting DFC maps those cash flows to the three CPC 03 sections: Operacional, Investimento, Financiamento. | HIGH | Reuse the DFC classification already on cash entries from v1.0. Accounting layer aggregates and validates that Operating + Investing + Financing = net change in cash balance. |
| DFC indirect method | Starts from net income, adjusts for non-cash items (depreciation, provisions) and working capital changes. Required by most auditors and banks alongside or instead of direct method. CPC 03 (R2) accepts both. | HIGH | Formula: Lucro Líquido + Depreciação + (Δ Contas a Receber) + (Δ Estoques) + (Δ Contas a Pagar) = Cash from Operations. Δ values come from BP beginning vs. ending balances. |

---

### Table Stakes — SPED ECD Export (EPIC-C7 partial)

Legal compliance. Required for Lucro Real entities; rural PJ with receita bruta > threshold must file.

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| SPED ECD file generation (RFB layout) | All Lucro Real PJ and large rural entities must file ECD annually. Deadline: last business day of June. Layout defined by IN RFB 2.003/2021 and updated annually (2026 version: PGE 10.3.4+ with alphanumeric CNPJ support). | HIGH | Must generate: Bloco 0 (identification), Bloco C (BP/DRE/DFC journals), Bloco I (Livro Diário), Bloco J (statements), Bloco K (LALUR — optional), Bloco 9 (closing). Rural entities use L300R (accounts 3.11.xx). |
| SPED ECD validation before submission | The RFB's PGE validator rejects files with missing referential mappings, unbalanced periods, or incorrect CNPJ/CPF data. The system should run the same validation rules before export so the accountant can fix errors ahead of time. | HIGH | Validation rules: all analytic accounts mapped to referential plan, all periods balanced (debits=credits), no postings to synthetic accounts, fiscal year dates consistent, CNPJ format valid. |

---

### Differentiators — Rural-Specific Accounting Features

Features that set this system apart from generic ERP accounting modules.

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| Automatic journal entries for ALL existing modules | Generic ERP systems require manual posting rules per company. This system ships with pre-built rules for AP, AR, payroll, depreciation, stock entries/outputs, asset disposals, bank transfers, rural credit. Zero manual mapping for a new farm. | HIGH | This is the highest-value feature. Investment: 40–60 mapping rules covering every event type in all 4 shipped milestones. Configurable per-farm overrides. |
| DRE by crop/livestock culture with cost allocation | Most farm accounting tools show consolidated DRE. Per-culture DRE requires full cost center drill-down. Shows "Soja made R$ 2.3M margin, Milho lost R$ 400K" — actionable by farm managers. | HIGH | Requires consistent cost center tagging across all modules. Already built in v1.0–v1.3; accounting just aggregates. This becomes a true management accounting tool. |
| Cross-statement validation panel (DRE ↔ BP ↔ DFC) | "Net income in DRE must equal change in Retained Earnings in BP." "Change in cash in DFC must equal change in bank account balance in BP." These cross-checks reveal errors before auditors do. No competitor in the agro SMB space does this automatically. | HIGH | Four validation rules: (1) DRE net income = BP retained earnings change, (2) DFC net change in cash = BP cash change, (3) BP assets = BP liabilities + PL, (4) DFC sections sum = net cash change. |
| CPC 29 biological asset fair value postings | Cattle at fair value (market price × number of head) must be updated periodically, with gain/loss posted to DRE. This is required by CPC 29 (IAS 41) but most SMB systems ignore it. | HIGH | Integration point: livestock module already tracks head count and category. Fair value = market price per category × count. The system needs a market price input + auto-calculation of adjustment entry. |
| PDF integrated financial report with explanatory notes | Banks, cooperatives, and rural credit programs (PRONAF, Funcafé) require formal financial statements with numbered notes. Professional multi-statement PDF covering DRE + BP + DFC with notes is a requirement for rural credit approval. | HIGH | Notes auto-populate from system data: accounting policies, depreciation rates used, biological asset measurement basis, rural credit details, contingent liabilities from legal module. |
| Rural depreciation rate intelligence | RFB IN 1.700/2017 allows accelerated depreciation for rural machinery: tractors 4 years (25%/year), implements 2 years (50%/year), vs. standard 10 years for general industrial machinery. The system should pre-populate these rates in asset categories and flag mismatches. | MEDIUM | Cross-reference with v1.2 asset module depreciation rates already set. Alert if asset category "Trator Agrícola" has non-rural depreciation rate. |
| Executive accounting dashboard | Farm owners (not accountants) need a single-page view: monthly result trend, current liquidity ratios, debt/equity, cumulative DRE vs. budget. This is the "board-level" view on top of raw accounting data. | MEDIUM | Reuses all financial statement data already computed. Charts: DRE 12-month trend, BP liquidity trend, DFC rolling 3-month. No new data — just presentation layer. |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| Full LALUR (Livro de Apuração do Lucro Real) | Required for Lucro Real IRPJ calculation | LALUR is for ECF (Escrituração Contábil Fiscal), not ECD. It involves tax adjustments, exclusions, additions, and compensation of prior losses. This is tax compliance, not accounting — it requires a dedicated module and specialist knowledge. Building it partially creates compliance risk. | Build SPED ECD first. Flag LALUR as v1.5 scope. Export Bloco K fields as empty/optional in ECD. |
| NF-e emission from accounting | Integrated NF-e would complete the farm workflow | NF-e emission requires SEFAZ homologation, digital certificates per CNPJ, and ongoing regulatory maintenance. It's a separate certified product. | Document the integration point: NF-e data from Aegro/external tool imports into receiving/stock modules. Already in PROJECT.md out-of-scope. |
| Real-time accounting (postings on every keystroke) | Seems more accurate | Creates performance problems, race conditions on concurrent edits, and makes period closing meaningless. Accounting is inherently periodic. | Batch posting model: events are queued and posted on demand (or at period close). Manual trigger with preview before commit. |
| Multi-GAAP support (IFRS + BR GAAP simultaneously) | Large farms with foreign investors may request it | Dual-book accounting doubles complexity, requires separate charts of accounts, separate closing processes, and specialized accounting knowledge. No agro SMB system does this. | Build IFRS-friendly structure (CPC standards are converged to IFRS). Add disclosure notes for common IFRS adjustments. |
| Automated AI chart of accounts mapping | "AI can map transactions to accounts" | AI mapping for accounting creates legal risk: incorrect posting = incorrect financial statement = regulatory non-compliance. In Brazil, the contador responsible can face CRC sanctions. | Rule-based mapping with explicit configuration and human review. The automatic journal entries are rule-based, not ML-based. |
| Budget vs. actual variance alerts (full budgeting module) | "Alerts when costs exceed budget" | A full budgeting module is a separate product (involves budget planning, multi-scenario, revision workflows). Building it inside accounting creates feature bloat. | DRE already supports budget comparison columns when budget data exists. Feed budget from a simple CSV import. Full budgeting module is v1.5+ scope. |

---

## Feature Dependencies

```
Chart of Accounts (EPIC-C1)
    └──required by──> Journal Entries (EPIC-C2)
                          └──required by──> Monthly Closing (EPIC-C3)
                                                └──required by──> DRE/BP/DFC (EPIC-C4/C5/C6)
                                                                      └──required by──> SPED ECD (EPIC-C7)

Accounting Periods (EPIC-C1)
    └──required by──> ALL posting operations

Automatic Posting Rules (EPIC-C2)
    └──feeds──> All statement aggregations

Existing Modules (v1.0–v1.3)
    └──provide events to──> Automatic Journal Entries (EPIC-C2)

Cost Centers (existing)
    └──required for──> Per-culture DRE (EPIC-C4)
    └──required for──> BP attribution (EPIC-C5)

DRE net income (EPIC-C4)
    └──cross-validates──> BP retained earnings change (EPIC-C5)

DFC cash change (EPIC-C6)
    └──cross-validates──> BP cash balance change (EPIC-C5)
    └──cross-validates──> Bank reconciliation (EPIC-C3)

All three statements (EPIC-C4/C5/C6)
    └──required by──> Cross-statement panel (EPIC-C7)
    └──required by──> PDF integrated report (EPIC-C7)
    └──required by──> SPED ECD export (EPIC-C7)
```

### Dependency Notes

- **Chart of Accounts must be Phase 1:** Every other feature depends on it. Seeding the rural template is a one-time migration that must happen before any postings.
- **Automatic posting rules (EPIC-C2) are the highest-value deliverable:** They transform the existing 4 milestones into an accounting system without re-entry. These rules are complex to build but simple to use.
- **SPED ECD cannot be Phase 1:** It requires validated balances from closed periods, which requires the full pipeline to be operational first.
- **DFC indirect method depends on BP:** The working capital delta computation requires beginning-of-period and end-of-period BP balances. Build BP (EPIC-C5) before DFC indirect (EPIC-C6).
- **Cross-statement validation (EPIC-C7) is last:** It only makes sense when all three statements produce valid data.

---

## MVP Definition

### Launch With (v1.4 MVP — Phase 1–4)

These features make the module useful to a working contador for a Brazilian rural PJ.

- [ ] Hierarchical chart of accounts with rural template pre-loaded and SPED referential mapping
- [ ] Accounting periods with open/closed status
- [ ] Automatic journal entry generation for AP, AR, payroll, depreciation (the four highest-volume event types)
- [ ] Manual journal entries with double-entry validation and reversal
- [ ] General ledger (Razão) per account with running balance
- [ ] Trial balance (Balancete de Verificação)
- [ ] Monthly closing checklist with module status checks and period lock
- [ ] DRE with rural layout, comparison columns, vertical/horizontal analysis
- [ ] Balanço Patrimonial with rural asset classes and financial indicators
- [ ] DFC direct method (leverages v1.0 cash flow classification)

### Add After Core is Validated (v1.4 completion — Phase 5–7)

- [ ] DFC indirect method — adds significant analytical value, requires BP to be working first
- [ ] Per-culture / per-farm DRE drill-down — highest-value differentiator, depends on all entries having cost center
- [ ] Cross-statement validation panel (DRE ↔ BP ↔ DFC)
- [ ] SPED ECD export with pre-submission validation — required for compliance but needs full data pipeline first
- [ ] PDF integrated financial report with explanatory notes — required for rural credit applications
- [ ] CPC 29 biological asset fair value adjustment — needed for compliant BP on cattle-heavy farms
- [ ] Executive accounting dashboard

### Future Consideration (v1.5+)

- [ ] Full LALUR for IRPJ calculation — ECF scope, specialist complexity
- [ ] Budget planning module — separate product category
- [ ] NF-e emission — requires SEFAZ homologation
- [ ] Open Finance API integration — regulatory complexity

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| Chart of accounts + rural template | HIGH | MEDIUM | P1 |
| Accounting periods | HIGH | LOW | P1 |
| Automatic journal entries (AP/AR/payroll/depreciation) | HIGH | HIGH | P1 |
| Manual journal entries + reversal | HIGH | MEDIUM | P1 |
| General ledger (Razão) | HIGH | MEDIUM | P1 |
| Trial balance | HIGH | LOW | P1 |
| Monthly closing checklist | HIGH | MEDIUM | P1 |
| DRE with rural layout | HIGH | HIGH | P1 |
| Balanço Patrimonial | HIGH | HIGH | P1 |
| DFC direct method | HIGH | MEDIUM | P1 |
| DFC indirect method | MEDIUM | HIGH | P2 |
| Per-culture DRE drill-down | HIGH | MEDIUM | P2 |
| Cross-statement validation | HIGH | MEDIUM | P2 |
| SPED ECD export | HIGH | HIGH | P2 |
| PDF integrated report | MEDIUM | HIGH | P2 |
| CPC 29 biological asset fair value | MEDIUM | MEDIUM | P2 |
| Executive dashboard | MEDIUM | LOW | P2 |
| SPED referential mapping enforcement | HIGH | MEDIUM | P1 |
| Automatic journal entries (stock/assets/bank) | MEDIUM | HIGH | P2 |
| LALUR / ECF | LOW | HIGH | P3 |
| Budget module | LOW | HIGH | P3 |

---

## Competitor Feature Analysis

| Feature | Aegro | Omie (generic ERP) | Senior/TOTVS (large ERP) | Our Approach |
|---|---|---|---|---|
| Rural chart of accounts template | LCDPR-focused, no full GAAP chart | Generic Lucro Real template, not rural-specific | Full rural chart (Siagri) | Pre-loaded CFC/Embrapa model with SPED referential pre-mapped |
| Automatic journal entries | NF-e → LCDPR, not double-entry | Module integration via parametrizable rules | Full automatic integration all modules | Pre-built rules for all 4 milestones; zero configuration for standard farms |
| DRE per culture | Profit by talhão (cost tracking, not GAAP DRE) | Not available | Available in Siagri/Agrotitan | GAAP DRE with cost center drill-down to culture/farm level |
| SPED ECD export | Not advertised; integrates with Domínio/Alterdata | Via accounting software integration | Native export | Native generation with pre-validation |
| CPC 29 biological assets | Fair value tracking via herd module | Not available | Available in specialized modules | Fair value posting integrated with livestock module |
| DFC indirect method | Not available | Available | Available | Both direct and indirect; cross-validated against BP |
| Cross-statement validation | Not available | Not available | Available in large ERPs only | Built as explicit panel — differentiator for agro SMB |
| PDF financial report for credit | Not available | Generic PDF | Available | Structured notes linking to rural credit (PRONAF/Funcafé) terms |

---

## Sources

- [SPED ECD — RFB Official](http://sped.rfb.gov.br/projeto/show/273) — MEDIUM confidence (official source, content summary only)
- [ECD 2025 — Qive Blog](https://qive.com.br/blog/sped-contabil-ecd) — MEDIUM confidence (describes layout and obligations)
- [ECD Obrigatoriedade — Econet](https://blog.econeteditora.com.br/ecd-2025-obrigatoriedade-regras-prazos/) — MEDIUM confidence
- [Planos Referenciais SPED — RFB](http://sped.rfb.gov.br/arquivo/show/7308) — HIGH confidence (official RFB publication, rural accounts 3.11/3.12 structure)
- [CPC 03 R2 — CVM](https://conteudo.cvm.gov.br/export/sites/cvm/menu/regulados/normascontabeis/cpc/CPC_03_R2_rev_10.pdf) — HIGH confidence (official CVM/CPC publication)
- [Aegro Contabilidade Agronegócio](https://aegro.com.br/contabilidade-do-agronegocio/) — MEDIUM confidence (competitor product analysis)
- [Contabilidade Rural — CNA](https://www.cnabrasil.org.br/noticias/contabilidade-rural-possui-particularidades-exclusivas-do-campo) — MEDIUM confidence (industry body)
- [Integração Contábil — Senior](https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/erp/controladoria/gestao-contabilidade/integracao-contabil.htm) — MEDIUM confidence (ERP documentation pattern reference)
- [CPC 29 — Reiva/Unifaj](https://reiva.unifaj.edu.br/reiva/article/download/249/197/832) — HIGH confidence (academic, based on official CPC 29)
- [Sankhya Contabilidade Rural](https://www.sankhya.com.br/blog/contabilidade-rural/) — LOW confidence (vendor marketing)

---
*Feature research for: Rural Farm Accounting & Financial Statements (v1.4)*
*Researched: 2026-03-27*
