# Pitfalls Research

**Domain:** Adding accounting/GL, chart of accounts, journal entries, and financial statements (DRE/BP/DFC/SPED ECD) to an existing rural farm management ERP (v1.0–v1.3 already live: financials, procurement, assets, HR/payroll)
**Researched:** 2026-03-26
**Confidence:** HIGH for double-entry consistency and Brazilian SPED ECD validation rules (verified with official RFB sources and direct schema analysis); HIGH for integration pitfalls (derived from codebase analysis of existing accounting-entries module, payroll, depreciation, and stock modules); MEDIUM for CPC 29 / biological asset GL treatment (verified with IFRS/IAS 41 sources, Brazilian application is sparsely documented); MEDIUM for DFC cross-validation mechanics (multiple sources agree on principle, implementation detail LOW); LOW for safra-year fiscal calendar edge cases (community forum only).

---

## Critical Pitfalls

### Pitfall 1: Double-Entry Broken by Aggregate-Amount Journal Entries

**What goes wrong:**
The existing `accounting-entries` module (INTEGR-02) creates one journal entry per payroll run aggregated to a single amount — e.g., one `PAYROLL_SALARY` entry for the total gross of all employees, not one per employee. When the new chart-of-accounts module adds support for cost-center rateio (split by farm/setor), the per-run aggregate model silently breaks double-entry because each split line has a debit but only the aggregate has a credit. The resulting ledger fails the invariant: `SUM(debits) = SUM(credits)` per period when queried by cost center.

Separately: any place where a journal entry is created without an atomic check that `debit_amount = credit_amount` will pass unit tests that only inspect the created record but will corrupt the GL the moment a rounding or logic bug in the calling code produces an imbalanced entry.

**Why it happens:**
The existing module was built as a "shadow ledger" for payroll only — it does not need cost-center splits to show on payslips. When full double-entry GL is added, the aggregate pattern is carried forward because it already works for its original purpose.

**How to avoid:**
- Implement a DB-level CHECK constraint on the `journal_entries` table: the sum of all lines with `side = 'DEBIT'` must equal the sum of all lines with `side = 'CREDIT'` for each journal entry. Use a PostgreSQL trigger or a deferred constraint on `journal_entry_lines`.
- Never store `debitAccount`/`creditAccount`/`amount` as flat columns on a single row. Use the canonical two-table design: `JournalEntry` (header: period, source, description) + `JournalEntryLine` (account_code, side, amount, cost_center_id). The existing `AccountingEntry` flat-column model must be replaced or adapted — do NOT extend it.
- For the migration of existing `AccountingEntry` records into the new schema: each old record maps to one `JournalEntry` with exactly two `JournalEntryLine` rows (one DEBIT, one CREDIT). Write a migration script that validates `count(AccountingEntry) * 2 = count(JournalEntryLine)` before marking migration complete.
- Add a service-level guard: `assertBalanced(lines: JournalEntryLine[]): void` that throws before any `prisma.create` if `sumDebits !== sumCredits`. Call it in every auto-generation path (payroll, depreciation, stock, payables).

**Warning signs:**
- Balancete de verificação (trial balance) shows non-zero `SUM(debits) - SUM(credits)`.
- A cost center DRE shows expenses without matching liability credits.
- Tests pass by asserting only on the created record, not on the aggregate balance of the period.

**Phase to address:** Plano de Contas e Estrutura do Livro Diário (first accounting phase) — the `JournalEntry` + `JournalEntryLine` schema must be the foundation before any auto-generation wiring.

---

### Pitfall 2: Rounding on Journal Entry Lines Breaks the Period Trial Balance

**What goes wrong:**
The system already uses `Decimal.js` and stores `Decimal(14,2)` in PostgreSQL — this is correct for individual amounts. The problem emerges when a single source amount must be split across multiple cost centers (rateio). For example, a payroll of R$ 10,000.00 split 33.33% / 33.33% / 33.34% across three farms gives R$ 3,333.33 + R$ 3,333.33 + R$ 3,333.34 = R$ 10,000.00. However, if the percentages are stored as floats (not Decimal) and applied naively, the common result is R$ 3,333.33 + R$ 3,333.33 + R$ 3,333.33 = R$ 9,999.99 — one cent off. Multiplied across all entries in a fiscal year, the trial balance shows a mysterious imbalance of a few reais that requires hours to trace.

In SPED ECD, the I150/I155 registros require that debit totals equal credit totals exactly to the centavo. A trial balance that is off by R$ 0.01 causes the PVA validator to reject the entire file.

**Why it happens:**
Rateio percentages come from the UI as user-entered floats, are stored as `DECIMAL(5,4)`, and when applied to a Decimal amount the last line is calculated as `total - sum(otherLines)` in some implementations but as `total * rate` in others. The "apply rate to each line" approach accumulates rounding error; the "last line takes the remainder" approach is correct but rarely implemented from the start.

