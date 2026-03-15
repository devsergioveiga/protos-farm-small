# Stack Research

**Domain:** Brazilian Agricultural Financial Management Module
**Researched:** 2026-03-15
**Confidence:** MEDIUM (training data + project inspection; live npm/web search unavailable in this session)

## Context: What Already Exists

The following libraries are already installed and must be reused — do not introduce redundant alternatives:

| Library          | Version    | Already Used For                                    |
| ---------------- | ---------- | --------------------------------------------------- |
| `exceljs`        | ^4.4.0     | XLSX export (estoque, colheita)                     |
| `pdfkit`         | ^0.17.2    | PDF generation (receituário agronômico)             |
| `multer`         | ^2.1.0     | File upload handling                                |
| `@xmldom/xmldom` | ^0.8.11    | XML parsing                                         |
| `decimal.js`     | transitive | Arbitrary precision (available, not yet direct dep) |
| `dayjs`          | transitive | Date handling (available, not yet direct dep)       |

## Recommended Stack

### Core Technologies (New Dependencies Required)

| Technology   | Version | Purpose                              | Why Recommended                                                                                                                                                                                                                                                                                                                               |
| ------------ | ------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ofx-js`     | ^1.0.7  | OFX bank statement parsing           | Pure JS, no native deps, handles OFX 1.x SGML and 2.x XML variants; most starred OFX parser on npm for Node. CNAB banks (Bradesco, Itaú, BB) all export OFX. MEDIUM confidence — training data, unverified current version.                                                                                                                   |
| `decimal.js` | ^10.4.3 | Arbitrary precision arithmetic       | Already a transitive dep. Financial calculations MUST avoid IEEE 754 floating point. `decimal.js` is the standard Node.js choice for monetary math — more widely used than `big.js`, better API than `bignumber.js`. Add as explicit direct dep. HIGH confidence.                                                                             |
| `date-fns`   | ^4.1.0  | Date arithmetic for aging/scheduling | Installable, tree-shakeable, no prototype mutation. Superior to `dayjs` for complex operations (installment schedules, business days, FGTS/INSS due dates). `date-fns-tz` companion handles BR timezone (America/Sao_Paulo). `dayjs` is already transitive but `date-fns` has better TypeScript support and richer locale. MEDIUM confidence. |

### Supporting Libraries

| Library      | Version        | Purpose                       | When to Use                                                                                                                                                                                                                                                                             |
| ------------ | -------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `papaparse`  | ^5.4.1         | CSV parsing (bank exports)    | Bank OFX import also ships as CSV (Nubank, C6, fintechs). `papaparse` handles encoding issues (latin1 from legacy banks), header detection, and streaming. Use in: US-FN05 (cartão CSV), US-FN06 (conciliação CSV). MEDIUM confidence.                                                  |
| `iconv-lite` | ^0.6.3         | Character encoding conversion | Brazilian bank CSV exports are frequently ISO-8859-1 / Windows-1252, not UTF-8. `iconv-lite` converts before CSV parse. Already a transitive dep (used by many packages). Use whenever reading bank-originated files. HIGH confidence — this is a known production issue with BR banks. |
| `node-cnab`  | ~2.x or custom | CNAB 240/400 remessa/retorno  | See CNAB section below.                                                                                                                                                                                                                                                                 |

### CNAB 240/400 — Special Handling

**Situation:** No single actively-maintained TypeScript-native CNAB library dominates the npm ecosystem as of 2025. The main candidates are:

| Package               | Status         | Notes                                                                                                                                                                                                                                 |
| --------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cnab240` (npm)       | LOW CONFIDENCE | Small package, unverified maintenance. CNAB layout varies per bank (BB, Bradesco, Itaú, Caixa each have layout variants).                                                                                                             |
| `node-cnab` (npm)     | LOW CONFIDENCE | Handles CNAB 240/400 but may not cover all bank-specific segments (A, B, C, J, O).                                                                                                                                                    |
| Custom implementation | Recommended    | Given the complexity of bank-specific CNAB variants, most Brazilian fintech teams implement a custom parser/generator using the official FEBRABAN layout specs. This is not as hard as it sounds — CNAB is a fixed-width text format. |

**Recommendation:** Implement CNAB as an internal service module (`modules/cnab/`) rather than depending on a third-party package. The format is fixed-width positional text — a well-typed record definition + string slice parser is 300-500 lines and gives full control over the bank-specific variants needed (Bradesco CNAB 240 for remessa, BB for crédito rural). This is the approach used by major Brazilian ERP vendors (TOTVS, Sankhya, etc.).

**Implementation approach:**

```typescript
// modules/cnab/layouts/bradesco-240.ts
// modules/cnab/layouts/bb-240.ts
// modules/cnab/layouts/itau-400.ts
// modules/cnab/parser.ts   — reads fixed-width text → typed records
// modules/cnab/generator.ts — typed records → fixed-width text
```

MEDIUM confidence — based on ecosystem survey and FEBRABAN specification structure.

### PDF/Excel Export (Already Covered)

