# Phase 21: Controle Operacional - Research

**Researched:** 2026-03-22
**Domain:** Asset operational control — fuel records, document expiry, meter readings, operational cost (TCO) aggregation
**Confidence:** HIGH

---

## Summary

Phase 21 implements the operational layer of asset management: fuel consumption with fleet benchmarking (OPER-01), document expiry control with calendar view (OPER-02), mobile hourmeter/odometer updates with anti-regression (OPER-03), and a composite operational cost endpoint per asset (OPER-04).

**Critical discovery:** The backend modules for all four requirements are already fully implemented and registered in app.ts. The database schema has `FuelRecord`, `MeterReading`, `AssetDocument` models in place. The frontend `AssetDrawer` already has tabs for `combustivel`, `leituras`, and `documentos` (with working tab components `AssetFuelTab`, `AssetReadingsTab`, `AssetDocumentsTab`). The hooks `useFuelRecords`, `useMeterReadings`, and `useAssetDocuments` exist and are wired.

**What is genuinely missing:** (1) A document expiry calendar view / dedicated alerts page surfaced outside the drawer; (2) A mobile screen for meter reading submission (OPER-03 explicitly calls out mobile); (3) A backend endpoint aggregating all cost components into a single operational cost response (OPER-04 — no such endpoint exists); (4) A frontend `AssetCostTab` component inside the drawer (or linked view) rendering the TCO breakdown; (5) Tests for the spec suite (meter-readings spec exists, fuel-records spec exists, documents spec exists — verifying they cover all paths is Wave 0 work).

**Primary recommendation:** Plan Phase 21 as three backend additions + three frontend/mobile additions, all narrow in scope because the data layer is already in place.

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                        | Research Support                                                                                                                                                                                                                                                                                                                                                                                             |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OPER-01 | Gerente pode registrar abastecimentos por ativo com custo/litro, custo/hora e benchmarking de eficiência contra média da frota                     | Backend: `fuel-records` module fully implemented. Frontend: `AssetFuelTab` + `useFuelRecords` exist. Benchmarking (assetCostPerHour vs fleetCostPerHour) computed in `getFuelStats`. All wired.                                                                                                                                                                                                              |
| OPER-02 | Gerente pode controlar documentos com vencimento (CRLV, seguro, revisão) com alertas automáticos antecipados e calendário de vencimentos           | Backend: `asset-documents` module with `getExpiringDocuments` (categories: expired/urgent/warning/upcoming) fully implemented. Frontend: `AssetDocumentsTab` exists. Missing: standalone alerts page / expiry calendar view surfaced on AssetsPage.                                                                                                                                                          |
| OPER-03 | Operador pode atualizar horímetro/odômetro de forma rápida pelo mobile com validação anti-regressão                                                | Backend: `meter-readings` module with `createMeterReading` (anti-regression enforced at DB level via prisma.$transaction) fully implemented. Frontend web: `AssetReadingsTab` + `useMeterReadings` exist. Missing: dedicated mobile screen at `app/(app)/meter-reading.tsx`.                                                                                                                                 |
| OPER-04 | Sistema calcula custo/hora e custo operacional por ativo (aquisição + depreciação + manutenção + combustível + seguro) para análise de viabilidade | Backend: no aggregation endpoint exists. Data sources exist: `acquisitionValue` on Asset, accumulated depreciation via `DepreciationEntry` aggregate, maintenance cost via `WorkOrder.totalCost` aggregate, fuel cost via `FuelRecord.totalCost` aggregate, insurance cost via `AssetDocument` (SEGURO type, no premium field — must be sourced differently or omitted). Frontend: no `AssetCostTab` exists. |

</phase_requirements>

---

## Standard Stack

### Core