**How to avoid:**
- Implement a `rateio(total: Decimal, portions: {rate: Decimal, costCenterId: string}[]): {costCenterId: string, amount: Decimal}[]` utility in `packages/shared/src/utils/rateio.ts`. The algorithm: calculate each line as `total.mul(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)`. Then compute `remainder = total - sum(calculatedLines)`. Add the remainder to the line with the largest share (not the last line — the largest share absorbs rounding most naturally). The existing `installment-generator.ts` uses a similar pattern for CP installments — adapt it.
- Store rateio percentages as `DECIMAL(7,6)` (6 decimal places) in the DB, never as JavaScript `number`.
- Write a unit test: `rateio(10000.00, [{rate: 0.3333, ...}, {rate: 0.3333, ...}, {rate: 0.3334, ...}])` must sum to exactly `10000.00`.
- In the SPED ECD generator, before writing I150/I155, add an assertion: `abs(sumDebits - sumCredits) < 0.005`. If it fires, log the offending period and throw — never generate a file with an unbalanced period.

**Warning signs:**
- Trial balance shows `SUM(DEBIT) - SUM(CREDIT)` = R$ 0.01 or R$ 0.02 for any period.
- SPED ECD validator returns error code on I155 "totais não conferem".
- Rateio utility uses `parseFloat()` or `Number()` anywhere in the calculation chain.

**Phase to address:** Rateio and cost-center split logic should be in the chart-of-accounts foundation phase. SPED ECD generator must re-validate before writing.

---

### Pitfall 3: Period Closing Without Immutability Enforcement — Retroactive Edits Corrupt Statements

**What goes wrong:**
A period (e.g., December 2025) is closed and the DRE/BP/DFC for that period are generated and presented to the accountant. A user then edits a CP (contas a pagar) payment date or a depreciation amount for November 2025, which triggers auto-generation of a corrected accounting entry. The new entry lands in the closed period because the auto-generation code uses `referenceMonth = source.referenceDate` without checking period status. The November BP changes silently. The accountant does not notice because the financial statements are cached views, not snapshots.

**Why it happens:**
The existing `AccountingEntry` model has no `periodId` foreign key — it uses `referenceMonth: DateTime @db.Date`. No `AccountingPeriod` table exists yet. Until the period-status check is wired into every entry-creation path, retroactive entries slip through.

**How to avoid:**
- Create an `AccountingPeriod` model: `{ id, organizationId, year, month, status: OPEN|CLOSED|LOCKED, closedAt, closedBy }`. CLOSED = no new auto-entries; LOCKED = no manual entries either (post-SPED submission).
- Add a `periodId` FK on `JournalEntry`. Every service that creates a journal entry must call `assertPeriodOpen(organizationId, year, month)` before `prisma.create`. Make this a shared utility so it cannot be bypassed.
- Closing a period requires a checklist: all pending payables reconciled, all depreciation runs posted, all payroll runs closed. The checklist is modeled as checkboxes on the period record, not a free-form comment.
- Re-opening a period requires an explicit admin action with an audit log entry (`openedBy`, `reason`). The default is that re-opening creates a "prior period adjustment" entry rather than modifying existing entries.
- Financial statement snapshots (DRE/BP/DFC) store a `snapshotHash` of the underlying GL data. If the GL changes for that period, the snapshot is marked STALE and requires re-generation — the UI shows a warning.

**Warning signs:**
- `AccountingEntry` records with `referenceMonth` earlier than the latest closed month.
- No `AccountingPeriod` table in the schema at the time auto-generation is wired to CP/CR/depreciation.
- Financial statements show different numbers on consecutive days without any approved changes.

**Phase to address:** Períodos Contábeis e Fechamento (must be second phase after chart-of-accounts) — all other phases depend on period status.

---

### Pitfall 4: Existing `AccountingEntry` Flat-Row Model Cannot Support Full Double-Entry GL

**What goes wrong:**
The current `AccountingEntry` model stores `debitAccount`, `creditAccount`, and `amount` as three columns on one row — a two-leg, single-amount design adequate for simple payroll entries. Full double-entry requires entries with 3+ lines (e.g., cost-center split: debit Expense Farm A / debit Expense Farm B / credit Salaries Payable). The existing model cannot represent this. If the new GL module extends the existing table by adding a nullable `lineIndex` or similar, the schema becomes ambiguous: some records are flat two-leg entries, others are multi-line. Queries for trial balance must handle both shapes.

**Why it happens:**
The existing module was explicitly scoped to payroll integration only (comment in `accounting-entries.service.ts`: "5 entry types created at payroll close"). The schema was intentionally minimal. The mistake is extending it instead of replacing it.

**How to avoid:**
- Create new tables: `journal_entries` (header) and `journal_entry_lines` (lines). Migrate existing `accounting_entries` records to the new structure as part of the chart-of-accounts phase migration.
- Keep `accounting_entries` table and its existing code intact as a read-only historical table until the full migration is verified. Add a `migratedToJournalEntryId` column to `accounting_entries` so the migration is auditable and reversible.
- The new `JournalEntryLine` table: `{ id, journalEntryId, accountId (FK → ChartOfAccount), side: DEBIT|CREDIT, amount: Decimal(14,2), costCenterId?, farmId?, description? }`.
- Update the `createPayrollEntries` and `createReversalEntry` functions to write to the new tables, not the old ones. Do this in the "Lançamentos Automáticos" phase, after the new schema is stable.

