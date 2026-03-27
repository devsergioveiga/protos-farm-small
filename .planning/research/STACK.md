# Technology Stack

**Project:** Protos Farm — v1.4 Contabilidade e Demonstrações Financeiras
**Researched:** 2026-03-26
**Confidence:** HIGH for all PDF/text generation and PostgreSQL patterns; MEDIUM for SPED ECD (no mature Node.js library exists — custom generator required); HIGH for no-new-deps conclusions

---

## Context: What Already Exists (Do Not Re-Add)

The following are already installed and actively used. All v1.4 work must reuse these — do not add duplicates.

| Library | Version | Already Covers |
|---------|---------|----------------|
| `pdfkit` | ^0.17.2 | PDF generation — reuse for financial statement PDFs (DRE, BP, DFC) and closing reports |
| `decimal.js` | ^10.6.0 | Monetary arithmetic — all accounting amounts MUST use `Money(n)` wrapper (same as payroll) |
| `exceljs` | ^4.4.0 | Excel/CSV export — reuse for trial balance, ledger, and journal entry exports |
| `xmlbuilder2` | ^4.0.3 | XML generation — SPED ECD is pipe-delimited text, NOT XML; do not use for ECD |
| `recharts` | ^3.7.0 | Charts — reuse for accounting dashboard (DRE waterfall, BP composition, DFC flows) |
| `bullmq` | *(via ioredis)* | Background jobs — reuse for SPED ECD generation (file can be large, async required) |
| `node-cron` | ^4.2.1 | Scheduled jobs — reuse for period-close reminders and automatic entry generation |
| `date-fns` | ^4.1.0 | Date arithmetic — reuse for fiscal period calculations and period validation |
| `pino` | ^10.3.1 | Logging — reuse for accounting audit trail (entries created/reversed, period open/close) |

---

## New Dependencies Required for v1.4

### Zero new npm packages needed.

The entire v1.4 accounting milestone can be built using existing dependencies plus custom logic. The analysis below explains why each potentially tempting library was evaluated and rejected.

---

## Why No New Packages

### SPED ECD File Generation — Custom text generator, not a library

**Decision: Build a custom `SpedEcdWriter` class in `src/shared/sped/`**

**Rationale:**

The SPED ECD file format is pipe-delimited plain text (`|FIELD|FIELD|...|`), one record per line, organized into blocks (0, C, I, J, K, 9). It is structurally similar to CNAB — fixed structure, purely additive, sequential write. The project already has a `CnabAdapter` pattern (v1.0) for exactly this kind of format.

There is no production-ready Node.js/TypeScript library for SPED ECD generation. The `sped-br` GitHub organization maintains only Python libraries (`python-sped`, `python-sped-ecd`). The `sped-checker` npm package validates file structure but does not generate files. Building on an unmaintained or non-existent third-party library for a government-mandated file format would create compliance risk when the Receita Federal publishes layout updates (currently on Layout 12 for 2025 fiscal year, Layout 11 for 2024).

**Implementation model** (mirrors existing CnabAdapter pattern):

```typescript
// src/shared/sped/sped-ecd-writer.ts
export class SpedEcdWriter {
  private lines: string[] = [];

  record(reg: string, fields: (string | number | null)[]): this {
    this.lines.push(`|${reg}|${fields.join('|')}|`);
    return this;
  }

  toString(): string {
    return this.lines.join('\r\n') + '\r\n';
  }
}
```

Each block (Bloco 0, C, I, J, K, 9) becomes a method on a `SpedEcdService`. The Receita Federal validator program is used to verify output during development — it is freely downloadable and can be run offline.

**Confidence: MEDIUM** — SPED ECD layout 11/12 structure is well-documented in official RFB manuals; no external library dependency risk; maintenance controlled internally. Uncertainty is in edge cases of specific records (I155, I157 key changes in 2025 layout).

---

### Double-Entry Bookkeeping — Prisma + PostgreSQL, not a library

**Decision: Custom `JournalEntryService` with Prisma transactions, not medici/ale/ledger-ts**

**Rationale:**