| Library   | Version | Purpose                 | Notes                                                                                                                                                      |
| --------- | ------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pdfkit`  | ^0.17.2 | PDF financial reports   | Already installed. Use for: extrato PDF, relatório fluxo de caixa, boleto layout (future).                                                                 |
| `exceljs` | ^4.4.0  | Excel financial reports | Already installed. Use for: aging export, extrato Excel, DFC export. Supports cell styles, formulas, freezing rows — necessary for financial spreadsheets. |

No new libraries needed for export — extend existing patterns from `modules/pesticide-prescriptions/` (pdfkit) and `modules/stock-outputs/` (exceljs).

### Financial Calculations (No Library Needed)

**Amortization (SAC, Price/French, Bullet):** Implement as pure TypeScript functions in `packages/shared/src/utils/amortization.ts`. These are well-defined mathematical formulas, not complex enough to warrant a dependency.

```typescript
// SAC: fixed principal, declining interest
// Price (French): fixed installment (PMT formula)
// Bullet: interest only until maturity, full principal at end
// PRONAF/rural credit: carência period before amortization begins
```

**Interest calculation:** Use `decimal.js` for all monetary arithmetic. The Brazilian SELIC-based corrections use compound interest — standard formula, no library needed.

**Aging buckets:** Pure date arithmetic with `date-fns`. Standard financial aging: current, 1-30, 31-60, 61-90, 91-180, 180+ days overdue.

**Currency formatting:** Use the native `Intl.NumberFormat` API — it is built into Node.js and browsers:

```typescript
const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});
brl.format(1234.56); // "R$ 1.234,56"
```

No external library needed for formatting. Do NOT use `numeral.js` (unmaintained) or `accounting.js` (abandoned).

### Development Tools

| Tool                       | Purpose                               | Notes                                                                                                                                         |
| -------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing Jest setup        | Unit tests for financial calculations | Amortization, interest, aging math must be unit tested exhaustively — financial bugs are high-stakes. Follow existing `**/*.spec.ts` pattern. |
| Existing Prisma migrations | Financial schema                      | All new tables need migrations. Naming: `20260400100000_financial_bank_accounts.ts` (continue existing sequence).                             |

## Installation

```bash
# Direct financial dependencies to add to apps/backend/package.json
cd apps/backend
pnpm add ofx-js papaparse iconv-lite

# Promote transitive deps to direct (for explicit version control)
pnpm add decimal.js date-fns date-fns-tz

# Types (papaparse ships its own types; others need @types)
pnpm add -D @types/papaparse
```

CNAB: no package to install — implement internally as described above.

## Alternatives Considered

| Recommended         | Alternative      | Why Not                                                                                                                                                                           |
| ------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ofx-js`            | `node-ofx`       | `node-ofx` is older, less actively maintained. `ofx-js` handles both OFX 1.x SGML and 2.x XML. MEDIUM confidence — verify before pinning.                                         |
| `decimal.js`        | `big.js`         | `big.js` is simpler but lacks `toDecimalPlaces()` rounding modes needed for financial rounding (HALF_UP, HALF_EVEN/Banker's rounding).                                            |
| `decimal.js`        | `bignumber.js`   | `bignumber.js` is fine but API is less ergonomic. `decimal.js` is already a transitive dep — fewer install bytes.                                                                 |
| `date-fns`          | `dayjs`          | `dayjs` is already transitive but plugin-heavy for business-day operations. `date-fns` has `addBusinessDays`, `differenceInCalendarDays`, better TypeScript inference out of box. |
| `papaparse`         | custom CSV split | Bank CSV files have irregular quoting, BOM markers, encoding issues. `papaparse` is battle-tested for these edge cases.                                                           |
| Custom CNAB         | `node-cnab`      | `node-cnab` and similar packages have uncertain maintenance and don't cover all bank-specific segment variants. Custom implementation gives full control and is simpler to test.  |
| `Intl.NumberFormat` | `numeral.js`     | `numeral.js` is unmaintained (last release 2021). Native `Intl` is built-in, zero bytes, always current.                                                                          |

## What NOT to Use

| Avoid                                                    | Why                                                                     | Use Instead                                                          |
| -------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `numeral.js`                                             | Last release 2021, no TypeScript types, unmaintained                    | `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` |
| `accounting.js`                                          | Abandoned, no TypeScript, not on npm                                    | `Intl.NumberFormat`                                                  |
| `money.js`                                               | Abandoned, no TypeScript                                                | `decimal.js` with manual currency tracking                           |
| `dinero.js` v1                                           | v1 is deprecated; v2 (alpha since 2021) still unstable as of last check | `decimal.js` + `Intl.NumberFormat`                                   |
| Any CNAB npm package without verified active maintenance | Brazilian bank CNAB layouts change annually and packages may lag        | Custom implementation against official FEBRABAN specs                |
| `moment.js`                                              | 67kB bundle, mutable API, officially in maintenance mode                | `date-fns`                                                           |
| `xlsx` (SheetJS community)                               | License changed to AGPL in 2023, commercial use requires paid license   | `exceljs` (MIT, already installed)                                   |

## Stack Patterns by Variant

**For OFX files from traditional banks (Bradesco, Itaú, BB, Santander):**

- Use `ofx-js` — these banks produce OFX 1.x SGML or 2.x XML
- Validate character encoding with `iconv-lite` before parsing (may be latin1)

**For CSV from neobanks (Nubank, Inter, C6):**

- Use `papaparse` with `dynamicTyping: true` and `skipEmptyLines: true`
- Headers vary per bank — normalize to internal `BankTransaction` schema in parser

**For CNAB 240 remessa (boleto/pagamento):**

- Implement per-bank layout in `modules/cnab/layouts/`
- Start with Bradesco 240 (most common rural credit bank) + BB 240 (PRONAF)
- CNAB 400 for legacy Itaú/Bradesco cobrança

**For amortization (rural credit US-FN14):**

- SAC (Sistema de Amortização Constante): constant principal, declining interest — most PRONAF/PRONAMP
- Price/French: constant installment — some rural equipment financing (CDC rural)
- Bullet: interest-only + full principal — CPR (Cédula de Produto Rural), short-term crop loans

**For financial report PDF (US-FN03, US-FN13):**

- Extend existing `pdfkit` patterns from `modules/pesticide-prescriptions/`
- Add A4 portrait layout with BRL formatting header, page numbers, org logo placeholder

## Version Compatibility

| Package             | Compatible With                                 | Notes                                                                                                                                                                                       |
| ------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decimal.js ^10.x`  | Node.js ≥ 12, TypeScript ≥ 4                    | Ships own types. No peer deps.                                                                                                                                                              |
| `date-fns ^4.x`     | Node.js ≥ 18, TypeScript ≥ 5                    | v4 is a significant refactor from v3 — pure ESM. Verify CommonJS compat with backend CJS config before upgrading. Use v3.x (`^3.6.0`) if backend CommonJS causes issues. MEDIUM confidence. |
| `papaparse ^5.x`    | Node.js ≥ 12, TypeScript (via @types/papaparse) | Stable, wide compat.                                                                                                                                                                        |
| `ofx-js ^1.x`       | Node.js ≥ 14                                    | Verify current version on npm before pinning — package may have newer major. LOW confidence on exact version.                                                                               |
| `iconv-lite ^0.6.x` | All Node.js versions                            | Already transitive, safe to promote.                                                                                                                                                        |
| `exceljs ^4.x`      | Node.js ≥ 12                                    | Already installed, no change.                                                                                                                                                               |
| `pdfkit ^0.17.x`    | Node.js ≥ 12                                    | Already installed, no change.                                                                                                                                                               |

## Confidence Assessment

| Library                     | Confidence | Reason                                                                                                                                                                                                                                           |
| --------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `decimal.js`                | HIGH       | Already transitive dep, well-established for financial math, no alternative controversy                                                                                                                                                          |
| `Intl.NumberFormat` for BRL | HIGH       | Native API, no library needed, pt-BR locale verified in Node.js                                                                                                                                                                                  |
| `exceljs` + `pdfkit` reuse  | HIGH       | Already installed and working in project                                                                                                                                                                                                         |
| `iconv-lite`                | HIGH       | Known production issue with BR bank encodings, widely documented                                                                                                                                                                                 |
| Custom CNAB module          | MEDIUM     | Architecture recommendation based on ecosystem fragmentation — verify available packages before committing                                                                                                                                       |
| `papaparse` for CSV         | MEDIUM     | Strong reputation, but verify latest version supports Node.js 20+ streaming                                                                                                                                                                      |
| `date-fns` v4 vs v3         | MEDIUM     | v4 is pure ESM — check compatibility with backend CommonJS before choosing v4; fall back to v3                                                                                                                                                   |
| `ofx-js`                    | LOW        | Training data only, cannot verify current npm status or maintenance. Validate on npm before adopting. Alternative: parse OFX manually using `@xmldom/xmldom` (already installed) for XML variant + regex for SGML variant — zero new dependency. |
| SAC/Price/Bullet formulas   | HIGH       | Well-defined mathematical formulas, no library uncertainty                                                                                                                                                                                       |

## Sources

- Project inspection: `/apps/backend/package.json`, `/apps/frontend/package.json`, root `node_modules/` listing — HIGH confidence on existing deps
- Training data: npm ecosystem knowledge through August 2025 — MEDIUM confidence
- FEBRABAN CNAB 240/400 specs (public, available at febraban.org.br) — HIGH confidence on format structure, LOW on specific library support
- SheetJS AGPL relicense: confirmed in training data — HIGH confidence (widely documented community event 2023)
- Brazilian bank OFX encoding issues: known production pattern, HIGH confidence on `iconv-lite` need

---

_Stack research for: Brazilian Agricultural Financial Module (Fase 3 — EPIC-FN1 to FN4)_
_Researched: 2026-03-15_
_Note: WebSearch and WebFetch tools unavailable in this session. Verify LOW-confidence items (ofx-js version, date-fns v4 ESM compat) with `npm info <package>` before implementation._