**Warning signs:**
- A migration adds columns to `accounting_entries` instead of creating new tables.
- Trial balance query JOINs both `accounting_entries` and `journal_entries`.
- `AccountingEntryType` enum is extended with non-payroll types (stock, depreciation, etc.) before the schema refactor.

**Phase to address:** Plano de Contas (foundation phase) — new schema must be in place before any other module writes accounting data.

---

### Pitfall 5: Auto-Generated Journal Entries Duplicate or Are Skipped Due to Non-Idempotent Triggers

**What goes wrong:**
Every existing module (payroll close, depreciation run, stock output, payables settlement) will gain a hook that generates journal entries. If those hooks are not idempotent, retries and re-runs create duplicate entries. The existing `createPayrollEntries` is already called "outside and after the closeRun transaction (non-blocking)" — if it crashes and is retried, it creates a second set of 5 payroll entries. The current code has no duplicate guard.

Conversely, if the hook fires but the period is closed or the GL module is not yet configured (no chart of accounts seeded), the entry is silently skipped with no alert. The accountant discovers missing entries at month-end close.

**Why it happens:**
Non-blocking fire-and-forget patterns (`try { createPayrollEntries(...) } catch {}`) are used to prevent accounting failures from rolling back business transactions. This is correct for user experience but wrong for data completeness. The two concerns — "don't block the business event" and "guarantee the accounting entry" — are conflated.

**How to avoid:**
- Use a `pending_journal_postings` queue table: when a business event fires (payroll close, depreciation, stock output, CP payment), insert a `PendingJournalPosting` record with `sourceType`, `sourceId`, `status: PENDING`. A background job (BullMQ, already in the stack) processes the queue and creates the actual journal entry.
- The `PendingJournalPosting` has a `UNIQUE(sourceType, sourceId)` constraint — duplicate triggers hit the unique constraint and are ignored.
- Failed postings set `status: FAILED` with `failureReason` — visible in the accounting dashboard. Accountant can manually retry or create a manual entry.
- For the existing `createPayrollEntries`: before `createMany`, check `count(AccountingEntry WHERE sourceType = PAYROLL_RUN AND sourceId = runId)`. If > 0, skip. Add this guard immediately (it is a bug in the current code).

**Warning signs:**
- `AccountingEntry.count WHERE sourceType = PAYROLL_RUN AND sourceId = X` returns > 5 (more than the expected 5 entry types).
- No `pending_journal_postings` table or equivalent deduplication mechanism exists when wiring depreciation/stock hooks.
- Accounting dashboard has no "missing postings" alert section.

**Phase to address:** Regras de Lançamento Automático (the auto-generation wiring phase) — the queue table and idempotency guard must be designed before any new auto-generation hooks are wired.

---

### Pitfall 6: SPED ECD File Fails PVA Validation Due to Chart of Accounts Structural Mismatches

**What goes wrong:**
The RFB's PVA (Programa Validador e Assinador) for ECD enforces strict structural rules that go beyond data formatting. Common rejection causes:

1. **I050 — Duplicate `COD_CTA`**: if the chart of accounts allows the same account code at two different nodes (e.g., code `1.1.01` exists both in the user-created tree and in a seeded "model" tree after a chart merge), the I050 registro rejects with "conta duplicada".
2. **I050 — Missing `COD_CTA_SUP`**: every non-root account must reference its parent code. A chart-of-accounts UI that allows orphan accounts (no parent) produces invalid I050 records.
3. **I155 — Cost-center inconsistency**: if an account has entries with cost center in I155 records but the I050 registro for that account does not set `IND_CTA = A` (analytic) and `COD_CTA_NATU` properly, validation fails.
4. **J100/J150 — Aggregation hierarchy imbalance**: DRE/BP blocks in the ECD require that every totaling line equals the sum of its children exactly. If the financial statement module computes subtotals independently from the chart of accounts hierarchy, rounding differences cause J100/J150 rejection.
5. **0000 — Incorrect `IND_SIT_ESP`**: special situation codes (merger, split, closing) require specific J block structures. Setting `IND_SIT_ESP = 0` (normal) when the company had a name change causes schema validation failure.

**Why it happens:**
The ECD format specification (Manual de Orientação da ECD, latest version for AC 2025) is a 300+ page PDF. Most implementations copy existing ECD files from accounting software as templates without reading the full spec. The PVA validator messages are cryptic (error codes without plain-text descriptions in the default view) and require cross-referencing the manual.

**How to avoid:**
- Download and read the current Manual de Orientação da ECD (available at `sped.rfb.gov.br`). At minimum read Blocos 0, I, and J completely — these are the ones that fail most often.
- Implement a pre-generation validator that checks all I050 constraints (no duplicate COD_CTA, all COD_CTA_SUP resolve to existing parents, no orphans) before writing the file.
- The J100/J150 subtotals must be computed from the same GL query that produces the trial balance — never computed independently in the financial-statement layer.
- Add a `UNIQUE(organizationId, code)` DB constraint on `ChartOfAccount` to prevent duplicate codes at the DB level, not just UI validation.
- Before generating ECD for a period, run the full PVA locally in a CI/test step. The PVA is a free download and can be invoked headlessly (though not officially documented — community workarounds exist via WINE on Linux).