Available double-entry libraries (`medici` requires MongoDB, `ale` requires Sequelize, `ledger-ts` targets beancount format output) are incompatible with the existing Prisma 7 + PostgreSQL 16 stack. More importantly, the project already has an `AccountingEntry` model (Phase 32 Plan 02) with `debitAccount`, `creditAccount`, `amount`, `sourceType`, `sourceId` — a minimal double-entry ledger already exists.

v1.4 extends this with:
- `ChartOfAccount` model (hierarchical, self-referential, `parentId`)
- `AccountingPeriod` model (fiscal year + month, open/closed status)
- `JournalEntry` model (header with date, memo, period FK)
- `JournalEntryLine` model (debit/credit legs, account FK, amount)

The `debit = credit` invariant is enforced in the service layer within a Prisma transaction, not by a library. This is the same pattern Square uses internally (documented in their "Books" engineering post).

**Confidence: HIGH** — PostgreSQL recursive CTEs handle hierarchical account trees natively (`WITH RECURSIVE`); Prisma `$transaction` enforces ACID for double-entry; existing `AccountingEntry` model validates the approach works.

---

### Chart of Accounts Hierarchy — PostgreSQL recursive CTE, not a library

**Decision: Self-referential Prisma model + raw SQL for tree traversal**

The chart of accounts is a tree (max 5 levels: Ativo > Ativo Circulante > Disponibilidades > Caixa > Caixa Sede). PostgreSQL handles this natively with `WITH RECURSIVE`. Prisma does not support recursive CTEs directly, so account tree traversal uses `prisma.$queryRaw` with a typed helper:

```typescript
// src/shared/accounting/coa-tree.ts
export async function getAccountSubtree(
  prisma: PrismaClient,
  organizationId: string,
  rootCode: string,
): Promise<ChartOfAccountNode[]> {
  return prisma.$queryRaw`
    WITH RECURSIVE subtree AS (
      SELECT id, code, name, "parentId", level, "accountType"
      FROM chart_of_accounts
      WHERE "organizationId" = ${organizationId} AND code = ${rootCode}
      UNION ALL
      SELECT c.id, c.code, c.name, c."parentId", c.level, c."accountType"
      FROM chart_of_accounts c
      JOIN subtree s ON c."parentId" = s.id
    )
    SELECT * FROM subtree ORDER BY code
  `;
}
```

**No library needed.** PostgreSQL 16 recursive CTE performance is excellent at the scale of a chart of accounts (typically 200-500 accounts).

---

### Financial Statement PDFs — pdfkit (already installed), not pdfmake

**Decision: Continue using `pdfkit ^0.17.2` for DRE, BP, DFC reports**

**Rationale:**

`pdfmake ^0.3.x` offers built-in table support and declarative syntax, which is appealing for financial statements. However:

1. `pdfkit` is already installed at `^0.17.2` (April 2025 release — actively maintained)
2. The project has established patterns for pdfkit across payslips, TRCT, pesticide prescriptions, and purchase orders — adding pdfmake creates a second PDF generation paradigm with no migration path
3. `pdfkit-table ^0.1.x` (companion library for tables in pdfkit) exists and handles the multipage table requirement for trial balances and ledgers
4. Financial statement tables (DRE, BP, DFC) are structured enough that manual table drawing in pdfkit is tractable — the same approach used for payslip earnings tables already in the codebase

**pdfkit page-break pattern** (required for multipage financial statements):

```typescript
const MIN_ROW_HEIGHT = 20;
if (doc.y > doc.page.height - doc.page.margins.bottom - MIN_ROW_HEIGHT) {
  doc.addPage();
  renderStatementHeader(doc, title, period);
}
```

**Confidence: HIGH** — pdfkit 0.17.2 verified on npm; pdfkit-table 0.1.45 is the current version (check compatibility with pdfkit 0.17 before use); established pattern in codebase.

---

### Money Arithmetic — decimal.js (already installed)

**Decision: Continue using `decimal.js ^10.6.0` via existing `Money()` factory**

