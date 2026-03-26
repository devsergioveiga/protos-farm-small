# Phase 23: Relatórios e Dashboard Patrimonial - Research

**Researched:** 2026-03-22
**Domain:** Asset reporting, depreciation projection, TCO dashboard, cost-center wizard
**Confidence:** HIGH

## Summary

Phase 23 is a pure reporting/dashboard phase that consumes data already produced by Phases 17–22. No new Prisma schema migrations are required: all data sources (DepreciationEntry, DepreciationConfig, Asset, WorkOrder, FuelRecord, AssetDisposal, CostCenter, MaintenanceProvision) exist and are populated. The phase delivers four deliverables:

1. **Patrimonial Inventory Report** — gross value, accumulated depreciation, net book value grouped by asset class (AssetClassification), exportable as PDF/Excel/CSV. Backend already exports individual asset lists (asset-export.service.ts uses pdfkit + ExcelJS). Phase 23 extends this to a class-level aggregate report with a new service and endpoint.

2. **Depreciation Report + Projection** — the existing DepreciationPage shows monthly entries. Phase 23 adds cumulative-by-period views and a forward projection (12/36/60 months) computed from DepreciationConfig (method, rates, residualValue, closingBookValue from latest entry). The engine is pure arithmetic — no DB writes needed.

3. **TCO Dashboard with Repair-vs-Replace Alert** — the operational cost data already aggregates acquisitionValue, accumulatedDepreciation, maintenanceCost, and fuelCost per asset (asset-operational-cost.service.ts). The "reparar vs substituir" alert triggers when `maintenanceCost / acquisitionValue >= 0.6`. A fleet view groups assets by assetType. Both views are new endpoints.

4. **Cost-Center Creation Wizard** — CCPA-04 is purely frontend: a multi-step modal (WorkOrderCloseWizard pattern, display:none/block) guiding the user through: asset type selection → template suggestion → form fill → confirmation. Templates are static JSON, no schema changes.

**Primary recommendation:** Build a new `asset-reports` backend module for patrimonial report + depreciation projection + TCO fleet. TCO per-asset reuses the existing endpoint. The cost-center wizard is frontend-only. All exports use pdfkit + ExcelJS (already installed).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEPR-04 | Contador pode gerar relatórios patrimoniais (inventário geral, depreciação acumulada, movimentação, TCO) com filtros e exportação PDF/Excel/CSV | New `asset-reports` module: `getInventoryReport`, `getDepreciationProjection`, `getTCOFleet` — all backed by existing DepreciationEntry, Asset, WorkOrder, FuelRecord tables |
| CCPA-04 | Sistema oferece guia de decisão (wizard) para orientar criação de centro de custo por tipo de ativo com exemplos e templates por tipo de fazenda | Frontend-only CostCenterWizardModal; static template data per AssetType; no backend changes |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdfkit | ^0.17.2 | PDF generation | Already installed, used in asset-export and pesticide-prescriptions |
| ExcelJS | ^4.4.0 | XLSX/CSV generation | Already installed, used in depreciation export and asset export |
| decimal.js | Already installed | Safe arithmetic for financial projections | Project convention — all depreciation math uses Decimal |
| Recharts | ^3.7.0 | Charts on frontend | Already installed; PatrimonyDashboardPage and others use it |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Intl.NumberFormat (built-in) | — | pt-BR currency formatting | All monetary display on frontend |
| date-fns or native Date | — | Month boundary calculation | Already used in financial-dashboard.service.ts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pdfkit (server) | puppeteer/html2pdf | Puppeteer overkill for tabular reports; pdfkit is already integrated |
| Static template JSON | DB-stored templates | DB overkill for CCPA-04; templates per AssetType are a fixed domain |

**No additional installations required.**

## Architecture Patterns

### Recommended Project Structure
```
apps/backend/src/modules/
└── asset-reports/                    # NEW module
    ├── asset-reports.routes.ts
    ├── asset-reports.routes.spec.ts
    ├── asset-reports.service.ts
    └── asset-reports.types.ts

apps/frontend/src/
├── pages/
│   └── AssetReportsPage.tsx          # NEW — tabs: Inventário / Depreciação / TCO
│   └── AssetReportsPage.css
├── components/
│   └── cost-centers/
│       └── CostCenterWizardModal.tsx # NEW — CCPA-04
│       └── CostCenterWizardModal.css
│   └── assets/
│       └── TCOFleetView.tsx          # NEW — fleet TCO table + alerts
│       └── TCOFleetView.css
│       └── DepreciationProjectionChart.tsx # NEW — LineChart projection
│       └── DepreciationProjectionChart.css
└── hooks/
    └── useAssetReports.ts            # NEW
    └── useTCOFleet.ts                # NEW
    └── useDepreciationProjection.ts  # NEW
```