**Warning signs:**
- Chart-of-accounts UI allows creating an account without selecting a parent.
- Financial statement subtotals are computed with `SUM(childLines)` queries that differ from the trial balance query path.
- No local PVA validation step in the SPED ECD generation service.
- ECD file hardcodes `IND_SIT_ESP = 0` for all organizations.

**Phase to address:** SPED ECD (last phase of the milestone) — but the COD_CTA uniqueness constraint and the J100/J150 derivation-from-GL rule must be decided in the chart-of-accounts foundation phase.

---

### Pitfall 7: Historical Data Gap — Existing Operations Have No GL Entries

**What goes wrong:**
The system has 4 milestones of operational data (v1.0–v1.3): payables, receivables, stock movements, depreciation runs, payroll runs, and asset acquisitions — none with corresponding GL entries (except 6 INTEGR-02 payroll entry types). When accounting goes live, the opening balance of every account must be correct. If the migration approach is "go live from today with a clean slate," the BP for the first period will show zero assets, zero liabilities, and zero equity — which is obviously wrong. If the migration approach is "retroactively generate GL entries from all historical data," the volume is potentially tens of thousands of entries per year and the logic to re-derive them is complex.

**Why it happens:**
This is a classic ERP accounting bolt-on problem. The business ran without a ledger and built up operational history. Adding the ledger creates a continuity problem. Teams often defer the decision until go-live and then find neither approach is fast.

**How to avoid:**
- Adopt the "opening balance entry" approach: create one manual `JournalEntry` per account with a single line establishing the opening balance as of the date accounting goes live (e.g., 2026-04-01). The values come from the existing financial module data (bank balances, outstanding CP/CR, asset book values, payroll provisions).
- Provide a "Saldo de Abertura" wizard in the UI that pre-populates opening balances from existing module data: bank account balances from `BankAccount.currentBalance`, outstanding CP from `Payable.remainingAmount`, asset book values from `Asset.currentBookValue`, payroll provisions from `PayrollProvision.totalAmount`. The accountant reviews and confirms before posting.
- Do NOT retroactively generate GL entries for historical periods unless required for SPED ECD (which only applies from the fiscal year of go-live forward). The SPED ECD for 2026 starts from the opening balance — prior years are not required.
- Document in the "Saldo de Abertura" wizard that the opening balance entry is a manual adjustment — tag it with `sourceType = OPENING_BALANCE` so it is excluded from the automatic-entry deduplication checks.

**Warning signs:**
- Migration plan says "generate GL entries for all historical transactions retroactively" without a time estimate.
- No `OPENING_BALANCE` source type on the `JournalEntry` model.
- Opening balance wizard is missing and accountant must create opening entries manually — high risk of errors.

**Phase to address:** Lançamentos Manuais e Saldo de Abertura (an early phase, before DRE/BP generation) — the opening balance feature is a pre-requisite for any meaningful financial statement output.

---

### Pitfall 8: Safra Fiscal Year vs. Calendar Year Mismatch Breaks SPED ECD Period Structure

**What goes wrong:**
Fazendas planning their exercise fiscal around the safra cycle (July–June, aligning with Plano Safra) rather than the calendar year (January–December) require SPED ECD to reflect a non-standard period. The 0000 registro has `DT_INI` and `DT_FIN` fields. If the system hardcodes `DT_INI = YYYY-01-01` and `DT_FIN = YYYY-12-31`, it will generate an invalid ECD for any client using a safra-aligned fiscal year. Additionally, for legal entity producers (PJ), the ECD deadline is the last business day of May following the year-end — for a July–June year, that means the ECD for year ending June 2026 is due May 2027. If the system uses calendar year for all deadline calculations, it will show wrong due dates.

**Why it happens:**
The `AccountingPeriod` model is often designed with `year` and `month` integer columns, implicitly assuming January–December. A safra fiscal year spans two calendar years (e.g., Jul-2025 to Jun-2026) and cannot be represented as a single integer year.

**How to avoid:**
- The `AccountingPeriod` model must have `startDate: Date` and `endDate: Date`, not just `year: Int`. The `FiscalYear` model (one level above) has `startDate`, `endDate`, and `type: CALENDAR | SAFRA | CUSTOM`.
- The SPED ECD generator reads `FiscalYear.startDate` and `FiscalYear.endDate` for the 0000 registro — never derives them from the period list.
- ECD deadline calculation: `lastBusinessDayOfMay(fiscalYear.endDate.year + 1)`. Use `date-fns` (already in stack) for business day calculation.
- For calendar-year clients (the majority), `FiscalYear.type = CALENDAR` and `startDate = YYYY-01-01`. The safra option is configurable at org setup, not hardcoded.

**Warning signs:**
- `AccountingPeriod` schema has `year: Int` and `month: Int` but no `date` fields.
- SPED ECD generator has `new Date(year, 0, 1)` hardcoded for `DT_INI`.
- ECD deadline is calculated as `new Date(year + 1, 4, 31)` without business-day adjustment.