All debit/credit amounts, account balances, and financial statement totals use `Money(n)` (the existing wrapper in `packages/shared`). No `dinero.js` or `currency.js` needed — `decimal.js` provides arbitrary precision and is already the project standard.

**Key accounting rules already enforced by Money():**
- 2 decimal places for BRL
- `ROUND_HALF_UP` rounding (Brazilian accounting standard)
- No IEEE 754 floating point errors

---

### Balance Calculation — PostgreSQL SUM aggregates, not materialized views

**Decision: Compute account balances with indexed SUM queries, NOT materialized views**

Materialized views seem appealing for running balances but have a critical problem: refreshing them on every journal entry insert makes inserts take seconds (verified: ~9s for 300K rows in community reports). For an accounting system where posting a journal entry must feel instant, this is unacceptable.

**Approach instead:**
- `AccountBalance` table: one row per `(organizationId, accountId, fiscalYear, month)` updated in the same transaction as journal entry posting
- Balance is maintained incrementally: `newBalance = currentBalance + debitAmount - creditAmount`
- Period-end balances (for BP/DRE) read from this cache table
- Live ledger view uses a windowed SUM: `SUM(amount) OVER (PARTITION BY accountId ORDER BY entryDate)`

This is identical to how `StockBalance` works in the existing codebase (US-090 pattern).

**Confidence: HIGH** — StockBalance pattern proven across 6 existing modules; PostgreSQL indexed SUM on partitioned data is O(log n).

---

## Installation

No new packages required. All capabilities exist in the current dependency set.

```bash
# No npm install needed for v1.4
# Verify pdfkit-table compatibility if tables become complex:
# pnpm add pdfkit-table --filter @protos-farm/backend
# (evaluate only if pdfkit manual tables prove insufficient for trial balance)
```

---

## Alternatives Considered

| Recommended | Alternative | Why Alternative Was Rejected |
|-------------|-------------|------------------------------|
| Custom `SpedEcdWriter` | `sped-checker` npm package | Validates only, does not generate; no generation library exists for Node.js |
| Custom `SpedEcdWriter` | Python `sped-br/python-sped-ecd` | Python-only; would require spawning subprocess or microservice — unjustified complexity |
| pdfkit (existing) | pdfmake ^0.3.7 | Second PDF paradigm with no migration path; pdfkit already covers all existing PDF use cases |
| Prisma + PostgreSQL | medici (double-entry library) | Requires MongoDB — incompatible with Prisma 7 + PostgreSQL 16 stack |
| Prisma + PostgreSQL | ale/ledger-ts | Sequelize/beancount — wrong ORM/output format for this stack |
| Incremental AccountBalance table | PostgreSQL materialized views | Refresh on insert causes multi-second write latency — unacceptable for interactive use |
| `$queryRaw` recursive CTE | Prisma nested relations | Prisma does not support recursive CTEs; nested relation traversal requires N+1 queries for arbitrary depth trees |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `medici` | MongoDB only; incompatible with PostgreSQL | Custom `JournalEntryService` with Prisma `$transaction` |
| `pdfmake` | Duplicate PDF library; vfs_fonts adds build complexity | `pdfkit` (already installed, same capability) |
| PostgreSQL materialized views for balances | Multi-second refresh latency on insert | `AccountBalance` incremental cache table (StockBalance pattern) |
| String concatenation for SPED ECD | Character escaping bugs on accented names/addresses | `SpedEcdWriter` class with field validation |
| `dinero.js` / `currency.js` | Duplicate money library | `decimal.js` via existing `Money()` factory |
| Floating-point `number` for amounts | IEEE 754 rounding errors compound across ledger aggregations | `Decimal` (decimal.js) everywhere, stored as `@db.Decimal(14,2)` |

---

## Stack Patterns by Variant

**If SPED ECD file exceeds 10MB (large organization with many accounts/entries):**
- Generate via BullMQ job (already installed), not in the HTTP request cycle
- Stream output to a temp file, return a download URL
- Same pattern as eSocial batch export in v1.3

