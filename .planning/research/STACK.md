# Technology Stack

**Project:** Protos Farm — v1.2 Gestão de Patrimônio (Asset Lifecycle Management)
**Researched:** 2026-03-19
**Confidence:** HIGH for backend additions; MEDIUM for XML parsing choice; LOW for biological asset valuation approach (no standard library exists)

---

## Context: What Already Exists (Do Not Re-Add)

The following are already installed and in active use. All new work must reuse these.

| Library             | Version   | Already Covers                                                                              |
| ------------------- | --------- | ------------------------------------------------------------------------------------------- |
| `pdfkit`            | ^0.17.2   | PDF generation — reuse for asset register, depreciation schedule, work order reports        |
| `exceljs`           | ^4.4.0    | Excel/CSV export AND import — reuse pattern from `modules/stock-entries/` for bulk import   |
| `decimal.js`        | ^10.6.0   | Monetary arithmetic — Money type wraps this; all depreciation/valuation amounts use it      |
| `node-cron`         | ^4.2.1    | Already installed; use for monthly depreciation job (no new scheduler needed)               |
| `@xmldom/xmldom`    | ^0.8.11   | XML DOM parsing — already used for NF-e; reuse pattern for asset NF-e import               |
| `bullmq`            | ^5.71.0   | Background jobs — already in use for procurement; reuse for async PDF/email of OS           |
| `recharts`          | ^3.7.0    | Charts — already in frontend; use for maintenance dashboard, TCO trends, depreciation curve |
| `nodemailer`        | ^8.0.1    | Email — already wrapped in `src/shared/mail/mail.service.ts`; use for work order alerts    |
| `handlebars`        | ^4.7.8    | Email templates — already in use for procurement; reuse for work order notifications        |
| `ioredis`           | ^5.9.3    | Redis — already connected; BullMQ uses it for work order job queue                         |
| `multer`            | ^2.1.0    | File upload — already in use; reuse for NF-e XML upload on asset acquisition               |
| `lucide-react`      | ^0.575.0  | Icons — design system standard                                                              |
| `react-router-dom`  | ^7.13.1   | Routing — already in use                                                                    |

---

## New Dependencies Required

### Backend: 1 new package

#### 1. fast-xml-parser — NF-e XML Parsing for Asset Acquisition

| Attribute            | Value                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package              | `fast-xml-parser`                                                                                                                                                                                                                                                                                                                                                                                                            |
| Version              | `^5.5.7` (npm-verified, March 2026)                                                                                                                                                                                                                                                                                                                                                                                          |
| Purpose              | Parse NF-e XML to extract asset acquisition data: emitente (supplier), destinatário, itens (product, unit price, CFOP, NCM), total, data emissão                                                                                                                                                                                                                                                                             |
| Why not `@xmldom/xmldom` | `@xmldom/xmldom` provides a DOM API requiring manual XPath/querySelector navigation — verbose for deep NF-e structures. `fast-xml-parser` converts the entire NF-e XML to a typed JS object in one call, which is simpler for the asset acquisition import flow (map `infNFe.det[n]` to asset line items). Zero dependencies, 5.5.x is the current stable release.                                                         |
| Why not `xml2js`     | `xml2js` is in maintenance mode, uses callbacks (async pain), produces inconsistent arrays vs objects depending on tag count. `fast-xml-parser` has consistent output and is actively maintained (5.x release Jan 2025).                                                                                                                                                                                                      |
| Confidence           | HIGH — npm-verified version; well-established for NF-e parsing in the Node.js ecosystem; existing `@xmldom/xmldom` covers simpler XML; this is additive for structured NF-e parsing                                                                                                                                                                                                                                         |

**Use for:**
- `modules/assets/` service: `parseNFeXml(buffer)` → extract supplier + product line items → create asset records
- Supports NF-e schema v4.0 (NT 2024.003) tag structure

**Do NOT replace `@xmldom/xmldom`** — keep for existing uses in other modules.

---

### Frontend: 1 new package

#### 2. react-spreadsheet-import — Bulk Asset Import with Column Mapping UI