**Phase to address:** Períodos Contábeis (second phase) — fiscal year configuration must be done before any period is created.

---

### Pitfall 9: CPC 29 Biological Assets — Fair Value Change Creates Phantom Income in DRE

**What goes wrong:**
The system already models biological assets (ativos biológicos) in v1.2 — cattle herds, perennial crops (coffee, orange), standing timber. Under CPC 29 / IAS 41, biological assets are measured at fair value less costs to sell at each reporting date. The change in fair value (gain or loss) goes directly to profit or loss (DRE), not to equity. A 20% appreciation of a cattle herd with book value R$ 500,000 generates R$ 100,000 of revenue on the DRE — without any cash inflow. This "phantom income" is non-cash and must be presented separately in the DRE and in the DFC indirect method (where it is reversed out under operating activities).

If the auto-generation rule for biological asset revaluation creates a `REVENUE` entry in the standard revenue group of the DRE, the DFC indirect method reconciliation will fail: `Net Income - (increase in biological assets) = Operating Cash Flow` — but if the DRE does not segregate the fair value gain, the DFC cannot subtract it back automatically.

**Why it happens:**
Developers implementing the fair value revaluation entry copy the pattern from depreciation (Debit: Asset / Credit: Depreciation Expense) and invert it to (Debit: Biological Asset / Credit: Revenue). The credit account is mapped to a standard revenue code. The DFC module then cannot identify this as a non-cash item to reverse.

**How to avoid:**
- Create dedicated account codes in the rural chart-of-accounts model for biological asset fair value: `3.5.01 — Variação Valor Justo Ativo Biológico` (revenue) and `4.5.01 — Perda Valor Justo Ativo Biológico` (expense). These must be flagged with `isFairValueAdjustment: Boolean` in the `ChartOfAccount` model.
- The DFC indirect method generator identifies all accounts with `isFairValueAdjustment = true` and lists them as "non-cash adjustments" in the operating activities section, reversing their DRE impact.
- The DRE layout must have a distinct section for "Resultado de Variação de Valor Justo" separate from "Receita Bruta de Vendas". This allows the user to see operating revenue separately from valuation adjustments.
- CPC 29 also requires disclosure of changes in quantity (births, deaths, acquisitions, sales) separately from fair value changes. Model the `BiologicalAssetMovement` table with `movementType: BIRTH | DEATH | ACQUISITION | SALE | FAIR_VALUE_ADJUSTMENT` — the GL entry differs by type.

**Warning signs:**
- The rural chart-of-accounts preload has no `isFairValueAdjustment` flag.
- DFC indirect method uses `Net Income` as starting point but does not subtract biological asset fair value gains.
- DRE shows a single "Receitas" subtotal that mixes cash sales with fair value gains.

**Phase to address:** Plano de Contas (flag `isFairValueAdjustment` in model) + DFC (reversal logic). The DRE layout must have the CPC 29 section before biological asset revaluation entries are connected.

---

### Pitfall 10: FUNRURAL Accounting Entry Posted as Expense Without Tax Liability Credit

**What goes wrong:**
FUNRURAL is a social contribution withheld by the buyer from the producer's invoice and remitted directly to the RFB. For the producer (seller), FUNRURAL is a deduction from gross revenue — not a payroll expense. The incorrect implementation debits `Despesa FUNRURAL` and credits `FUNRURAL a Recolher`, mirroring the INSS patronal structure. The correct entry for the producer is: Debit `FUNRURAL s/ Receita Bruta` (contra-revenue account, group 3) / Credit `FUNRURAL a Recolher` (current liability). The DRE impact differs: the expense account inflates operating costs; the contra-revenue account correctly reduces net operating revenue. Both produce the same net income but the DRE layout (required for SPED ECF) will be rejected if FUNRURAL is in the expense group instead of the revenue deduction group.

The v1.3 payroll module already handles FUNRURAL for the employer contribution (1.5% on gross revenue or 20% on payroll). The accounting entry for the employer FUNRURAL is a payroll expense — this is correct. The confusion arises because the same word covers two different things: the producer's FUNRURAL (withheld from sales) and the employer's FUNRURAL (added to payroll cost).

**Why it happens:**
The payroll module code path uses `ACCOUNT_CODES.PAYROLL_CHARGES` for employer social charges including FUNRURAL. When the accounting team maps "FUNRURAL" to an account, they find the existing payroll FUNRURAL code and reuse it for the revenue-deduction FUNRURAL. The accounts are different legal instruments.

**How to avoid:**
- The rural chart-of-accounts model must have two separate FUNRURAL accounts:
  - `3.1.03 — Deduções da Receita — FUNRURAL s/ Vendas` (account type: CONTRA_REVENUE, nature: DEBIT)
  - `2.1.04 — FUNRURAL a Recolher` (liability, nature: CREDIT)
- The CR (contas a receber) module, when a receivable with `funruralRate > 0` is settled, generates a GL entry to `3.1.03` (debit) / `2.1.04` (credit) for the FUNRURAL amount, not to the payroll expense group.
- Label the chart-of-accounts entries clearly: `FUNRURAL (Receita Bruta — art. 25 Lei 8.212)` vs. `FUNRURAL Patronal (Folha — art. 22a)`.