| Library                  | Version          | Purpose                    | Why Standard                                                                                    |
| ------------------------ | ---------------- | -------------------------- | ----------------------------------------------------------------------------------------------- |
| Express 5 + TypeScript   | project-standard | Backend API                | Consistent with all modules                                                                     |
| Prisma 7                 | project-standard | DB access                  | All existing modules use prisma.$transaction directly (NOT withRlsContext) for asset operations |
| decimal.js               | project-standard | Monetary arithmetic        | Required for all cost calculations — see DEPR decisions                                         |
| React 19 + Vite          | project-standard | Frontend                   | Consistent with entire frontend                                                                 |
| lucide-react             | project-standard | Icons                      | Mandated by CLAUDE.md                                                                           |
| Expo Router (file-based) | project-standard | Mobile routing             | Existing pattern in `app/(app)/`                                                                |
| expo-haptics             | installed        | Tactile feedback on submit | Used in register.tsx                                                                            |

### Supporting

| Library           | Version          | Purpose              | When to Use                                         |
| ----------------- | ---------------- | -------------------- | --------------------------------------------------- |
| recharts          | installed        | Cost breakdown chart | Used in PatrimonyDashboardPage for financial charts |
| @dnd-kit          | installed        | —                    | Not needed for this phase                           |
| jest (backend)    | project-standard | Backend specs        | All `*.routes.spec.ts` pattern                      |
| vitest (frontend) | project-standard | Frontend specs       | All `*.spec.tsx` pattern                            |

### Alternatives Considered

| Instead of                                      | Could Use                                            | Tradeoff                                                                                                                                                                                                                                              |
| ----------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aggregation in new `/operational-cost` endpoint | Aggregate on client                                  | Client aggregation unreliable across paginated datasets; server aggregation is the correct pattern in this project                                                                                                                                    |
| New `AssetInsurancePremium` model               | Source insurance from `AssetDocument` + manual input | No insurance premium field on Asset or AssetDocument; OPER-04 spec says "seguro" but no data model exists — new endpoint can accept a period filter and derive from existing fuel/maintenance/depreciation data, noting insurance as zero/unavailable |

**Installation:** No new packages needed — all dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
apps/backend/src/modules/
  assets/
    asset-operational-cost.service.ts   # NEW — OPER-04 aggregation
    asset-operational-cost.routes.ts    # NEW — GET /org/:orgId/assets/:id/operational-cost
    asset-operational-cost.routes.spec.ts  # NEW
  # fuel-records/, meter-readings/, asset-documents/ already exist

apps/frontend/src/
  components/assets/
    AssetCostTab.tsx                    # NEW — OPER-04 UI
    AssetCostTab.css                    # NEW
    AssetDocumentAlertsView.tsx         # NEW — OPER-02 standalone alerts
    AssetDocumentAlertsView.css         # NEW (or inline in AssetsPage)
  hooks/
    useAssetOperationalCost.ts          # NEW — OPER-04 hook
  # AssetFuelTab, AssetReadingsTab, AssetDocumentsTab, useFuelRecords,
  # useMeterReadings, useAssetDocuments already exist

apps/mobile/app/(app)/
  meter-reading.tsx                     # NEW — OPER-03 dedicated mobile screen