| Attribute              | Value                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package                | `react-spreadsheet-import`                                                                                                                                                                                                                                                                                                                                                                                    |
| Version                | `^4.7.1` (npm-verified, March 2026)                                                                                                                                                                                                                                                                                                                                                                           |
| Purpose                | Multi-step import UI for bulk asset upload via Excel/CSV: upload → column mapping → validation → confirm                                                                                                                                                                                                                                                                                                       |
| Why                    | Asset bulk import requires users to map their spreadsheet columns to system fields (e.g., their "Nº Série" → system `serialNumber`). Building this UI from scratch (file upload + column mapping + row-level validation table) is 2–3 days of work. `react-spreadsheet-import` ships the complete multi-step flow with automated header matching, per-row validation (required, regex, unique), and error display. |
| Why not raw `exceljs`  | `exceljs` is for parsing on the backend. The UX requirement is frontend column mapping before submission — the user sees their data, fixes errors, then submits. `exceljs` alone gives no frontend UX.                                                                                                                                                                                                         |
| Why not custom upload  | The stock-entries module uses a simpler CSV upload (no column mapping needed — fixed format). Assets come from varied spreadsheets (legacy TOTVS exports, manual farmer sheets) requiring flexible column mapping.                                                                                                                                                                                               |
| Caveat                 | Last published 2 years ago (v4.7.1). Actively used in production projects (Snyk advisor shows usage). React 19 peer dep — test render in isolation before committing. If React 19 incompatibility found, fall back to custom step wizard + raw `exceljs` on frontend.                                                                                                                                          |
| Confidence             | MEDIUM — version verified via npm; React 19 compatibility not officially confirmed; project already uses React 19 so test first                                                                                                                                                                                                                                                                                 |

**Use only for** the bulk asset import modal (`AssetBulkImportModal`). All other imports (single asset via form, NF-e via XML) do not need this.

---

## No New Infrastructure Required

### Depreciation Engine: Custom TypeScript Service (No Library)

**Decision: Do not use `asset-depreciation-calculator` or `financial` npm packages.**

Rationale:
- `asset-depreciation-calculator@1.2.0` (Kontist/Shine): Only implements German straight-line tax method (Absetzung für Abnutzung). Does not support hours-based, production-based, or accelerated methods. Published "over a year ago" — dormant.
- `financial@0.2.4` (numpy-financial port): Provides `SLN` (straight-line) and `DDB` (double declining balance) but not hours-based or production-based methods. Published 1 year ago. No CPC 27/29 compliance context.

**Build a custom `DepreciationEngine` service in `packages/shared/src/utils/depreciation.ts`:**

```typescript
// packages/shared/src/utils/depreciation.ts

export type DepreciationMethod =
  | 'LINEAR'           // CPC 27: (cost - residualValue) / usefulLifeMonths
  | 'HOURS_BASED'      // (cost - residualValue) / totalHours * hoursThisPeriod
  | 'PRODUCTION_BASED' // (cost - residualValue) / totalUnits * unitsThisPeriod
  | 'ACCELERATED';     // Double declining balance: (2 / usefulLifeMonths) * netBookValue

export interface DepreciationInput {
  cost: Decimal;             // Original acquisition cost
  residualValue: Decimal;    // Valor residual (typically 10% for farm machinery)
  usefulLifeMonths: number;  // Vida útil em meses (RFB Table: tractor = 60, truck = 60, building = 480)
  accumulatedDepreciation: Decimal;
  referenceDate: Date;       // Pro-rata from activation date in first month
  activationDate: Date;
  // For HOURS_BASED:
  totalLifetimeHours?: number;
  hoursThisPeriod?: number;
  // For PRODUCTION_BASED:
  totalLifetimeUnits?: number;
  unitsThisPeriod?: number;
}

export interface DepreciationResult {
  periodDepreciation: Decimal;   // Amount for this period
  accumulatedAfter: Decimal;     // New accumulated total
  netBookValue: Decimal;         // Cost - accumulated after
  isFullyDepreciated: boolean;
  proRataDays?: number;          // For first/last month pro-rata
}
```

All arithmetic uses `decimal.js` (already installed). Pro-rata die calculation for first month activation. Capped at (cost - residualValue) — never depreciates below residual.

**Confidence:** HIGH — standard accounting formulas, no library needed, full control over CPC 27 specifics

---

### CPC 29 Biological Asset Valuation: Custom Service (No Standard Library)