**Warning signs:**
- A single `FUNRURAL` account code is used by both the payroll module and the receivables settlement module.
- DRE shows FUNRURAL in `Despesas Operacionais` (expense group) instead of `Deduções da Receita Bruta`.
- `AccountingSourceType` enum has `PAYABLE_SETTLEMENT` but no `RECEIVABLE_SETTLEMENT` type — the missing type is a sign the CR→GL integration has not been designed yet.

**Phase to address:** Plano de Contas (model must distinguish the two FUNRURAL accounts) + Lançamentos Automáticos — CR settlement hook.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Extend existing `accounting_entries` flat-column table instead of creating `journal_entries` + `journal_entry_lines` | Saves one phase of schema work | Trial balance queries require UNION hacks; cost-center splits impossible; SPED I155 lines cannot be generated correctly | Never — schema must be two-table from the start |
| Cache DRE/BP/DFC as materialized views without invalidation on GL change | Reporting queries are fast | Stale statements show to users; accountant closes period based on wrong data | Only acceptable if view has a `last_updated` timestamp shown in the UI and auto-refresh on GL write |
| Store chart-of-accounts as flat list with `parentCode: String?` instead of `parentId: UUID?` | Avoids FK lookup for codes | Code changes break the tree; code uniqueness cannot be enforced at DB level with a simple string | Never — use `parentId UUID FK` and enforce `UNIQUE(orgId, code)` |
| Hardcode the rural chart-of-accounts as a TypeScript constant | Faster to seed | Cannot be customized per client; account codes are spread across codebase; adding a new account requires a code deploy | Acceptable for the seed/template, but the working tree must live in the DB |
| Skip `PendingJournalPosting` queue table — call auto-generation synchronously inside business transaction | Simpler code | A GL failure rolls back the business event (CP payment rollback because accounting failed); or GL failure is silently swallowed | Never in production — the queue pattern is required for correctness |
| Derive DFC from DRE + BP delta instead of from GL entries | Avoids building a DFC mapping system | Indirect method reconciliation is approximate; direct method is impossible; non-cash items (CPC 29 fair value, depreciation) are not identified | Acceptable only for v1 DFC indirect method if labeled "approximation" — direct method requires proper DFC mapping |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Payroll → GL | Use aggregate run total in one entry; no cost-center split | One `JournalEntry` per payroll run with N×2 `JournalEntryLine` rows (one debit per cost center, one aggregate credit to liability) |
| Depreciation → GL | Generate one entry per asset per month without checking if an entry for that `assetId + period` already exists | `UNIQUE(sourceType, sourceId, periodId)` on `journal_entries` prevents duplicates; depreciation service uses upsert |
| Stock Output → GL | Use stock output `totalCost` directly as GL amount; ignores weighted-average unit cost recalculation | Stock output GL entry must use `StockBalance.averageCost * quantity` at the time of output, not the original purchase price |
| CP Settlement → GL | Create GL entry using `Payable.totalAmount` instead of `payment.amount` | Partial payments must generate partial GL entries; `sourceId` should be `paymentId`, not `payableId` |
| CR Settlement → GL | Omit FUNRURAL deduction from the GL entry | CR settlement generates two GL entries: one for cash receipt (Debit Bank / Credit CR), one for FUNRURAL withheld (Debit FUNRURAL Contra-Revenue / Credit FUNRURAL Payable) |
| Asset Sale → GL | Debit Cash / Credit Asset at book value, ignoring accumulated depreciation | Correct: Debit Cash (sale price) + Debit Accumulated Depreciation + Credit Asset (cost) + Credit/Debit Gain or Loss on Disposal |
| SPED ECD → PVA | Generate file from computed financial statement values (which may differ from GL by rounding) | I150/I155 (balancete) must be derived from raw GL trial balance queries, not from financial statement layer |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Recursive CTE for full chart-of-accounts subtotals on every DRE request | DRE page takes 5–10 seconds to load in December (year-end) | Materialize account hierarchy as `lpath` (ltree extension) in PostgreSQL; cache hierarchy in Redis with 5-minute TTL; use `@>` operator for subtree queries | At ~500 accounts with 4+ levels and 50K+ journal entry lines per year |
| N+1 on `journal_entry_lines` when building trial balance | Trial balance endpoint times out; DB shows thousands of queries per request | Single query: `SELECT account_code, SUM(CASE side WHEN DEBIT THEN amount ELSE 0) - SUM(CASE side WHEN CREDIT THEN amount ELSE 0) FROM journal_entry_lines GROUP BY account_code` | At >10K lines per period, N+1 makes it unusable |
| Full `accounting_entries` + `journal_entry_lines` table scan for balancete | Progressively slower each month as data accumulates | Composite index `(organizationId, periodId, accountId)` on `journal_entry_lines`; partial index for open periods (frequently queried); archive closed periods | At >500K lines (approx. 3 years of a mid-size fazenda) |
| SPED ECD generation loads all journal entries into Node memory | OOM crash when generating ECD for a full year | Stream journal entries in batches of 5,000, write to file incrementally using Node.js `fs.createWriteStream`; existing CNAB adapter uses this pattern | At >100K entries per fiscal year |
| DFC indirect method recalculates all period balances on each request | DFC takes >10 seconds | Pre-compute period balance snapshots at period close; store as `PeriodSnapshot { accountId, openingBalance, closingBalance, debitMovement, creditMovement }` | At >12 periods × 500 accounts = 6,000 rows to recalculate per request |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Journal entry creation endpoint accessible to any `financial:*` permission | Unauthorized manual entries; fabricated expenses | Separate permission `accounting:journal:create` for manual entries; auto-generated entries bypass permission check but are system-only (no user-facing endpoint) |
| SPED ECD file stored in local filesystem | File accessible to all server processes; no versioning; lost on redeploy | Store in S3-compatible storage (existing pattern from pdfkit outputs); signed URL for download; access logged |
| Period re-open available to `financial:manager` role | Manager can re-open closed period and insert backdated entries without audit trail | Period re-open requires `accounting:period:reopen` permission (separate from financial manager); creates immutable audit log entry; triggers alert to org owner |
| Chart-of-accounts API returns all accounts for `organizationId` without RLS | Cross-tenant account code leak | All accounting models must include `organizationId` in every query `where` clause; RLS policy on `chart_of_accounts` table as with all existing models |
| Opening balance wizard allows arbitrary amounts without source reference | Fraudulent equity inflation | Each opening balance line must reference a source (`bankAccountId`, `payableId`, etc.) or be flagged as `manualAdjustment: true` with mandatory `justification` text; auditable |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Show all chart-of-accounts in a flat select (400+ accounts) when creating a manual entry | Accountant cannot find the right account; wrong account selected | Hierarchical account picker with search; show account code + name + nature; most-recently-used accounts shown first |
| Period close button available before checklist is 100% complete | Accountant closes period with unreconciled items; discovers error after SPED submission | Disable close button until all checklist items are checked; show count of blocking items ("3 itens pendentes") |
| DRE shows YTD figures with no way to view single month | Cannot compare months; seasonal agricultural business makes YTD misleading in mid-year | DRE filter: single month / quarter / YTD / custom range; comparative column for prior year same period |
| SPED ECD generation triggered immediately with no progress feedback | Large files take 30–60 seconds; user thinks it crashed and clicks again (duplicate generation) | Background job for ECD generation; progress indicator in UI; prevent second generation while first is running |
| Manual journal entry form without a "verify balance" step | Accountant submits an imbalanced entry; discovers at next trial balance | Real-time debit/credit running totals in the form; submit button disabled until `|sumDebits - sumCredits| < 0.005` |

