# Technology Stack

**Project:** Protos Farm — v1.3 RH e Folha de Pagamento Rural
**Researched:** 2026-03-23
**Confidence:** HIGH for XML/PDF/crypto additions; MEDIUM for expo-task-manager background location (Expo managed workflow limitations); LOW for payroll calculation library (none exists — custom required)

---

## Context: What Already Exists (Do Not Re-Add)

The following are already installed and actively used in this monorepo. All new work must reuse these — do not add duplicates.

| Library              | Version   | Already Covers                                                                                  |
| -------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| `pdfkit`             | ^0.17.2   | PDF generation — reuse for holerites (payslips), TRCT, contracts, payroll reports               |
| `decimal.js`         | ^10.6.0   | Monetary arithmetic — all INSS/IRRF/FGTS/FUNRURAL calculations MUST use `Money(n)` wrapper      |
| `bullmq`             | ^5.71.0   | Background jobs — reuse for async payroll processing, eSocial batch transmission                |
| `node-cron`          | ^4.2.1    | Scheduled jobs — reuse for monthly payroll scheduler, 13th salary provisioning                  |
| `exceljs`            | ^4.4.0    | Excel/CSV export AND import — reuse for bulk employee import (same pattern as stock-entries)    |
| `handlebars`         | ^4.7.8    | Email templates — reuse for payslip email, contract notifications, EPI alerts                   |
| `nodemailer`         | ^8.0.1    | Email delivery — already wrapped in `src/shared/mail/mail.service.ts`                          |
| `ioredis`            | ^5.9.3    | Redis — BullMQ uses it; no new Redis setup                                                      |
| `multer`             | ^2.1.0    | File upload — reuse for employee document upload (CPF, CTPS, ASO), EPI photos                  |
| `date-fns`           | ^4.1.0    | Date arithmetic — reuse for DSR, notice period, vacation day calculations                       |
| `@xmldom/xmldom`     | ^0.8.11   | XML DOM — already in codebase; do NOT use for eSocial (see xmlbuilder2 below)                  |
| `recharts`           | ^3.7.0    | Charts — reuse for HR dashboard (cost per department, headcount, attendance heatmap)            |
| `pino`               | ^10.3.1   | Logging — reuse for payroll audit trail and eSocial transmission logs                           |
| `expo-location`      | ~19.0.8   | Geolocation — already installed in mobile; extend for timesheet punch-in/punch-out              |
| `react-router-dom`   | ^7.13.1   | Routing — already in use                                                                        |
| `lucide-react`       | ^0.575.0  | Icons — design system standard                                                                  |

---

## New Dependencies Required

### Backend: 4 new packages

---

#### 1. xmlbuilder2 — eSocial XML Event Generation

| Attribute              | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Package                | `xmlbuilder2`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Version                | `^4.0.3` (npm-verified, March 2026)                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Purpose                | Build eSocial XML events (S-2200 employee admission, S-2206 contract change, S-2230 leave, S-2299 termination, S-1200 payroll earnings, S-1210 payments, S-2400 rural pension) from TypeScript objects. Handles XML namespaces, CDATA sections, and character encoding correctly.                                                                                                                                                                                                                        |
| Why not `@xmldom/xmldom` | `@xmldom/xmldom` is a DOM parser/builder with an imperative node-by-node API — extremely verbose for the 60–200 element depth of eSocial events. `xmlbuilder2` provides a fluent chainable API that mirrors the XML tree structure. It is also the successor to `xmlbuilder` (maintained by the same author), ships TypeScript types built-in (no `@types/` package needed), and requires Node.js >=20 (project already on Node 24). Version 4.x is the current stable line (Jan 2026). |
| Why not string templates | String concatenation for XML breaks on special characters in employee names (José, Ângela, São Paulo) without rigorous escaping. `xmlbuilder2` handles all escaping and encoding automatically.                                                                                                                                                                                                                                                                                                         |
| TypeScript             | Built-in types (no `@types/xmlbuilder2` needed). Node.js >=20 required. Zero external dependencies.                                                                                                                                                                                                                                                                                                                                                                                                   |
| Confidence             | HIGH — npm-verified at 4.0.3; official docs confirm TypeScript support and namespace handling; widely used for government XML generation in Node.js ecosystem                                                                                                                                                                                                                                                                                                                                           |