**Decision: Build custom `BiologicalAssetValuation` service. No npm library exists for CPC 29/IAS 41.**

CPC 29 (aligned with IAS 41) requires measuring biological assets at **fair value less costs to sell** at each reporting date. For farm context:

| Asset Type     | Valuation Approach                                                                    |
| -------------- | ------------------------------------------------------------------------------------- |
| Perennial crops (coffee, orange trees) | Market price × productive capacity − estimated harvest cost. Source: CEPEA/ESALQ price indices. |
| Cattle herd    | Current market price per arroba (@ live weight) × estimated weight                   |
| Bearer plants  | If fair value unreliable: cost model (CPC 27) is permitted fallback (IAS 41.30)       |

Implementation approach:
- `modules/biological-assets/` with `BiologicalAsset` model storing: `type`, `quantity`, `acquisitionCost`, `lastFairValue`, `lastValuationDate`, `valuationMethod` (FAIR_VALUE | COST_MODEL)
- Admin enters fair value manually at period-end (system does not auto-fetch CEPEA prices — out of scope, no API integration)
- System calculates `gainLoss = fairValue - previousCarryingAmount` for disclosure in report
- No external library needed — this is a data model + calculation service, not a math library problem

**Confidence:** MEDIUM — IAS 41/CPC 29 requirements verified via official IFRS Foundation docs; implementation approach (manual fair value entry) is the standard for systems without live market data feeds

---

### Monthly Depreciation Scheduler: node-cron (Already Installed)

**Decision: Use existing `node-cron@^4.2.1` — no new scheduler needed.**

`node-cron` is already installed and used in the project. Register the depreciation job in `src/scheduler/depreciation.cron.ts`:

```typescript
// Run at 01:00 on the 1st of every month
cron.schedule('0 1 1 * *', async () => {
  await depreciationService.runMonthlyBatch();
});
```

`runMonthlyBatch()` uses `prisma.$transaction()` to:
1. Fetch all active depreciable assets per organization
2. Calculate period depreciation using `DepreciationEngine`
3. Write `DepreciationEntry` records
4. Update `Asset.accumulatedDepreciation` and `Asset.netBookValue`
5. Optionally auto-create a `Payable` cost-center appropriation entry

**Why not pg_cron:** Requires PostgreSQL extension not currently enabled. Application-level cron is sufficient for a monthly job that runs in <30 seconds.

**Why not BullMQ:** BullMQ (already installed) is for event-driven jobs. Monthly depreciation is schedule-driven — pure cron is appropriate.

---

### Asset Hierarchy (Parent-Child up to 3 Levels): Prisma Self-Relation + Raw SQL

**Decision: Adjacency list (Prisma self-relation) for writes; `WITH RECURSIVE` CTE for tree reads.**

Prisma natively supports self-relations (adjacency list) but does NOT support recursive CTE queries via the ORM. For 3-level asset hierarchy (Farm Equipment → Engine → Injector), use:

```prisma
model Asset {
  id        String   @id @default(uuid())
  parentId  String?
  parent    Asset?   @relation("AssetChildren", fields: [parentId], references: [id])
  children  Asset[]  @relation("AssetChildren")
  depth     Int      @default(0)  // 0=root, 1=component, 2=part (max 2 per spec)
}
```

For queries needing full subtree (TCO rollup, maintenance history):
```typescript
// Use prisma.$queryRaw for recursive CTE
const tree = await prisma.$queryRaw`
  WITH RECURSIVE asset_tree AS (
    SELECT id, name, parentId, 0 as level
    FROM "Asset" WHERE id = ${rootId}
    UNION ALL
    SELECT a.id, a.name, a.parentId, at.level + 1
    FROM "Asset" a JOIN asset_tree at ON a."parentId" = at.id
    WHERE at.level < 2
  )
  SELECT * FROM asset_tree
`;
```

**Confidence:** HIGH — Prisma self-relation pattern is documented; `$queryRaw` for recursive CTE is the official Prisma recommendation for this limitation

---

### PDF Reports (Asset Register, Depreciation Schedule, Work Order): pdfkit (Already Installed)

**Decision: Reuse existing `pdfkit@^0.17.2` pattern from `modules/pesticide-prescriptions/`.**