---

## "Looks Done But Isn't" Checklist

- [ ] **Double-entry constraint:** Journal entry can be saved — verify that an imbalanced entry (debits ≠ credits) is REJECTED at the DB level, not just the service level.
- [ ] **Period locking:** A CP payment date was edited for a closed period — verify the GL entry was NOT updated retroactively.
- [ ] **Rateio rounding:** Create a payroll run totaling R$ 10,000.00 split 3 ways — verify all three journal entry line amounts sum to exactly R$ 10,000.00.
- [ ] **Duplicate auto-entries:** Trigger `createPayrollEntries` twice for the same run — verify only one set of entries exists (idempotency).
- [ ] **FUNRURAL entry type:** A receivable with FUNRURAL withheld is settled — verify the FUNRURAL GL entry lands in the contra-revenue group (3.x.xx), NOT in the expense group (6.x.xx).
- [ ] **CPC 29 DFC reversal:** A biological asset fair value gain appears in DRE — verify the DFC indirect method shows it as a non-cash adjustment (subtracted from net income in operating activities).
- [ ] **SPED ECD balance:** Run PVA validator on the generated ECD file — verify zero errors on I150/I155 (balancete) and J100/J150 (demonstrations).
- [ ] **Opening balance wizard:** Create opening balances from wizard — verify `SUM(openingBalanceLines where side=DEBIT) = SUM(openingBalanceLines where side=CREDIT)`.
- [ ] **Fiscal year type:** Configure a safra fiscal year (Jul–Jun) — verify ECD `DT_INI = 2025-07-01` and `DT_FIN = 2026-06-30` in the generated 0000 registro.
- [ ] **Account code uniqueness:** Attempt to create two accounts with the same code — verify the DB constraint rejects it (not just application validation).

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Flat-column `accounting_entries` extended instead of replaced | HIGH | Create new `journal_entries` + `journal_entry_lines` tables; write migration script to convert old records; update all consumers; keep old table as archive with `deprecated_` prefix |
| Period closed with unreconciled entries — wrong statement sent to accountant | MEDIUM | Re-open period (requires `accounting:period:reopen` permission); create correcting journal entry with `adjustmentType = PRIOR_PERIOD_CORRECTION`; regenerate financial statements; note correction in notes explicativas |
| Duplicate auto-generated journal entries discovered | MEDIUM | Write a cleanup script: `DELETE FROM journal_entries WHERE id NOT IN (SELECT MIN(id) FROM journal_entries GROUP BY sourceType, sourceId, periodId)`; add `UNIQUE(sourceType, sourceId, periodId)` constraint; re-run idempotency check |
| SPED ECD rejected by PVA with I050 duplicate accounts | LOW | Identify duplicate `COD_CTA` in chart of accounts; merge the duplicate accounts (reassign all lines); regenerate ECD; re-submit |
| Trial balance out by R$ 0.01–R$ 0.10 (rounding) | MEDIUM | Audit rateio functions for float arithmetic; identify affected periods; create correcting entries; implement `rateio.ts` with remainder-to-largest-share logic; verify all future periods |
| Opening balance not entered — first month BP shows zero assets | MEDIUM | Wizard creates `JournalEntry sourceType = OPENING_BALANCE` for each account with the correct balance as of go-live date; this is normal first-month-of-accounting procedure |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Double-entry broken by aggregate entries | Plano de Contas (Phase 1) — `JournalEntry + JournalEntryLine` schema | Deploy and assert: imbalanced entry rejected by DB trigger |
| Rounding breaks trial balance | Plano de Contas (Phase 1) — `rateio.ts` utility | Unit test: `rateio(10000.00, [0.3333, 0.3333, 0.3334])` sums to exactly 10000.00 |
| Retroactive edits corrupt closed period | Períodos Contábeis (Phase 2) — `assertPeriodOpen` guard | Integration test: edit CP payment date for closed period → GL unchanged |
| Flat `accounting_entries` model extended | Plano de Contas (Phase 1) — schema created fresh | Code review: no column additions to `accounting_entries` table |
| Duplicate auto-entries from retries | Lançamentos Automáticos (Phase 3) — `PendingJournalPosting` queue | Load test: trigger payroll close 3×; assert exactly 5 journal entry types created |
| SPED ECD PVA validation failures | SPED ECD (Phase N) — pre-generation validator + PVA test | Run PVA on generated file; assert zero errors |
| Historical data gap | Saldo de Abertura (Phase early) — opening balance wizard | Trial balance after wizard shows non-zero balances matching existing module data |
| Safra fiscal year mismatch | Períodos Contábeis (Phase 2) — `FiscalYear` model with `startDate/endDate` | Create safra year Jul–Jun; assert ECD 0000 registro dates are correct |
| CPC 29 phantom income in DFC | DFC (Phase N-1) — `isFairValueAdjustment` flag + DFC reversal | Revalue biological asset; assert DFC operating activities shows reversal |
| FUNRURAL wrong account group | Plano de Contas (Phase 1) — two distinct FUNRURAL codes | Settle CR with FUNRURAL; assert GL entry is in group 3 (contra-revenue) |

