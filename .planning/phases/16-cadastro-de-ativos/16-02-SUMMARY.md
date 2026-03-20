---
phase: 16-cadastro-de-ativos
plan: '02'
subsystem: backend-assets-operational
tags:
  - fuel-records
  - meter-readings
  - asset-documents
  - csv-export
  - pdf-export
  - decimal-arithmetic
dependency_graph:
  requires:
    - 16-01 (Asset entity, Prisma schema with FuelRecord/MeterReading/AssetDocument models)
  provides:
    - Fuel record CRUD with fleet benchmarking
    - Meter reading CRUD with anti-regression validation and Asset snapshot update
    - Asset document CRUD with 4-group expiry tracking
    - CSV export via ExcelJS
    - PDF export via pdfkit
  affects:
    - 16-03 (frontend can now call /fuel-records, /meter-readings, /asset-documents, /export endpoints)
tech_stack:
  added: []
  patterns:
    - Decimal arithmetic (decimal.js) for liters * pricePerLiter totalCost calculation
    - Prisma $transaction for anti-regression check + create + asset snapshot update
    - ExcelJS .csv.writeBuffer() for CSV inventory export
    - pdfkit landscape A4 with dynamic row pagination for PDF export
    - 4-group urgency classification (expired/urgent/warning/upcoming) for document expiry
key_files:
  created:
    - apps/backend/src/modules/fuel-records/fuel-records.types.ts
    - apps/backend/src/modules/fuel-records/fuel-records.service.ts
    - apps/backend/src/modules/fuel-records/fuel-records.routes.ts
    - apps/backend/src/modules/meter-readings/meter-readings.types.ts
    - apps/backend/src/modules/meter-readings/meter-readings.service.ts
    - apps/backend/src/modules/meter-readings/meter-readings.routes.ts
    - apps/backend/src/modules/assets/asset-documents.service.ts
    - apps/backend/src/modules/assets/asset-documents.routes.ts
    - apps/backend/src/modules/assets/asset-export.service.ts
  modified:
    - apps/backend/src/modules/fuel-records/fuel-records.routes.spec.ts (Wave 0 stubs replaced)
    - apps/backend/src/modules/meter-readings/meter-readings.routes.spec.ts (Wave 0 stubs replaced)
    - apps/backend/src/modules/assets/asset-documents.routes.spec.ts (Wave 0 stubs replaced)
    - apps/backend/src/modules/assets/assets.routes.ts (export endpoints added)
    - apps/backend/src/app.ts (3 new routers registered)
decisions:
  - 'getFuelStats uses aggregate min/max hourmeterAtFuel to compute hours diff — null means no hourmeter records, avgLitersPerHour returns null'
  - 'OPERATOR role has assets:read + assets:update permissions — meter readings POST uses assets:update so operators can update readings from field'
  - 'MeterReading anti-regression error message in PT with unit suffix (h or km) — matches plan spec'
  - 'exportAssetsPdf uses landscape A4 layout with dynamic page-break check per row'
metrics:
  duration: 15min
  completed: '2026-03-19'
  tasks: 2
  files: 15
---

# Phase 16 Plan 02: Asset Operational Modules + Export Summary

Fuel records with fleet benchmarking, meter readings with Prisma-transaction anti-regression validation, asset document management with 4-group expiry tracking, and CSV/PDF inventory export — all with integration tests replacing Wave 0 stubs.

## What Was Built

### Task 1: Fuel Records + Meter Readings Modules

**Fuel Records** (`apps/backend/src/modules/fuel-records/`):

- `FuelRecordError` class with statusCode
- `CreateFuelRecordInput`: assetId, farmId, fuelDate, liters, pricePerLiter (required); hourmeterAtFuel, odometerAtFuel, notes (optional)
- `createFuelRecord`: totalCost = liters \* pricePerLiter via decimal.js Decimal
- `listFuelRecords`: paginated, filtered by assetId/farmId/dateRange, sorted by fuelDate desc
- `getFuelStats`: asset-level + fleet-level aggregates (avgLitersPerHour, avgCostPerHour via hourmeter diff)
- `deleteFuelRecord`: hard delete
- Routes at `/org/:orgId/fuel-records`: POST, GET, GET /stats/:assetId, DELETE /:id

**Meter Readings** (`apps/backend/src/modules/meter-readings/`):

- `MeterReadingError` class
- `CreateMeterReadingInput`: assetId, readingDate, readingType (HOURMETER|ODOMETER), value (all required)
- `createMeterReading`: Prisma `$transaction` with anti-regression check, previousValue stored, Asset.currentHourmeter/currentOdometer snapshot updated
- `listMeterReadings`: paginated, filtered by assetId/readingType
- `getLatestReadings`: returns `{ hourmeter, odometer }` latest readings (null if none)
- Routes at `/org/:orgId/meter-readings`: POST (assets:update), GET, GET /latest/:assetId

**Tests**: 17 tests (fuel-records: 7, meter-readings: 10) — all passing

### Task 2: Asset Documents + CSV/PDF Export

**Asset Documents** (`asset-documents.service.ts`, `asset-documents.routes.ts`):

- `createAssetDocument`: 8 document types (CRLV, SEGURO, REVISAO, CCIR, ITR, LAUDO, GARANTIA, OUTRO)
- `listAssetDocuments`: paginated, filtered by assetId, optional `expiringWithinDays` window
- `getExpiringDocuments`: queries expiresAt <= now+30d, returns 4 urgency groups:
  - `expired`: expiresAt < now (daysUntilExpiry is negative)
  - `urgent`: within 7 days
  - `warning`: within 15 days
  - `upcoming`: within 30 days
- `updateAssetDocument` / `deleteAssetDocument`
- Routes at `/org/:orgId/asset-documents`: POST, GET, GET /expiring, PATCH /:id, DELETE /:id

**Export Service** (`asset-export.service.ts`):

- `exportAssetsCsv`: ExcelJS 11-column sheet (Tag, Nome, Tipo, Classificação CPC, Fazenda, Status, Valor Aquisição, Data Aquisição, Fabricante, Modelo, Centro de Custo) → Buffer
- `exportAssetsPdf`: pdfkit landscape A4, header with date, table with 6 columns, footer with total count + total value, dynamic page-break
- Routes added to `assets.routes.ts`: GET `/export/csv`, GET `/export/pdf` (before /:id pattern)

**Tests**: 11 tests in asset-documents.routes.spec.ts — all passing

## Test Results

```
Test Suites: 4 passed
Tests:       50 passed, 2 todo (pre-existing)
TypeScript:  clean (tsc --noEmit)
```

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- apps/backend/src/modules/fuel-records/fuel-records.service.ts: FOUND
- apps/backend/src/modules/meter-readings/meter-readings.service.ts: FOUND
- apps/backend/src/modules/assets/asset-documents.service.ts: FOUND
- apps/backend/src/modules/assets/asset-export.service.ts: FOUND

## Self-Check: PASSED