New PDF documents needed:
- `AssetRegisterPdf` — ficha completa do ativo (TCO, historical acquisitions, current book value)
- `DepreciationSchedulePdf` — schedule by asset or cost center with monthly breakdown
- `WorkOrderPdf` — OS de manutenção with service description, parts used, labor hours, cost summary

All three follow the existing pattern: service method returns `Buffer`, route pipes it as `application/pdf` response. No new library needed.

---

### Work Order Background Jobs: BullMQ (Already Installed)

**Decision: Reuse existing `bullmq@^5.71.0` and `ioredis@^5.9.3`.**

Add new queue `work-orders` to the existing BullMQ setup:
- **Job type `send-wo-notification`:** Fire when OS status changes (OPEN → IN_PROGRESS → DONE); send email via `handlebars` template to responsible technician and asset owner
- **Job type `generate-wo-pdf`:** Async PDF generation for completed OS without blocking HTTP response

No new Redis infrastructure, no new BullMQ installation.

---

### Maintenance Schedule Visualization: Recharts (Already Installed)

**Decision: Reuse existing `recharts@^3.7.0` — no Gantt library needed.**

The maintenance dashboard requires:
- **Asset availability chart:** BarChart with uptime % per asset
- **Cost trends:** LineChart with depreciation + maintenance cost per month
- **Upcoming maintenance:** Table component (not chart) with sortable due dates

A full Gantt chart library (SVAR, DHTMLX, Syncfusion) is **not needed** for this scope. The maintenance plan schedule view is adequately represented as a table with status indicators + date columns. If a Gantt view is required in a future phase, evaluate then.

**Why avoid Gantt libraries now:** SVAR Gantt (open-source) and DHTMLX Gantt (commercial, $699+) add significant bundle weight and learning curve. The procurement kanban (already using @dnd-kit) covers the interactive scheduling need.

---

## Installation

```bash
# Backend addition (run from apps/backend/)
pnpm add fast-xml-parser

# Frontend addition (run from apps/frontend/)
pnpm add react-spreadsheet-import

# packages/shared addition (new util file, no new npm package)
# Create: packages/shared/src/utils/depreciation.ts
# Create: packages/shared/src/utils/biological-asset-valuation.ts
```

---

## Alternatives Considered

| Category                  | Recommended                          | Alternative                     | Why Not                                                                                                                    |
| ------------------------- | ------------------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| NF-e XML parsing          | `fast-xml-parser@^5.5.7`             | `@xmldom/xmldom` (existing)     | Already installed but DOM API is verbose for nested NF-e structures; fast-xml-parser gives object mapping in one call     |
| NF-e XML parsing          | `fast-xml-parser@^5.5.7`             | `xml2js`                        | Maintenance mode, callback API, inconsistent array/object output                                                           |
| NF-e XML parsing          | `fast-xml-parser@^5.5.7`             | `nfewizard-io`                  | NFeWizard-io is for NF-e emission/SEFAZ communication — full fiscal library. We only need XML parsing for import, not SEFAZ auth |
| Depreciation calculation  | Custom `DepreciationEngine` (shared) | `asset-depreciation-calculator` | Only straight-line German tax method; no hours/production methods; dormant (1+ year no updates)                            |
| Depreciation calculation  | Custom `DepreciationEngine` (shared) | `financial@0.2.4`               | Has SLN/DDB but not hours/production methods; no CPC 27 specifics; would still need custom wrapper                        |
| Biological asset valuation | Custom service (shared)             | Any external library            | No library exists for CPC 29/IAS 41 valuation; manual fair value entry is the correct approach for this system           |
| Bulk import UI            | `react-spreadsheet-import@^4.7.1`   | Custom file upload + table      | 2–3 days custom work vs. plug-in; flexible column mapping needed for varied farmer spreadsheet formats                     |
| Bulk import UI            | `react-spreadsheet-import@^4.7.1`   | `xlsx` npm package              | `xlsx` is parsing only, no UX; SheetJS licensing changed (commercial use requires license)                                |
| Monthly scheduler         | `node-cron` (existing)              | `pg_cron` PostgreSQL extension  | Extension not currently enabled; app-level cron sufficient for monthly batch                                               |
| Monthly scheduler         | `node-cron` (existing)              | BullMQ repeatable jobs          | BullMQ is event-driven; monthly depreciation is schedule-driven; mixing paradigms adds complexity                         |
| Asset hierarchy           | Adjacency list + `$queryRaw` CTE     | Closure table                   | Closure table requires custom migration scripts (Prisma has no built-in support); 3-level max makes CTE adequate           |
| Maintenance scheduling    | Recharts (existing)                 | SVAR Gantt (open-source)        | Bundle weight + learning curve not justified; table view sufficient for this scope                                         |
| Maintenance scheduling    | Recharts (existing)                 | Bryntum/DHTMLX Gantt            | Commercial license ($699+); overkill for maintenance plan visualization                                                    |