---

## Sources

- [Modern Treasury: How to Scale a Ledger, Part V — Immutability and Double-Entry](https://www.moderntreasury.com/journal/how-to-scale-a-ledger-part-v)
- [Modern Treasury: Designing Ledgers API with Concurrency Control](https://www.moderntreasury.com/journal/designing-ledgers-with-optimistic-locking)
- [Starsoft: Guia ECD e ECF 2025](https://www.starsoft.com.br/blog/ecd-e-ecf-2025-baixe-o-guia-completo-e-evite-erros-na-entrega/)
- [Domínio Sistemas: Principais erros do SPED ECD](https://suporte.dominioatendimento.com/central/faces/solucao.html?codigo=6037)
- [RFB SPED: Publicação versão 10.3.4 ECD](http://sped.rfb.gov.br/pagina/show/7996)
- [PostgreSQL docs: Recursive CTEs](https://www.postgresql.org/docs/current/queries-with.html)
- [CYBERTEC: Speeding up recursive queries and hierarchical data](https://www.cybertec-postgresql.com/en/postgresql-speeding-up-recursive-queries-and-hierarchic-data/)
- [IFRS: IAS 41 Agriculture](https://www.ifrs.org/issued-standards/list-of-standards/ias-41-agriculture/)
- [MDPI: Biological Assets IAS 41 — Systematic Review](https://www.mdpi.com/1911-8074/18/7/380)
- [Agronota: Registros contábeis da atividade rural](https://agronota.com.br/contabil-e-fiscal/registros-contabeis-da-atividade-rural-o-que-o-contador-precisa-saber/)
- [Planning: Contabilidade para o agronegócio](https://planning.com.br/contabilidade-agronegocio-particularidades-fiscais/)
- [Contabeis.com.br: Balanço fiscal vs. ano agrícola](https://www.contabeis.com.br/forum/contabilidade/258403/balanco-fiscal-x-ano-agricola/)
- [Oracle ERP: High Volume Data Migration for General Ledger](https://blogs.oracle.com/erp-ace/high-volume-data-migration-consideration-for-general-ledger)
- Codebase analysis: `apps/backend/src/modules/accounting-entries/` (INTEGR-02 implementation)
- Codebase analysis: `apps/backend/prisma/schema.prisma` — `AccountingEntry` model, `AccountingSourceType` enum

---
*Pitfalls research for: rural farm management ERP — v1.4 Accounting and Financial Statements milestone*
*Researched: 2026-03-26*