**Use for:** `modules/esocial/esocial-xml.builder.ts` — one builder per event type (S-2200, S-1200, etc.)

**Do NOT replace `@xmldom/xmldom`** — keep for existing uses in other modules.

---

#### 2. xml-crypto — eSocial XML Digital Signature (ICP-Brasil)

| Attribute              | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package                | `xml-crypto`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Version                | `^6.1.2` (npm-verified, March 2026)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Purpose                | Sign eSocial XML events using ICP-Brasil A1 digital certificate (PFX/P12). eSocial requires XMLDSig enveloped signature with RSA-SHA256, C14N canonicalization, and X509 certificate embedding — this is exactly what `xml-crypto` implements.                                                                                                                                                                                                                                                                             |
| Why                    | eSocial transmission rejects unsigned XML. Brazilian government requires ICP-Brasil A3 or A1 certificates. `xml-crypto` is the de-facto Node.js library for XML digital signatures: 1.98 million weekly downloads, actively maintained by the node-saml team, supports RSA-SHA256 (`http://www.w3.org/2001/04/xmldsig-more#rsa-sha256`), exclusive C14N, and X509 certificate embedding in `<KeyInfo><X509Data>` — all required by eSocial schema. Version 6.x added protection against signature wrapping attacks. |
| Certificate handling   | PFX/P12 files loaded with Node.js built-in `crypto` module (`crypto.createPrivateKey({ key: pfxBuffer, format: 'pkcs12', passphrase })`). The private key is passed to `xml-crypto`'s signer; the public cert is embedded in the signature. Store PFX in encrypted form; never commit to repository.                                                                                                                                                                                                                      |
| Confidence             | HIGH — npm-verified at 6.1.2; RSA-SHA256 and X509 support confirmed in official README; 1.98M weekly downloads confirms production use in Brazilian NFe/eSocial ecosystem                                                                                                                                                                                                                                                                                                                                                  |

**Use for:** `modules/esocial/esocial-signer.service.ts` — receives XML string, signs with org certificate, returns signed XML.

**Axios + mTLS for transmission:** eSocial REST API requires the same ICP-Brasil certificate for mutual TLS. Use `axios` (already available via Express ecosystem) with `httpsAgent: new https.Agent({ pfx: pfxBuffer, passphrase })`. No new HTTP client needed.

---

#### 3. pdfkit-table — Structured Tables in Payslips and Labor Documents

| Attribute              | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package                | `pdfkit-table`                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Version                | `^0.1.99` (npm-verified, March 2026)                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Purpose                | Add table drawing capability to the existing `pdfkit` instance. Payslips (holerites) require tabular layouts: earnings/deductions table with rubric codes, descriptions, and amounts. TRCT (termination) and 13th salary documents have similar multi-column structures.                                                                                                                                                                                                                      |
| Why not raw `pdfkit`   | `pdfkit` draws text at absolute (x, y) coordinates. A payslip table has 20–40 rows × 3–4 columns with dynamic content (varying rubric counts per employee). Drawing cells manually requires computing column widths, row heights, page breaks, and borders for every row — 200+ lines of layout code per document. `pdfkit-table` wraps this as a data-driven API: pass headers + rows array, get a formatted table. It is a `pdfkit` plugin (same doc instance), not a replacement. |
| Compatibility          | `pdfkit-table@0.1.99` works with `pdfkit@0.17.x` (confirmed — no breaking peer dep change). The plugin patches the `PDFDocument` prototype.                                                                                                                                                                                                                                                                                                                                                |
| Alternative considered | `voilab-pdf-table@0.5.1` — more flexible but requires specifying exact column widths in points and has less community adoption. `pdfkit-table` is simpler for the fixed-column payslip layout.                                                                                                                                                                                                                                                                                              |
| Confidence             | MEDIUM — npm-verified at 0.1.99; pdfkit compatibility verified via package.json peer dep; published activity shows community use; minor version (0.x) indicates API may evolve                                                                                                                                                                                                                                                                                                              |

**Use for:** `modules/payroll/payslip-pdf.service.ts`, `modules/terminations/trct-pdf.service.ts`