---

## What NOT to Use

| Avoid                         | Why                                                                                   | Use Instead                                        |
| ----------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `asset-depreciation-calculator` | Only straight-line German tax method; dormant; no hours/production/accelerated support | Custom `DepreciationEngine` in `packages/shared`  |
| `financial` (numpy-financial port) | Missing hours-based and production-based methods; no CPC 27 context            | Custom `DepreciationEngine` in `packages/shared`  |
| `financejs`                   | Last published 9 years ago; no TypeScript types; no pro-rata die                      | Custom engine                                      |
| `nfewizard-io`                | Full SEFAZ communication library (NF-e emission, CT-e); overkill for XML parse-only   | `fast-xml-parser`                                  |
| `xlsx` (SheetJS)              | Commercial licensing required for production use since v0.20.0                        | `exceljs` (already installed)                      |
| Gantt chart libraries         | Not justified for this phase scope; maintenance plan fits table view                  | Recharts + table components                        |
| `react-dnd`                   | React 19 support gap (open issue)                                                     | `@dnd-kit` (already installed for kanban)          |
| `socket.io`                   | Already excluded; SSE is sufficient (procurement phase decision)                      | Native SSE in Express                              |
| New PostgreSQL extensions     | PostGIS already installed; no additional extensions needed for asset management        | Standard Prisma + `$queryRaw` for recursive CTE   |

---

## Key Architecture Decisions Affecting Stack

### Decision 1: Custom Depreciation Engine in `packages/shared`

Place in `packages/shared/src/utils/depreciation.ts` (not `apps/backend`). Rationale:
- Frontend uses it to show **live depreciation preview** when the user configures an asset (before save)
- Backend uses it for the monthly batch job and on-demand recalculation
- Shared placement avoids duplicating the formulas

### Decision 2: No Separate "Asset Financial Journal" Table

Depreciation entries do NOT create rows in `Payable` or `Receivable`. They write to a dedicated `DepreciationEntry` table (asset-specific ledger). This keeps the payables module clean and makes patrimonial reconciliation queries simpler. Integration is one-directional: maintenance OS can optionally generate a `Payable` (for external service costs), but depreciation does not.

### Decision 3: Leasing (CPC 06/IFRS 16) via Installment Generator Pattern

The existing `installmentGenerator` utility in `packages/shared` (used by rural credit amortization SAC/Price) is reused for lease payment schedules. No new amortization library needed:
- Operating lease: monthly payments go to `Payable` directly (expense)
- Finance lease: recognize `Asset` (right-of-use) + `Liability` model; amortize with effective interest method using existing `decimal.js` arithmetic

### Decision 4: NF-e XML for Asset Acquisition (Not Full SEFAZ Integration)

Scope is import-only: user uploads NF-e XML file → system parses and pre-fills acquisition form. NOT: querying SEFAZ, validating DANFE, or emitting NF-e. The existing `multer` file upload + new `fast-xml-parser` covers this. Full SEFAZ integration is explicitly out of scope (PROJECT.md: "NF-e emissão/importação — módulo fiscal separado").

---

## Integration Points with Existing Modules