### Pattern 1: Patrimonial Inventory Report (class-level aggregate)
**What:** Groups assets by AssetClassification, sums acquisitionValue (gross), accumulated depreciation from DepreciationEntry, computes net = gross - depr. Also shows movement in period (acquisitions in, disposals out).
**When to use:** DEPR-04 SC1
**Example:**
```typescript
// asset-reports.service.ts
export async function getInventoryReport(
  ctx: { organizationId: string },
  query: { farmId?: string; assetType?: string; dateFrom?: string; dateTo?: string }
) {
  // Group by classification using Prisma groupBy
  const byClass = await prisma.asset.groupBy({
    by: ['classification'],
    where: { organizationId: ctx.organizationId, deletedAt: null, status: { not: 'ALIENADO' } },
    _sum: { acquisitionValue: true },
    _count: true,
  });
  // Per classification, aggregate DepreciationEntry
  const deprByAsset = await prisma.depreciationEntry.groupBy({
    by: ['assetId'],
    where: { organizationId: ctx.organizationId, reversedAt: null },
    _sum: { depreciationAmount: true },
  });
  // Merge: for each asset, classify + depr sum → roll up to classification
  // Return rows: { classification, count, grossValue, accumulatedDepr, netBookValue }
}
```

### Pattern 2: Depreciation Projection
**What:** Pure arithmetic. For each asset with an active DepreciationConfig, use the last DepreciationEntry's closingBookValue as opening. Simulate N months forward using computeDepreciation from the existing engine. Sum totals per month to produce a monthly projection series.
**When to use:** DEPR-04 SC2
**Key insight:** The existing `computeDepreciation()` function in `depreciation-engine.service.ts` is a pure function — it can be called in a loop with no DB side effects.

```typescript
// Re-use existing engine
import { computeDepreciation } from '../depreciation/depreciation-engine.service';

export async function getDepreciationProjection(
  ctx: { organizationId: string },
  horizonMonths: 12 | 36 | 60,
) {
  // 1. Fetch all active assets with depreciationConfig + latest entry
  // 2. For each asset, simulate horizonMonths forward
  // 3. Aggregate monthly totals
  // Return: Array<{ year, month, projectedDepreciation, cumulativeDepreciation, remainingBookValue }>
}
```

### Pattern 3: TCO Fleet Dashboard with Repair-vs-Replace Alert
**What:** Extends the per-asset operational cost (already in `asset-operational-cost.service.ts`) to a fleet-level view grouped by assetType. The alert fires when `maintenanceCost / acquisitionValue >= threshold` (0.60 default, 0.70 aggressive).
**When to use:** DEPR-04 SC3

```typescript
export async function getTCOFleet(
  ctx: { organizationId: string },
  query: { farmId?: string; assetType?: string }
) {
  // Aggregate per asset: acquisitionValue, sum(depreciationAmount), sum(workOrder.totalCost), sum(fuelRecord.totalCost)
  // Compute per asset: repairRatio = maintenanceCost / acquisitionValue
  // Flag: repairRatio >= 0.6 → 'MONITOR', >= 0.7 → 'REPLACE'
  // Group by assetType for fleet summary
}
```

### Pattern 4: Cost-Center Wizard (frontend-only)
**What:** Multi-step modal. Step 1: select asset type (MAQUINA, VEICULO, IMPLEMENTO, BENFEITORIA, TERRA). Step 2: system shows a template with suggested CC code pattern and example names for the farm type (crop vs livestock). Step 3: form to fill actual code/name/description. Step 4: confirmation + API call to existing POST /cost-centers.
**When to use:** CCPA-04

```typescript
// Static template data (no DB)
const CC_TEMPLATES: Record<AssetType, { codePrefix: string; examples: string[] }> = {
  MAQUINA: { codePrefix: 'MAQ', examples: ['MAQ-TRATOR-01', 'MAQ-COLHEITADEIRA-01'] },
  VEICULO: { codePrefix: 'VEI', examples: ['VEI-CAMINHONETE-01'] },
  IMPLEMENTO: { codePrefix: 'IMP', examples: ['IMP-GRADE-01', 'IMP-PULVERIZADOR-01'] },
  BENFEITORIA: { codePrefix: 'BEN', examples: ['BEN-SILO-01', 'BEN-CURRAL-01'] },
  TERRA: { codePrefix: 'TER', examples: ['TER-TALHAO-SOJA-01'] },
};
```