---

#### 4. date-holidays — Brazilian Holiday Calendar for Payroll Calculations

| Attribute              | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package                | `date-holidays`                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Version                | `^3.26.11` (npm-verified, March 2026, last published ~8 days ago — actively maintained)                                                                                                                                                                                                                                                                                                                                                                                   |
| Purpose                | Brazilian national and state-level public holidays for: DSR (Descanso Semanal Remunerado) calculation, vacation business-day counting, overtime classification (holiday vs. regular overtime), notice period calculation (prazo de aviso prévio), and SAT/SUN/holiday exclusions in timesheet processing.                                                                                                                                                                  |
| Why                    | `date-fns` (already installed) lacks holiday data. Brazilian payroll requires distinguishing feriados nacionais (12 fixed, including Proclamação da República, Natal, etc.) from feriados estaduais (vary by state — e.g., São Paulo's Revolução Constitucionalista on July 9th) and feriados municipais. `date-holidays` includes Brazil national + all 26 states + DF. Worker's state stored on employee record → determine applicable holiday calendar. |
| Why not hardcoded list | Holidays change — new ones added by legislation (e.g., Consciência Negra became national in 2024). `date-holidays@3.26.11` is updated actively (8 days ago) and covers 2026+ dates.                                                                                                                                                                                                                                                                                       |
| Usage                  | `new Holidays('BR', 'SP')` for São Paulo state. `getHolidays(year)` returns typed array of `{ date, name, type }`. Wrap in `HolidayService` injectable to cache per-year-state combos.                                                                                                                                                                                                                                                                                    |
| Confidence             | HIGH — npm-verified at 3.26.11, last published days ago; Brazil support confirmed in package documentation                                                                                                                                                                                                                                                                                                                                                                 |

**Use for:** `packages/shared/src/utils/payroll-calendar.ts` — shared utility consumed by both backend (payroll engine) and tests.

---

### Mobile: 1 new package

---

#### 5. expo-task-manager — Background Geolocation for Timesheet Punch-in/out

| Attribute              | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package                | `expo-task-manager`                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Version                | `~14.0.9` (Expo SDK 54 bundled version — npm-verified March 2026)                                                                                                                                                                                                                                                                                                                                                                                          |
| Purpose                | Enable background location tasks so that when a field worker punches in/out via the mobile app, the GPS coordinates are captured even if the app is backgrounded. Required for: geofence validation (confirming employee is on-farm when registering attendance), timestamp + GPS on timesheet entries.                                                                                                                                                      |
| Why                    | `expo-location` (already installed) handles foreground location. For background capture during shift tracking, `expo-task-manager` registers a persistent background task that Expo manages through iOS Background Modes and Android foreground service. This is the official Expo pattern for background geolocation — used together with `expo-location`'s `startLocationUpdatesAsync`.                                                                    |
| Expo SDK 54 compat     | `expo-task-manager@14.0.9` is the version bundled with Expo SDK 54 (the project's current SDK). Installing a mismatched version causes runtime errors in the Expo managed workflow. Pin with `~14.0.9`.                                                                                                                                                                                                                                                    |
| Limitation             | Background location requires additional app store permissions (`NSLocationAlwaysUsageDescription` on iOS, `ACCESS_BACKGROUND_LOCATION` on Android). These must be declared in `app.json`. For simple punch-in/out without continuous tracking, foreground-only with `expo-location` (already installed) is sufficient — evaluate whether background tracking is truly needed vs. requiring the user to open the app to punch in (simpler, fewer permissions). |
| Confidence             | MEDIUM — version verified via npm and Expo SDK 54 changelog; background location capability confirmed in official Expo docs; permission requirements on iOS/Android add submission complexity                                                                                                                                                                                                                                                                |

**Use for:** `apps/mobile/src/tasks/location-task.ts` — define background task at top-level scope (Expo requirement). Only needed if continuous background tracking is required. For punch-in/punch-out only (no continuous tracking), `expo-location` alone suffices.

---

## No New Infrastructure Required — Custom Services

### Payroll Calculation Engine: Custom TypeScript Service (No Library)

**Decision: Do not use any npm payroll calculation library. Build a custom `PayrollEngine` in `packages/shared`.**

No maintained Node.js/TypeScript library exists for Brazilian payroll calculation. The ecosystem has abandoned this space — `esocial@0.9.3` (the only npm package named "esocial") is an unrelated Ethereum DApp browser published 5 years ago with no connection to Brazilian eSocial. TOTVS, Senior, and ADP — the major Brazilian HR software vendors — build custom calculation engines.

**Build `packages/shared/src/utils/payroll-engine.ts`:**

```typescript
// Tax tables as versioned constants — update annually per Receita Federal
export const INSS_TABLE_2026: BracketTable = [
  { upTo: 1518.00,   rate: 0.075, deduction: 0 },
  { upTo: 2793.88,   rate: 0.09,  deduction: 22.77 },
  { upTo: 4190.83,   rate: 0.12,  deduction: 106.59 },
  { upTo: 8157.41,   rate: 0.14,  deduction: 190.38 },
  // ceiling: contribution capped at 1,142.04 (2026)
];

export const IRRF_TABLE_2026: BracketTable = [
  { upTo: 5000.00,   rate: 0,     deduction: 0 },
  { upTo: 7350.00,   rate: 0.075, deduction: 375.00 },
  { upTo: 10525.19,  rate: 0.15,  deduction: 926.25 },
  { upTo: 20203.73,  rate: 0.225, deduction: 1712.64 },
  { upTo: Infinity,  rate: 0.275, deduction: 2723.32 },
];

// Rural-specific: FUNRURAL patronal (Empregador Rural Pessoa Física)
// 1.5% RAT + 0.1% SENAR over gross payroll (alternative to INSS 20%)
export const FUNRURAL_RATE = 0.015;
export const SENAR_RATE = 0.001;
```

**Calculation chain (in order):**

1. Gross salary (salário bruto) — includes night shift premium (25% rural, 21h–5h), overtime, DSR
2. INSS (employee) — progressive table on gross; cap at ceiling
3. IRRF base = gross − INSS − dependant deduction (R$ 189.59/dependant in 2026) − alimentação/moradia discounts
4. IRRF = progressive table on IRRF base
5. FGTS = 8% of gross (employer deposits, not employee deduction) — separate ledger entry
6. Net salary = gross − INSS − IRRF − other discounts (vale adiantado, etc.)
7. FUNRURAL patronal = 1.5% + 0.1% SENAR on gross payroll (replaces INSS patronal 20% for eligible rural employers)

**DSR (Descanso Semanal Remunerado):** For variable pay (overtime, NR-31 hazard pay), DSR supplement = variable total / (business days in month) × (Sundays + holidays in month). Uses `date-fns` + `date-holidays`.

**Night shift rural (adicional noturno rural):** 21h–5h window (not 22h–5h standard urban); 25% premium (not 20%). Store shift boundaries per employee contract; timesheet entries calculate overlap with this window.

**Confidence:** HIGH for calculation logic (formulas sourced from Lei 5.889/73, Decreto 73.626/74, and RFB Instrução Normativa 2.141/2023); MEDIUM for 2026 tax table values (sourced from contabilizei.com.br + praticasdepessoal.com.br — official RFB tables not directly fetched but values cross-checked across 3 sources)

---

### eSocial XML Generation: Custom Builder Pattern (No Third-Party eSocial Library)

**Decision: Build custom eSocial event builders using `xmlbuilder2`. Do not use `tst-labs/esocial` or any third-party eSocial library.**

The `tst-labs/esocial` project is Java-based (not Node.js). The npm package `esocial@0.9.3` is a completely unrelated Ethereum project. No TypeScript eSocial library exists on npm.

**Current eSocial version:** S-1.3 (mandatory since December 2024). Technical Notes 03/2025 and 04/2025 update XSD schemas — the system must reference current XSD from the official eSocial portal.

**Approach:**

- `modules/esocial/` with one builder per event group:
  - `S-2200Builder` — employee admission (admissão)
  - `S-2206Builder` — contract alteration (alteração de contrato)
  - `S-2230Builder` — leave of absence (afastamento temporário)
  - `S-2299Builder` — termination (desligamento)
  - `S-1200Builder` — payroll earnings (remuneração do trabalhador)
  - `S-1210Builder` — payment (pagamento de rendimentos)
  - `S-3000Builder` — event exclusion (exclusão de eventos)

- `EsocialSignerService` signs each XML with `xml-crypto` using the employer's ICP-Brasil certificate

- `EsocialTransmitterService` sends to eSocial REST API using `axios` with mTLS (PFX certificate as `httpsAgent`)

- `EsocialStatusDashboard` — BullMQ job tracks submission UUID, polls for processing status (lote receipt → validation → processing)

**XSD validation (optional, dev-time only):** `xsd-schema-validator@0.11.0` (Java-based, dev-only) can validate generated XML against official eSocial XSD files. Run in CI to catch schema violations before they hit the government endpoint. Do NOT install in production.

**Confidence:** HIGH for approach; MEDIUM for specific XSD validation library (Java dependency in Node.js is awkward — consider skipping in favor of integration testing against eSocial sandbox)

---

### TRCT and Labor Documents: pdfkit + pdfkit-table (Reuse + New Plugin)

**Decision: Reuse `pdfkit@^0.17.2` with new `pdfkit-table@^0.1.99` plugin. Do NOT switch to Puppeteer/Playwright for payslips.**

Puppeteer/Playwright would require a Chromium binary in the production Docker image (+150MB). The existing `pdfkit` pattern (used by `modules/pesticide-prescriptions/` for CREA/CONFEA-format PDFs) is sufficient. `pdfkit-table` adds the missing table layout capability for:

- **Holerite (payslip):** Employee header, earnings table (rubric code, description, reference, amount), deductions table, net pay footer, FGTS and employer contributions summary
- **TRCT (Termo de Rescisão do Contrato de Trabalho):** MTE-prescribed 9-section form with calculated amounts per section
- **Ficha de EPI:** Equipment description, CA number, delivery dates, employee signature placeholder
- **13º Salário (1ª e 2ª parcela):** Simplified payslip format

---

### Monthly Payroll Scheduler: BullMQ (Already Installed)

**Decision: Use existing `bullmq@^5.71.0` for payroll processing. Use existing `node-cron@^4.2.1` for triggering.**

The payroll processing flow is complex and long-running (iterate all active employees, calculate payroll, generate PDFs, queue eSocial events). This must be a BullMQ job — not a synchronous HTTP request. The architecture:

```
node-cron (trigger, monthly)
  → enqueue PayrollProcessingJob(orgId, competencia) in BullMQ
    → PayrollWorker: calculate all employees
    → for each employee: enqueue GeneratePayslipJob
    → for each employee: enqueue EsocialS1200Job
    → after all: enqueue SendPayslipEmailJob
```

Use existing BullMQ infrastructure. Add new queues: `payroll-processing`, `payslip-generation`, `esocial-events`.

**Why not node-cron for payroll calculation directly:** Payroll calculation for 50+ employees takes 5–30 seconds. Running it inside a cron callback blocks the Node.js event loop and has no retry on failure. BullMQ jobs are persisted in Redis, retried automatically, and observable via Bull Board (already integrated in this project).

---

### Payroll Tax Tables: Database-Backed (No Config File)

**Decision: Store INSS, IRRF bracket tables in PostgreSQL as versioned records. Do NOT hardcode in source files.**

Tax tables change annually (every January via Receita Federal Instrução Normativa). Hardcoding forces a code deployment to update rates. Instead:

```prisma
model TaxBracket {
  id         String   @id @default(uuid())
  type       TaxType  // INSS | IRRF | FUNRURAL | SENAR
  year       Int      // 2026, 2027...
  bracketMin Decimal
  bracketMax Decimal? // null = infinity
  rate       Decimal
  deduction  Decimal  @default(0)
  createdAt  DateTime @default(now())
}
```

Admin screen for tax table management. Payroll engine queries the table for the competência year. Seed migrations include 2025 and 2026 tables with correct values.

---

## Installation

```bash
# Backend additions (run from apps/backend/)
pnpm add xmlbuilder2 xml-crypto pdfkit-table date-holidays

# Add TypeScript types (xml-crypto ships its own; pdfkit-table may need)
pnpm add -D @types/pdfkit-table

# Mobile addition (run from apps/mobile/)
pnpm add expo-task-manager@~14.0.9

# packages/shared additions (no new npm packages — new utility files only)
# Create: packages/shared/src/utils/payroll-engine.ts
# Create: packages/shared/src/utils/payroll-calendar.ts
# Create: packages/shared/src/utils/labor-law-rural.ts (Lei 5.889/73 helpers)
```

**Note:** `pdfkit-table` patches the `PDFDocument` prototype. Import order matters — import `pdfkit-table` after `pdfkit` in service files:

```typescript
import PDFDocument from 'pdfkit';
import 'pdfkit-table'; // patches prototype
```

---

## Alternatives Considered

| Category                     | Recommended                           | Alternative                       | Why Not                                                                                                                        |
| ---------------------------- | ------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| eSocial XML building         | `xmlbuilder2@^4.0.3`                  | String templates                  | Special characters in Brazilian names break unescaped XML; maintenance nightmare for 200-element events                        |
| eSocial XML building         | `xmlbuilder2@^4.0.3`                  | `@xmldom/xmldom` (existing)       | DOM node-by-node API is 10x more verbose; xmlbuilder2 is purpose-built for generation (not parsing)                            |
| XML digital signature        | `xml-crypto@^6.1.2`                   | `xmldsigjs`                       | `xmldsigjs` uses Web Crypto API (browser-oriented); `xml-crypto` is battle-tested in server-side NFe/eSocial ecosystem         |
| XML digital signature        | `xml-crypto@^6.1.2`                   | Custom crypto                     | XMLDSig is a complex standard (C14N, transforms, digest); reinventing it introduces security bugs                              |
| PDF table layout             | `pdfkit-table@^0.1.99`                | Puppeteer/Playwright HTML-to-PDF  | +150MB Chromium in Docker; adds browser engine complexity; existing pdfkit works well for structured payroll docs              |
| PDF table layout             | `pdfkit-table@^0.1.99`                | `voilab-pdf-table@0.5.1`          | Requires explicit column width in points; less intuitive API; smaller community than pdfkit-table                              |
| Holiday calendar             | `date-holidays@^3.26.11`              | Hardcoded list in code            | Legislature adds new holidays (Consciência Negra went national in 2024); `date-holidays` is updated within days of changes     |
| Holiday calendar             | `date-holidays@^3.26.11`              | `@lfreneda/eh-dia-util`           | Only national holidays; no state-level support (rural workers may be in any Brazilian state)                                   |
| Payroll calculation          | Custom `PayrollEngine` (shared)       | Any npm payroll library           | No Brazilian payroll library exists on npm. TOTVS/Senior/ADP all build custom engines.                                        |
| eSocial library              | Custom builders + `xmlbuilder2`       | `tst-labs/esocial`                | Java-based; not usable in Node.js without Java process invocation; adds JVM dependency                                        |
| Background geolocation       | `expo-task-manager@~14.0.9`           | `react-native-background-geolocation` (transistor) | Transistor library requires EAS custom build (cannot use Expo managed workflow); adds cost/complexity |
| Timesheet PDF                | `pdfkit` + `pdfkit-table` (existing+) | `react-pdf` (frontend rendering)  | Espelho de ponto PDF is a server-side document for legal retention; browser-side rendering has no audit trail                   |
| RAIS/DIRF generation         | Custom formatter (no library)         | Any RAIS npm package              | RAIS uses proprietary SEFIP layout; no maintained Node.js library exists; CSV/TXT generation is straightforward                |

---

## What NOT to Use

| Avoid                          | Why                                                                                                           | Use Instead                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `esocial` (npm package)        | Unrelated Ethereum DApp browser — not Brazilian eSocial system. Version 0.9.3, published 5 years ago.        | Custom builders with `xmlbuilder2`                 |
| `tst-labs/esocial`             | Java-only implementation; requires JVM; not installable as npm package                                        | Custom builders with `xmlbuilder2`                 |
| `xml2js`                       | Maintenance mode; callback API; inconsistent array/object output; superseded by `fast-xml-parser` and xmlbuilder2 | `xmlbuilder2` for generation                     |
| Puppeteer / Playwright         | +150MB Docker image weight; Chromium binary not appropriate for serverless/container payroll service           | `pdfkit` + `pdfkit-table`                          |
| Any npm payroll library        | None exists for Brazilian CLT + Lei 5.889/73 + FUNRURAL rural specifics                                       | Custom `PayrollEngine` in `packages/shared`        |
| `xlsx` (SheetJS)               | Commercial license required since v0.20.0 for production use                                                  | `exceljs` (already installed)                      |
| `react-dnd`                    | React 19 support gap (open issue)                                                                             | `@dnd-kit` (already installed)                     |
| Puppeteer for eSocial XML      | eSocial XML is not HTML; no browser needed                                                                    | `xmlbuilder2`                                      |
| New PostgreSQL extensions      | PostGIS already installed; HR module needs no new extensions                                                   | Standard Prisma + `$queryRaw` where needed         |
| Separate digital signature service (microservice) | Adds network hop + deployment complexity; Node.js `xml-crypto` + native `crypto` is sufficient | `xml-crypto` in-process                          |

---

## Stack Patterns by Variant

**If employer is Empregador Rural Pessoa Física (EPF):**
- Use FUNRURAL (1.5% + 0.1% SENAR on gross payroll) instead of INSS patronal 20%
- Store employer type on `Organization` model: `employerType: PESSOA_FISICA | PESSOA_JURIDICA`
- `PayrollEngine.calculateEmployerContributions()` branches on this flag

**If employee has Contrato de Safra (art. 14-A Lei 5.889/73):**
- No FGTS opt-in required (safristas were previously excluded; since 2001 FGTS is mandatory)
- All rights proportional: 1/12 férias + 1/3 per month, 1/12 13º per month, paid at contract end
- Store `contractType: SAFRA` on `EmployeeContract` model; payroll engine calculates differently

**If timesheet punch-in/out is foreground-only (no continuous tracking):**
- Use `expo-location` (already installed) for one-time GPS capture at punch events
- Skip `expo-task-manager` — saves complexity and app store permission issues

**If timesheet punch-in/out requires geofence validation:**
- Use `expo-task-manager` + `expo-location` background task
- Define farm boundary as GeoJSON polygon (already stored in `Farm.boundary` via PostGIS)
- Server-side geofence check: `ST_Within(employeePoint, farmBoundary)` — no client-side geofencing library needed

---

## Version Compatibility

| Package                  | Node.js | TypeScript | Expo SDK | Peer Deps                    | Notes                                         |
| ------------------------ | ------- | ---------- | -------- | ---------------------------- | --------------------------------------------- |
| `xmlbuilder2@^4.0.3`     | >=20    | >=5.0      | N/A      | none (zero deps)             | Ships built-in types; Node 24 confirmed       |
| `xml-crypto@^6.1.2`      | >=14    | >=4.7      | N/A      | none                         | Ships built-in types; no `@types/` needed     |
| `pdfkit-table@^0.1.99`   | >=14    | >=4.7      | N/A      | `pdfkit@>=0.13.0`            | Patches PDFDocument prototype; import after pdfkit |
| `date-holidays@^3.26.11` | >=12    | >=4.7      | N/A      | none                         | Ships types; actively updated for law changes  |
| `expo-task-manager@~14.0.9` | N/A  | >=5.0      | ~54.0    | `expo@~54`, `expo-location`  | Pin with `~` — must match Expo SDK 54 version |

---

## Integration Points with Existing Modules

| New Capability                          | Integrates With                           | Notes                                                                                       |
| --------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| Payroll → Contas a Pagar                | `modules/payables/`                       | Monthly payroll creates one `Payable` per employee for net salary; bulk batch pattern        |
| Payroll FGTS/INSS/IRRF → Contas a Pagar | `modules/payables/`                      | Government guides (GFIP, GPS, DARF) create `Payable` records with tax `costCenterId`        |
| Employee hourly cost → Manutenção OS    | `modules/work-orders/`                    | Rateio de mão de obra: timesheet hours × hourly rate → OS cost component (already modeled)  |
| Employee bulk import                    | `exceljs` (existing) + `react-spreadsheet-import` (v1.2 already installed) | Reuse same pattern as asset bulk import |
| Holerite email delivery                 | `nodemailer` + `handlebars` (existing)    | Add `payslip-email.hbs` template; same `MailService` wrapper                                |
| Field team → Timesheet                  | `modules/field-teams/` (existing)         | `FieldTeam` entity already links employees to operations; extend for hour attribution        |
| EPI expiry alerts                       | BullMQ (existing) + `nodemailer`          | Scheduled check via BullMQ repeatable job; email via existing mail service                  |
| eSocial digital cert storage            | `multer` (existing) + encrypted DB field  | PFX uploaded once per org; stored as encrypted bytes in `Organization.esocialCertificate`   |

---

## Sources

- `/apps/backend/package.json` — existing backend dependencies (HIGH confidence)
- `/apps/frontend/package.json` — existing frontend dependencies (HIGH confidence)
- `/apps/mobile/package.json` — existing mobile dependencies (HIGH confidence)
- npm registry: `xml-crypto@6.1.2` — confirmed via `registry.npmjs.org` (HIGH confidence)
- npm registry: `xmlbuilder2@4.0.3` — confirmed via `registry.npmjs.org` (HIGH confidence)
- npm registry: `pdfkit-table@0.1.99` — confirmed via `registry.npmjs.org` (HIGH confidence)
- npm registry: `date-holidays@3.26.11` (last published ~8 days ago) — confirmed via `registry.npmjs.org` (HIGH confidence)
- npm registry: `expo-task-manager@55.0.10` (SDK 54 compatible pin: `~14.0.9`) — confirmed via `registry.npmjs.org` (HIGH confidence)
- npm registry: `esocial@0.9.3` — confirmed as unrelated Ethereum DApp browser; 5 years old; zero downstream uses (HIGH confidence)
- [xml-crypto GitHub](https://github.com/node-saml/xml-crypto) — RSA-SHA256 and X509 support confirmed in README (HIGH confidence)
- [xmlbuilder2 GitHub](https://github.com/oozcitak/xmlbuilder2) — TypeScript built-in, Node.js >=20, actively maintained (HIGH confidence)
- [Expo TaskManager Docs](https://docs.expo.dev/versions/latest/sdk/task-manager/) — SDK 54 bundled version 14.0.9 (HIGH confidence)
- [eSocial S-1.3 NT 03/2025 — TOTVS](https://www.totvs.com/blog/fiscal-clientes/esocial-ajustes-dos-leiautes-versao-s-1-3-nt-03-2025/) — confirms S-1.3 as current layout (MEDIUM confidence)
- [eSocial S-1.3 NT 05/2025 — mercans](https://mercans.com/resources/statutory-alerts/brazil-esocial-layout-update-nt-05-2025-moves-to-production/) — NT 05/2025 production status confirmed (MEDIUM confidence)
- [Tabela INSS 2026 — contabilizei.com.br](https://www.contabilizei.com.br/contabilidade-online/tabela-inss/) — progressive INSS brackets for 2026 (MEDIUM confidence — not official RFB source, cross-check before seeding)
- [Tabela IRRF 2026 — contabilizei.com.br](https://www.contabilizei.com.br/contabilidade-online/tabela-imposto-de-renda/) — IRRF exemption up to R$5,000 confirmed for 2026 (MEDIUM confidence)
- [INSS e IRRF 2026 — praticasdepessoal.com.br](https://praticasdepessoal.com.br/inss-e-irrf-2026-planilha-para-simulacao-de-calculo/) — cross-validation of tax table values (MEDIUM confidence)
- [Lei 5.889/73](http://www.planalto.gov.br/ccivil_03/leis/l5889.htm) — rural labor law: adicional noturno 25%, 21h–5h window, moradia 25%/alimentação 20% (HIGH confidence — official government source)
- [BullMQ Docs — Job Schedulers](https://docs.bullmq.io/guide/job-schedulers) — cron expression format, `upsertJobScheduler` API (HIGH confidence)
- WebSearch: `tst-labs/esocial` — Java-only, not usable as Node.js npm package (MEDIUM confidence — GitHub confirmed as Java via WebSearch)

---

_Stack research for: v1.3 RH e Folha de Pagamento Rural_
_Researched: 2026-03-23_