| New Capability                        | Integrates With                         | Notes                                                                                     |
| ------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------- |
| Asset acquisition (cash)              | `modules/payables/`                     | Acquisition → auto-create `Payable` via same pattern as stock receiving                   |
| Asset acquisition (financed)          | `modules/payables/` + `installmentGenerator` | Financed purchase → installments in `Payable` (same as rural credit)              |
| Depreciation → cost center            | `modules/cost-centers/`                 | `DepreciationEntry` stores `costCenterId`; monthly report aggregates by CC                |
| Maintenance OS (external service)     | `modules/payables/`                     | OS with external contractor → optional `Payable` for service cost                         |
| Maintenance parts consumption         | `modules/stock-outputs/`                | Parts used in OS → `StockOutput` (CONSUMPTION type); existing FEFO logic applies          |
| Asset sale with gain/loss             | `modules/receivables/`                  | Asset disposal → create `Receivable` for sale proceeds; calculate gain/loss               |
| Asset spare parts inventory           | `modules/products/` + `modules/stock-entries/` | Parts are `Product` with `nature: MATERIAL`; no new product type needed          |
| NF-e XML upload                       | `modules/stock-entries/` (existing pattern) | Reuse `multer` file endpoint pattern; add `modules/assets/asset-nfe-import.service.ts`  |
| Fuel consumption records              | `modules/stock-outputs/`                | Fuel abastecimento is a `StockOutput` of fuel product linked to asset                     |
| Document expiry alerts (CRLV, seguro) | `src/scheduler/` + `bullmq`             | Add scheduler check for expiring docs; send via existing email infrastructure             |

---

## Version Compatibility

| Package                         | Node.js | TypeScript | React  | Peer Deps                          | Notes                          |
| ------------------------------- | ------- | ---------- | ------ | ---------------------------------- | ------------------------------ |
| `fast-xml-parser@^5.5.7`        | >=14    | >=4.7      | N/A    | none                               | Zero dependencies; ships types |
| `react-spreadsheet-import@^4.7.1` | N/A   | >=4.7      | >=17   | react >=17 (test React 19 compat)  | Last published 2 years ago     |
| Custom `DepreciationEngine`     | >=18    | >=5.7      | N/A    | `decimal.js` (existing)            | No new deps                    |
| `node-cron@^4.2.1` (existing)   | >=18    | >=4.7      | N/A    | none                               | Already installed              |

---

## Sources

- `/apps/backend/package.json` — existing backend dependencies (HIGH confidence)
- `/apps/frontend/package.json` — existing frontend dependencies (HIGH confidence)
- npm registry: `npm info financial version` → 0.2.4 (HIGH confidence, npm-verified)
- npm registry: `npm info fast-xml-parser version` → 5.5.7, dist-tags latest (HIGH confidence, npm-verified)
- npm registry: `npm info react-spreadsheet-import version` → 4.7.1 (HIGH confidence, npm-verified)
- npm registry: `npm info node-cron version` → 4.2.1 (HIGH confidence, npm-verified)
- npm registry: `npm info asset-depreciation-calculator` → 1.2.0, published "over a year ago", zero downstream users (HIGH confidence, npm-verified)
- npm registry: `npm info bullmq version` → 5.71.0 (HIGH confidence, already in use)
- WebSearch: `asset-depreciation-calculator` (Kontist/Shine) only supports straight-line German method (MEDIUM confidence — GitHub README not directly read)
- WebSearch: `financial` package numpy-financial port — has SLN/DDB but not units-of-production (MEDIUM confidence — GitHub confirmed via search, not direct read)
- Official IFRS Foundation: IAS 41 Agriculture — fair value less costs to sell (HIGH confidence)
- WebSearch: CPC 29 ≈ IAS 41 in Brazilian context (MEDIUM confidence — CPCON, CPDBox sources)
- Prisma docs: Self-relations and `$queryRaw` for recursive CTEs — official recommendation (HIGH confidence)
- [fast-xml-parser GitHub](https://github.com/NaturalIntelligence/fast-xml-parser) — actively maintained, NF-e ecosystem use cases (MEDIUM confidence — via WebSearch)
- [react-spreadsheet-import GitHub](https://github.com/UgnisSoftware/react-spreadsheet-import) — v4.7.1, automated column matching + row validation (MEDIUM confidence — via WebSearch)
- [IAS 41 Agriculture — IFRS Foundation](https://www.ifrs.org/issued-standards/list-of-standards/ias-41-agriculture/) — fair value measurement requirements (HIGH confidence)
- [SVAR React Gantt top libraries 2026](https://svar.dev/blog/top-react-gantt-charts/) — confirms commercial pricing for advanced Gantt (MEDIUM confidence)

---

_Stack research for: v1.2 Gestão de Patrimônio — Asset Lifecycle Management_
_Researched: 2026-03-19_