The wizard uses the same display:none/block step transition pattern established in Phase 18 (WorkOrderCloseWizard).

### Anti-Patterns to Avoid
- **Building projection with DB writes:** Projection is a read-only simulation. Never write DepreciationEntry records for future periods.
- **Creating separate PDF library:** pdfkit is already installed and patterned. Do not add puppeteer or html2canvas.
- **Fetching all assets into memory for groupBy:** Use Prisma groupBy + aggregate at DB level, not in application code.
- **Importing computeDepreciation from batch service:** Use the pure engine from `depreciation-engine.service.ts`, not the batch orchestrator.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Custom HTML-to-PDF | pdfkit (already installed) | Already patterned in asset-export and pesticide-prescriptions |
| Excel export | Manual CSV strings | ExcelJS workbook API | Already patterned in depreciation.service.ts exportReport() |
| Depreciation arithmetic | Custom monthly loop | computeDepreciation() from depreciation-engine.service.ts | Pro-rata, residual clamping, multi-method already handled |
| Charts | Raw SVG | Recharts (already installed) | PatrimonyDashboardPage and FinancialDashboardPage use it |
| CC templates DB table | New Prisma model | Static constants in wizard component | Domain is fixed (5 AssetTypes) |

**Key insight:** This phase assembles existing building blocks into reports. The only "new logic" is the depreciation projection loop and the repair-vs-replace ratio. Everything else is wiring.

## Common Pitfalls

### Pitfall 1: groupBy + _sum does not work across relations in Prisma
**What goes wrong:** You cannot do `prisma.asset.groupBy({ by: ['classification'], _sum: { depreciationEntries: ... } })` — Prisma groupBy does not span relations.
**Why it happens:** Prisma groupBy only works on columns of the grouped model.
**How to avoid:** Two-query approach: (1) get assets with acquisitionValue grouped by classification; (2) separately aggregate DepreciationEntry, join in application code keyed by assetId, then roll up.

### Pitfall 2: Decimal serialization in JSON response
**What goes wrong:** Prisma Decimal fields returned as objects `{ d: [...], s: 1, e: 5 }` if not converted before JSON serialization.
**Why it happens:** Prisma returns Decimal instances, not numbers.
**How to avoid:** Convert with `Number(field.toString())` or `.toNumber()` before returning from service. Pattern already established in operational-cost.service.ts.

### Pitfall 3: Projection ignoring residual value floor
**What goes wrong:** Forward-simulated depreciation produces negative book values after residual value is reached.
**Why it happens:** computeDepreciation handles this correctly but only when residualValue is passed in. If DepreciationConfig.residualValue is null or zero-defaulted incorrectly, the floor is skipped.
**How to avoid:** Always pass `config.residualValue` from DepreciationConfig record; the engine clamps automatically via `max(residual, closingBookValue)`.

### Pitfall 4: TCO repair ratio division by zero
**What goes wrong:** Assets with null or zero acquisitionValue cause division-by-zero in `maintenanceCost / acquisitionValue`.
**Why it happens:** acquisitionValue is nullable in the Asset model.
**How to avoid:** Guard: if `acquisitionValue` is null or zero, set `repairRatio = null` and flag as `NO_DATA`.

### Pitfall 5: Cost-center wizard submitting to wrong endpoint
**What goes wrong:** Wizard calls a farm-scoped endpoint (`/farms/:farmId/cost-centers`) but the user hasn't selected a farm yet.
**Why it happens:** CostCenter is farm-scoped (farmId FK required). The wizard must collect farmId in step 1 or inherit from FarmContext.
**How to avoid:** Inject farmId from FarmContext (the same pattern used in assets module). If the org has multiple farms, add a farm selector as step 0.

## Code Examples