**If financial statement PDFs need embedded charts (DRE waterfall, DFC flow):**
- Generate chart as SVG from Recharts on the frontend, POST SVG string to backend
- Embed SVG in pdfkit with `doc.image(Buffer.from(svgString), ...)` via `svg-to-pdfkit`
- Alternative: render chart server-side with `@nivo/core` (no browser required) — evaluate only if needed
- Do NOT use Puppeteer/Playwright for PDF generation — adds Chromium binary (~300MB) to backend Docker image for a feature pdfkit already handles

**If trial balance has >500 line items (large chart of accounts):**
- Use `pdfkit-table ^0.1.x` for automatic page-break handling in tables
- Verify pdfkit-table compatibility with pdfkit 0.17 before adding (last confirmed compatible version: 0.1.45)

---

## Version Compatibility

| Package | Version in Use | Notes |
|---------|---------------|-------|
| `pdfkit` | ^0.17.2 | Active — 0.17.2 released April 2025; 0.18.0 available (no breaking changes noted) |
| `decimal.js` | ^10.6.0 | Stable — no major version changes expected |
| `exceljs` | ^4.4.0 | Active — reuse existing CSV/XLSX export patterns |
| `xmlbuilder2` | ^4.0.3 | Stable — NOT used for ECD (pipe-delimited text); used for eSocial only |
| `prisma` | ^7.4.1 | Active — use `$queryRaw` for recursive CTEs; `$transaction` for double-entry invariant |
| PostgreSQL | 16 | `WITH RECURSIVE` fully supported; window functions for running balance supported |

---

## Integration Points with Existing Modules

| Existing Module | Integration Required | How |
|----------------|---------------------|-----|
| `accounting-entries` (v1.3) | Migrate to full `JournalEntry` model | Extend existing `AccountingEntry` model, add `JournalEntryLine` with FK to new `ChartOfAccount` |
| `payroll-runs` | Auto-post salary/charges journal entries | Existing `accounting-entries.service.ts` pattern — extend `sourceType` enum |
| `assets` + `depreciation` | Auto-post depreciation entries | New `sourceType: DEPRECIATION` in `AccountingSourceType` enum |
| `stock-entries` / `stock-outputs` | Auto-post inventory entries | New `sourceType: INVENTORY_IN / INVENTORY_OUT` |
| `payables` / `receivables` | Auto-post AP/AR entries | New `sourceType: PAYABLE_SETTLEMENT / RECEIVABLE_SETTLEMENT` |
| `bank-accounts` | Conciliação contábil (razão vs extrato) | Join `AccountingEntry` with `BankTransaction` on amount + date |

---

## Sources

- npm registry (verified March 2026): pdfkit 0.17.2, pdfmake 0.3.7, decimal.js 10.6.0, exceljs 4.4.0
- [SPED ECD Receita Federal](http://sped.rfb.gov.br/projeto/show/273) — official format documentation; layout 11 (2024 FY) and 12 (2025 FY)
- [Manual ECD Leiaute 9 PDF](http://sped.rfb.gov.br/estatico/2D/9C01A0E619B48BAB27486D63FF9E4E750025D0/Manual_de_Orienta%C3%A7%C3%A3o_da_ECD_Leiaute9_2023_12_21.pdf) — block and record structure reference
- [sped-br GitHub org](https://github.com/sped-br) — confirmed Python-only; no Node.js library exists (verified March 2026)
- [PostgreSQL WITH RECURSIVE docs](https://www.postgresql.org/docs/current/queries-with.html) — recursive CTE syntax for account tree traversal
- [Square Books engineering post](https://developer.squareup.com/blog/books-an-immutable-double-entry-accounting-database-service/) — double-entry schema pattern (accounts + journal_entries + book_entries)
- [Journalize.io DB schema post](https://blog.journalize.io/posts/an-elegant-db-schema-for-double-entry-accounting/) — journal entry / ledger line schema pattern
- WebSearch (LOW confidence): pdfkit-table 0.1.45 compatibility with pdfkit 0.17 — verify before use

---

*Stack research for: v1.4 Contabilidade e Demonstrações Financeiras — SPED ECD, Chart of Accounts, Double-Entry Bookkeeping, Financial Statements*
*Researched: 2026-03-26*