```

### Pattern 1: New Operational Cost Endpoint (OPER-04)

**What:** GET `/org/:orgId/assets/:id/operational-cost` aggregates acquisition value, accumulated depreciation, total maintenance cost from closed work orders, total fuel cost from fuel records, and returns costPerHour if hourmeter readings exist.
**When to use:** AssetDrawer "Custo" tab, and future ATIV-07 asset detail card.
**Example:**

```typescript
// Source: pattern derived from existing fuel-records.service.ts + work-orders.service.ts
export async function getOperationalCost(
  ctx: RlsContext,
  assetId: string,
  periodStart?: string,
  periodEnd?: string,
) {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, organizationId: ctx.organizationId, deletedAt: null },
    select: { acquisitionValue: true, currentHourmeter: true, assetType: true },
  });
  if (!asset) throw new AssetError('Ativo não encontrado', 404);

  const dateFilter = buildDateFilter(periodStart, periodEnd);

  // Accumulated depreciation (all time — not filtered by period as it's cumulative)
  const deprAgg = await prisma.depreciationEntry.aggregate({
    where: { assetId, organizationId: ctx.organizationId, reversedAt: null },
    _sum: { depreciationAmount: true },
  });

  // Maintenance cost from closed work orders
  const woWhere: Record<string, unknown> = {
    assetId,
    organizationId: ctx.organizationId,
    status: 'CONCLUIDA',
  };
  if (dateFilter) woWhere['completedAt'] = dateFilter;
  const woAgg = await prisma.workOrder.aggregate({
    where: woWhere as never,
    _sum: { totalCost: true },
  });

  // Fuel cost
  const fuelWhere: Record<string, unknown> = { assetId, organizationId: ctx.organizationId };
  if (dateFilter) fuelWhere['fuelDate'] = dateFilter;
  const fuelAgg = await prisma.fuelRecord.aggregate({
    where: fuelWhere as never,
    _sum: { totalCost: true },
    _count: { id: true },
  });

  const acquisitionValue = new Decimal(String(asset.acquisitionValue ?? 0));
  const depreciationTotal = new Decimal(String(deprAgg._sum.depreciationAmount ?? 0));
  const maintenanceTotal = new Decimal(String(woAgg._sum.totalCost ?? 0));
  const fuelTotal = new Decimal(String(fuelAgg._sum.totalCost ?? 0));

  const totalOperationalCost = maintenanceTotal.plus(fuelTotal);
  const totalLifetimeCost = acquisitionValue.plus(maintenanceTotal).plus(fuelTotal);

  // costPerHour: totalLifetimeCost / currentHourmeter
  let costPerHour: number | null = null;
  if (asset.currentHourmeter != null) {
    const hours = new Decimal(String(asset.currentHourmeter));
    if (hours.gt(0)) {
      costPerHour = totalLifetimeCost.div(hours).toDecimalPlaces(2).toNumber();
    }
  }

  return {
    acquisitionValue: acquisitionValue.toNumber(),
    accumulatedDepreciation: depreciationTotal.toNumber(),
    maintenanceCost: maintenanceTotal.toNumber(),
    fuelCost: fuelTotal.toNumber(),
    insuranceCost: null, // no model for insurance premium yet
    totalOperationalCost: totalOperationalCost.toNumber(),
    totalLifetimeCost: totalLifetimeCost.toNumber(),
    costPerHour,
    currentHourmeter: asset.currentHourmeter ? Number(asset.currentHourmeter) : null,
    fuelRecordCount: fuelAgg._count.id,
  };
}
```

### Pattern 2: Mobile Meter Reading Screen (OPER-03)

**What:** `app/(app)/meter-reading.tsx` — a focused screen with asset picker (or pre-selected via router params), reading type selector (HOURMETER/ODOMETER), date input, value input with anti-regression inline error, and submit.
**When to use:** Operator taps "Atualizar horimetro" from any mobile asset-related context.
**Example:**

```typescript
// Source: pattern from apps/mobile/app/(app)/maintenance-request.tsx
// Key pattern: expo-haptics on success, KeyboardAvoidingView, SafeAreaView, api.post()
// Route: exposed in (tabs)/register.tsx or (tabs)/more.tsx quick actions
```

### Pattern 3: Document Expiry Alerts View (OPER-02)

**What:** A dedicated alert panel surfaced on `AssetsPage` (above or beside the asset list) calling `GET /org/:orgId/asset-documents/expiring` and rendering 4 buckets (expired, urgent ≤7d, warning ≤15d, upcoming ≤30d) with counts and clickable rows that open the relevant AssetDrawer.
**When to use:** Manager lands on AssetsPage and needs a quick view of all document alerts across all assets.
**Example:**

```typescript
// GET /api/org/:orgId/asset-documents/expiring
// Returns: { expired: { count, items[] }, urgent: { count, items[] },
//            warning: { count, items[] }, upcoming: { count, items[] } }
// Source: asset-documents.service.ts getExpiringDocuments()
```

### Pattern 4: AssetDrawer Tab Addition (OPER-04)

**What:** Add a `'custo'` tab to `AssetDrawer.tsx`'s `TABS` array, rendering `AssetCostTab` component that calls the new operational cost endpoint.
**When to use:** Manager clicks "Custo" tab inside any asset drawer.

### Anti-Patterns to Avoid

- **withRlsContext in asset transactions:** The established decision is `prisma.$transaction` directly (NOT `withRlsContext`) for asset module operations. See Phase 20 decision log. Wrapping in `withRlsContext` causes nested deadlocks.
- **Floating point for cost arithmetic:** Always use `new Decimal(String(value))` — never native JS `+` or `*` on cost numbers.
- **Insurance premium assumed from AssetDocument:** No `premium` or `annualCost` field exists on `AssetDocument`. OPER-04 returns `insuranceCost: null` and notes it requires a model addition (deferred to a future phase or Sprint).
- **Mobile screen without KeyboardAvoidingView:** All mobile form screens use `KeyboardAvoidingView` + `Platform.OS === 'ios'` behavior. See `maintenance-request.tsx`.
- **Anti-regression bypass:** The anti-regression check in `createMeterReading` runs inside the transaction. Never re-implement on client side only — the server is the source of truth.

---

## Don't Hand-Roll

| Problem                      | Don't Build       | Use Instead                               | Why                                                                         |
| ---------------------------- | ----------------- | ----------------------------------------- | --------------------------------------------------------------------------- |
| Decimal arithmetic for costs | Custom rounding   | `decimal.js` Decimal                      | Established project requirement; matches all existing Phase 17-20 patterns  |
| Fleet benchmark calculation  | Custom avg query  | Existing `getFuelStats`                   | Already implemented with correct aggregate logic                            |
| Document expiry bucketing    | Custom date logic | Existing `getExpiringDocuments`           | Returns expired/urgent/warning/upcoming buckets with correct day thresholds |
| Anti-regression validation   | Client-side check | Server-side in `createMeterReading`       | Server enforces via latest reading lookup inside transaction                |
| Pagination                   | Custom offset     | Existing `page`/`limit` pattern (max 100) | All list endpoints use the same pattern                                     |

**Key insight:** 80% of the backend logic for this phase already exists. The phase is primarily frontend assembly and one new aggregation endpoint.

---

## Common Pitfalls

### Pitfall 1: Work Orders `totalCost` field is nullable

**What goes wrong:** `WorkOrder.totalCost` is nullable (`Decimal? @db.Decimal(15,2)`). Aggregating with `_sum` returns `null` when no records match.
**Why it happens:** Work orders can be closed without parts (labor-only) or may not have a total cost yet.
**How to avoid:** Always guard with `?? 0` when converting to Decimal: `new Decimal(String(woAgg._sum.totalCost ?? 0))`.
**Warning signs:** TypeScript error `Type 'Decimal | null' is not assignable to type 'string'`.

### Pitfall 2: Route ordering — `/stats/:assetId` before `/:id`

**What goes wrong:** If a `/stats/x` route is registered AFTER a `/:id` route, Express captures `stats` as `:id`.
**Why it happens:** Express routes match first-defined first.
**How to avoid:** The existing `fuel-records.routes.ts` already has the correct ordering pattern (stats before /:id). Follow same ordering in the new operational-cost route: `/operational-cost` should be a named segment, not a param — no conflict risk in this case.
**Warning signs:** `stats/asset-1` returns 404 or wrong handler.

### Pitfall 3: `prisma.$transaction` used directly — not `withRlsContext`

**What goes wrong:** Using `withRlsContext` inside `prisma.$transaction` causes a nested transaction deadlock.
**Why it happens:** `withRlsContext` opens its own transaction for RLS setup; nesting is not supported by PostgreSQL advisory locks in this setup.
**How to avoid:** The locked Phase 20 decision is explicit: asset module services use `prisma.$transaction` directly. The operational cost endpoint is read-only (no transaction needed), but any future write in this module should follow the same pattern.

### Pitfall 4: Mobile screen not connected to tab navigation

**What goes wrong:** New `meter-reading.tsx` route is created but not accessible from any navigation entry.
**Why it happens:** Expo Router uses file-based routing but tab/quick-action entries in `(tabs)/register.tsx` or `(tabs)/more.tsx` need manual wiring.
**How to avoid:** Add the "Atualizar Horímetro" quick action to `(tabs)/register.tsx` (the existing register screen has a quick-action list) or `more.tsx`.

### Pitfall 5: `AssetDrawer` tab list hard-coded, not driven by asset type

**What goes wrong:** Adding a "Custo" tab to all asset types including BENFEITORIA and TERRA (which don't have hourmeter/fuel data).
**Why it happens:** The TABS array in `AssetDrawer.tsx` applies to all asset types.
**How to avoid:** Follow the same pattern as `AssetFuelTab`/`AssetReadingsTab` which already conditionally render fields based on `assetType` prop. The Custo tab can show all assets (cost per hour will be `null` for non-machinery) or be filtered to MAQUINA/VEICULO/IMPLEMENTO.

---

## Code Examples

### Existing — Fuel Stats Aggregation

```typescript
// Source: apps/backend/src/modules/fuel-records/fuel-records.service.ts
// getFuelStats() — aggregate pattern: _sum, _min, _max, fleet comparison by assetType
// Decimal arithmetic: new Decimal(String(maxH)).minus(new Decimal(String(minH)))
```

### Existing — Anti-Regression in Transaction

```typescript
// Source: apps/backend/src/modules/meter-readings/meter-readings.service.ts
// createMeterReading() — prisma.$transaction, findFirst latest, newValue.lte(lastValue) check
// Updates Asset.currentHourmeter snapshot atomically in same transaction
```

### Existing — Expiry Bucketing

```typescript
// Source: apps/backend/src/modules/assets/asset-documents.service.ts
// getExpiringDocuments() — now + 7/15/30 days, buckets: expired/urgent/warning/upcoming
// Returns { expired: { count, items }, urgent: ..., warning: ..., upcoming: ... }
```

### Existing — Route Pattern for Asset Modules

```typescript
// Source: apps/backend/src/modules/fuel-records/fuel-records.routes.ts
// Permission: assets:read (GET), assets:create (POST), assets:delete (DELETE)
// Context builder: req.user?.organizationId + req.user?.userId
// Error handler: instanceof FuelRecordError → statusCode, else 400
```

### Existing — Mobile Form Screen Pattern

```typescript
// Source: apps/mobile/app/(app)/maintenance-request.tsx
// KeyboardAvoidingView, SafeAreaView, expo-haptics (success/error),
// api.post(), offline queue integration (createOfflineQueue)
```

---

## State of the Art

| Old Approach                        | Current Approach                                                         | When Changed      | Impact                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------ | ----------------- | --------------------------------------------------------------------------------- |
| Separate insurance premium tracking | Insurance cost is null/unavailable in OPER-04                            | Phase 21 decision | OPER-04 spec says "seguro" but no data model exists; return null and document gap |
| Work order cost stored manually     | Work orders compute totalCost on part addition                           | Phase 18          | Aggregation for OPER-04 can sum `WorkOrder._sum.totalCost` directly               |
| currentHourmeter as snapshot        | currentHourmeter updated atomically in MeterReading creation transaction | Phase 16          | Safe to read from Asset.currentHourmeter for cost-per-hour denominator            |

**Deprecated/outdated:**

- None for this phase — all patterns are current as of Phase 20.

---

## Open Questions

1. **Insurance cost source for OPER-04**
   - What we know: `AssetDocument` has type `SEGURO` but no `premium` / `annualCost` field. No insurance premium field on `Asset`.
   - What's unclear: Should Phase 21 add a `insurancePremium` field to `Asset` or defer this component?
   - Recommendation: Return `insuranceCost: null` with a `notes: "Custo de seguro não disponível"` in the response for now. The planner should note this as a known gap in OPER-04 — the UI can display "N/D" for insurance. Adding the field is a low-risk schema addition but increases scope.

2. **Scope of document calendar for OPER-02**
   - What we know: The requirement mentions "calendário de vencimentos" — this could mean a full calendar grid (complex) or a sorted list view grouped by urgency buckets.
   - What's unclear: Whether a calendar grid UI is expected or a list with urgency badges is sufficient.
   - Recommendation: Implement as urgency-bucket list view (matching `getExpiringDocuments` response shape). A full calendar grid (`react-calendar` etc.) is out of scope and would require new library installation.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                            |
| ------------------ | ---------------------------------------------------------------- | -------------- | --------------- | ------------------------------------ |
| Framework          | Jest 29 (backend), Vitest (frontend)                             |
| Config file        | `apps/backend/jest.config.js`                                    |
| Quick run command  | `cd apps/backend && pnpm test -- --testPathPattern="fuel-records | meter-readings | asset-documents | operational-cost" --passWithNoTests` |
| Full suite command | `cd apps/backend && pnpm test`                                   |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                            | Test Type         | Automated Command                                   | File Exists?                        |
| ------- | ----------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------- | ----------------------------------- |
| OPER-01 | Fuel record creation + stats (fleet benchmark)                                      | unit (route mock) | `pnpm test -- --testPathPattern="fuel-records"`     | ✅ `fuel-records.routes.spec.ts`    |
| OPER-02 | Document CRUD + expiry bucketing                                                    | unit (route mock) | `pnpm test -- --testPathPattern="asset-documents"`  | ✅ `asset-documents.routes.spec.ts` |
| OPER-03 | Meter reading anti-regression validation                                            | unit (route mock) | `pnpm test -- --testPathPattern="meter-readings"`   | ✅ `meter-readings.routes.spec.ts`  |
| OPER-04 | Operational cost aggregation (acquisitionValue + depreciation + maintenance + fuel) | unit (route mock) | `pnpm test -- --testPathPattern="operational-cost"` | ❌ Wave 0                           |

### Sampling Rate

- **Per task commit:** `cd apps/backend && pnpm test -- --testPathPattern="fuel-records|meter-readings|asset-documents|operational-cost" --passWithNoTests`
- **Per wave merge:** `cd apps/backend && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/assets/asset-operational-cost.routes.spec.ts` — covers OPER-04 aggregation, null insurance, costPerHour calculation
- [ ] `apps/frontend/src/hooks/useAssetOperationalCost.ts` — test optional (no spec convention for hooks yet, covered by component tests)

_(All OPER-01, OPER-02, OPER-03 test files exist. Only OPER-04 spec is missing.)_

---

## Sources

### Primary (HIGH confidence)

- `apps/backend/src/modules/fuel-records/` — complete implementation verified by reading source
- `apps/backend/src/modules/meter-readings/` — complete implementation with anti-regression verified
- `apps/backend/src/modules/assets/asset-documents.service.ts` — complete expiry bucketing verified
- `apps/backend/prisma/schema.prisma` — `FuelRecord`, `MeterReading`, `AssetDocument`, `DepreciationEntry`, `WorkOrder` models verified
- `apps/frontend/src/components/assets/AssetDrawer.tsx` — confirmed existing tabs: geral, documentos, combustivel, leituras, manutencao, depreciacao, timeline
- `apps/frontend/src/components/assets/AssetFuelTab.tsx` — complete OPER-01 frontend verified
- `apps/frontend/src/components/assets/AssetReadingsTab.tsx` — complete OPER-03 web frontend verified
- `apps/frontend/src/components/assets/AssetDocumentsTab.tsx` — complete OPER-02 drawer tab verified
- `.planning/STATE.md` Accumulated Decisions — `prisma.$transaction` directly for asset modules

### Secondary (MEDIUM confidence)

- `apps/mobile/app/(app)/maintenance-request.tsx` — mobile form screen pattern (confirmed by reading)
- `apps/backend/src/modules/work-orders/work-orders.service.ts` — `totalCost` field confirmed nullable

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries confirmed in package.json and source files
- Architecture: HIGH — all existing module patterns verified by reading source
- Pitfalls: HIGH — all pitfalls derived from reading actual code and existing decisions
- OPER-04 endpoint design: MEDIUM — no existing example of multi-source aggregation in asset modules; pattern extrapolated from fuel-records + depreciation service patterns

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable domain)