### Patrimonial Inventory Report — Two-query pattern
```typescript
// Source: pattern from financial-dashboard.service.ts getPatrimonyDashboard()
// Step 1: asset aggregates by classification
const assetsByClass = await prisma.asset.groupBy({
  by: ['classification'],
  where: { organizationId, deletedAt: null, status: { not: 'ALIENADO' } },
  _sum: { acquisitionValue: true },
  _count: true,
});

// Step 2: all depreciation entries for org
const allAssets = await prisma.asset.findMany({
  where: { organizationId, deletedAt: null },
  select: { id: true, classification: true },
});
const assetIdToClass = new Map(allAssets.map(a => [a.id, a.classification]));

const deprByAsset = await prisma.depreciationEntry.groupBy({
  by: ['assetId'],
  where: { organizationId, reversedAt: null },
  _sum: { depreciationAmount: true },
});

// Step 3: roll up depr to classification in memory
const deprByClass = new Map<string, Decimal>();
for (const row of deprByAsset) {
  const cls = assetIdToClass.get(row.assetId);
  if (!cls) continue;
  const prev = deprByClass.get(cls) ?? new Decimal(0);
  deprByClass.set(cls, prev.plus(new Decimal(String(row._sum.depreciationAmount ?? 0))));
}
```

### Depreciation Projection — Forward simulation loop
```typescript
// Source: depreciation-engine.service.ts computeDepreciation (pure function)
import { computeDepreciation, daysInMonth } from '../depreciation/depreciation-engine.service';

function projectAsset(asset: AssetWithConfig, horizonMonths: number): MonthlyProjection[] {
  let currentBookValue = new Decimal(String(asset.latestClosingBookValue ?? asset.acquisitionValue ?? 0));
  const result: MonthlyProjection[] = [];
  let { year, month } = nextPeriod(asset.lastEntryYear, asset.lastEntryMonth);

  for (let i = 0; i < horizonMonths; i++) {
    const output = computeDepreciation({
      acquisitionValue: new Decimal(String(asset.acquisitionValue ?? 0)),
      residualValue: new Decimal(String(asset.config.residualValue ?? 0)),
      openingBookValue: currentBookValue,
      config: asset.config,
      period: { year, month },
      acquisitionDate: asset.acquisitionDate!,
    });
    result.push({ year, month, amount: output.depreciationAmount, closingBookValue: output.closingBookValue });
    currentBookValue = output.closingBookValue;
    ({ year, month } = nextPeriod(year, month));
  }
  return result;
}
```

### pdfkit report — established pattern
```typescript
// Source: apps/backend/src/modules/assets/asset-export.service.ts exportAssetsPdf()
const PDFDocument = (await import('pdfkit')).default;
const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
const chunks: Buffer[] = [];
return new Promise((resolve, reject) => {
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);
  // ... render content
  doc.end();
});
```

### ExcelJS XLSX — established pattern
```typescript
// Source: apps/backend/src/modules/depreciation/depreciation.service.ts exportReport()
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Relatório Patrimonial');
sheet.columns = [
  { header: 'Classificação', key: 'classification', width: 25 },
  { header: 'Qtd Ativos', key: 'count', width: 12 },
  { header: 'Valor Bruto (R$)', key: 'grossValue', width: 20 },
  { header: 'Depr. Acumulada (R$)', key: 'accumulated', width: 20 },
  { header: 'Valor Líquido (R$)', key: 'netValue', width: 20 },
];
sheet.getRow(1).font = { bold: true };
const buffer = await workbook.xlsx.writeBuffer();
```

### TCO repair-vs-replace alert logic
```typescript
// Threshold: 60% = MONITOR, 70% = REPLACE
function repairAlert(maintenanceCost: Decimal, acquisitionValue: Decimal | null) {
  if (!acquisitionValue || acquisitionValue.isZero()) return 'NO_DATA';
  const ratio = maintenanceCost.div(acquisitionValue);
  if (ratio.gte(0.70)) return 'REPLACE';
  if (ratio.gte(0.60)) return 'MONITOR';
  return 'OK';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side PDF (html2canvas) | pdfkit server-side | Phase 17 (pesticide-prescriptions) | Consistent pattern for tabular financial reports |
| Single-period depreciation view | Cumulative + projection | Phase 23 (new) | Accountant-grade forecasting |

**Deprecated/outdated:**
- Nothing deprecated in this phase. PatrimonyDashboardPage already exists (Phase 20 / DISP-06); Phase 23 extends it, does not replace it.

## Open Questions

1. **CCPA-04 farm scope in wizard**
   - What we know: CostCenter has required farmId FK; FarmContext provides selected farm
   - What's unclear: If user has multiple farms, wizard should allow farm selection or use current FarmContext farm
   - Recommendation: Use FarmContext.selectedFarm (same pattern as assets module); if null, show farm selector as step 0

2. **Depreciation projection for HOURS_OF_USE / UNITS_OF_PRODUCTION methods**
   - What we know: computeDepreciation requires periodicHours/periodicUnits for these methods
   - What's unclear: No historical average hours/units are stored per asset — only current hourmeter
   - Recommendation: For projection, fall back to STRAIGHT_LINE equivalent using managerialAnnualRate when method requires usage data not available. Mark as `projectionMethod: 'ESTIMATED'` in response.

3. **AssetReportsPage navigation placement**
   - What we know: PatrimonyDashboardPage exists under `/patrimony-dashboard` route; DepreciationPage under `/depreciation`
   - What's unclear: Whether Phase 23 reports live as a new page or are tabs added to existing pages
   - Recommendation: New route `/asset-reports` with tabs (Inventário / Depreciação-Projeção / TCO) to keep the scope clear and not mutate existing pages.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (backend) + Vitest (frontend) |
| Config file | `apps/backend/jest.config.js`, `apps/frontend/vitest.config.ts` |
| Quick run command | `cd apps/backend && pnpm test -- --testPathPattern=asset-reports` |
| Full suite command | `cd apps/backend && pnpm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEPR-04 (inventory) | GET /asset-reports/inventory returns classification aggregates | unit (routes.spec) | `pnpm test -- --testPathPattern=asset-reports.routes` | ❌ Wave 0 |
| DEPR-04 (projection) | GET /asset-reports/depreciation-projection returns N months forward | unit (service.spec) | `pnpm test -- --testPathPattern=asset-reports.service` | ❌ Wave 0 |
| DEPR-04 (TCO fleet) | GET /asset-reports/tco-fleet returns repair alerts | unit (routes.spec) | `pnpm test -- --testPathPattern=asset-reports.routes` | ❌ Wave 0 |
| DEPR-04 (export) | GET /asset-reports/inventory/export returns PDF/XLSX/CSV buffer | unit (routes.spec) | `pnpm test -- --testPathPattern=asset-reports.routes` | ❌ Wave 0 |
| CCPA-04 | Wizard renders steps, submits to existing cost-centers endpoint | unit (CostCenterWizardModal.spec) | `cd apps/frontend && pnpm test CostCenterWizardModal` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/backend && pnpm test -- --testPathPattern=asset-reports`
- **Per wave merge:** `cd apps/backend && pnpm test && cd ../frontend && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/backend/src/modules/asset-reports/asset-reports.routes.spec.ts` — covers DEPR-04 route-level tests
- [ ] `apps/backend/src/modules/asset-reports/asset-reports.service.ts` — projection + TCO + inventory logic
- [ ] `apps/frontend/src/components/cost-centers/CostCenterWizardModal.spec.tsx` — covers CCPA-04 wizard steps

*(Existing test infrastructure covers the rest — no framework installation needed)*

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `apps/backend/src/modules/depreciation/` — confirmed depreciation types, engine, service patterns
- Codebase inspection: `apps/backend/src/modules/assets/asset-export.service.ts` — pdfkit + ExcelJS patterns
- Codebase inspection: `apps/backend/src/modules/assets/asset-operational-cost.service.ts` — TCO aggregation logic
- Codebase inspection: `apps/backend/src/modules/financial-dashboard/financial-dashboard.service.ts` — patrimony dashboard two-query pattern
- Codebase inspection: `apps/backend/prisma/schema.prisma` — Asset, DepreciationEntry, DepreciationConfig, WorkOrder, FuelRecord models
- Codebase inspection: `apps/frontend/src/pages/PatrimonyDashboardPage.tsx` — recharts usage, CSS conventions

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — DEPR-04 and CCPA-04 full descriptions
- `.planning/ROADMAP.md` — Phase 23 success criteria (4 items)
- `.planning/STATE.md` — Phase 22 decisions (WorkOrderCloseWizard display:none/block pattern for wizard)

### Tertiary (LOW confidence)
- None — all claims verified directly from codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use
- Architecture: HIGH — patterns lifted directly from existing modules
- Pitfalls: HIGH — discovered via schema inspection and service code reading
- Projection math: MEDIUM — relies on computeDepreciation being reusable pure function; HOURS_OF_USE fallback is a recommendation, not a verified business rule

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable domain — no external library changes expected)
