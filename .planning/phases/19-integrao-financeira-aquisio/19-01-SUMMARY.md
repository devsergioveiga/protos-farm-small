---
phase: 19-integrao-financeira-aquisio
plan: "01"
subsystem: asset-acquisitions
tags: [backend, assets, payables, nfe-parser, prisma, tdd]
dependency_graph:
  requires:
    - apps/backend/src/modules/assets/assets.service.ts
    - apps/backend/src/modules/payables/payables.types.ts
    - packages/shared/src/utils/installments.ts
  provides:
    - apps/backend/src/modules/asset-acquisitions/asset-acquisitions.service.ts
    - apps/backend/src/modules/asset-acquisitions/asset-acquisitions.routes.ts
    - apps/backend/src/modules/asset-acquisitions/nfe-parser.ts
    - apps/backend/src/modules/asset-acquisitions/asset-acquisitions.types.ts
  affects:
    - apps/backend/src/app.ts
    - apps/backend/src/modules/payables/payables.types.ts
    - apps/backend/src/modules/cashflow/cashflow.types.ts
    - apps/backend/prisma/schema.prisma
tech_stack:
  added:
    - "@xmldom/xmldom (already installed) — NF-e v4.0 XML parsing"
    - "decimal.js (already installed) — cent-exact rateio arithmetic"
  patterns:
    - "Prisma $transaction for atomic asset+payable creation"
    - "tx.payable.create direct (NOT payables.service) to avoid nested RLS deadlocks"
    - "generateInstallments from @protos-farm/shared for AVISTA/FINANCIADO"
    - "multer memoryStorage for NF-e XML upload"
key_files:
  created:
    - apps/backend/prisma/migrations/20260426100000_add_payable_category_asset_acquisition/migration.sql
    - apps/backend/src/modules/asset-acquisitions/asset-acquisitions.types.ts
    - apps/backend/src/modules/asset-acquisitions/nfe-parser.ts
    - apps/backend/src/modules/asset-acquisitions/nfe-parser.spec.ts
    - apps/backend/src/modules/asset-acquisitions/asset-acquisitions.service.ts
    - apps/backend/src/modules/asset-acquisitions/asset-acquisitions.routes.ts
    - apps/backend/src/modules/asset-acquisitions/asset-acquisitions.routes.spec.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/modules/payables/payables.types.ts
    - apps/backend/src/modules/cashflow/cashflow.types.ts
    - apps/backend/src/app.ts
decisions:
  - "tx.payable.create used directly in transactions (NOT payables.service.createPayable) to avoid nested withRlsContext deadlocks — same pattern as rural-credit.service"
  - "ASSET_ACQUISITION maps to DFC INVESTIMENTO (not OPERACIONAL) for correct cash flow statement classification"
  - "Cent residual in rateio assigned to first item (consistent with generateInstallments behavior)"
  - "multer memoryStorage for NF-e XML (max 2MB) — no disk persistence needed"
metrics:
  duration: "334s"
  completed_date: "2026-03-22"
  tasks_completed: 2
  tests_added: 26
  files_created: 7
  files_modified: 4
---

# Phase 19 Plan 01: Asset Acquisition Financial Integration — Backend Module Summary

**One-liner:** NF-e v4.0 XML parser + atomic Asset+Payable creation with AVISTA/FINANCIADO installments and multi-asset rateio via Prisma transactions.

## What Was Built

Full backend module for asset acquisition financial integration, covering:

1. **Prisma migration** — Added `ASSET_ACQUISITION` to `PayableCategory` enum with SQL `ALTER TYPE` migration
2. **Type updates** — PAYABLE_CATEGORY_LABELS and PAYABLE_DFC_MAP extended with ASSET_ACQUISITION → INVESTIMENTO
3. **NF-e parser** — `parseNfeXml` extracts all required tags from v4.0 NF-e XML (bare NFe root and nfeProc wrapper); `calculateRateio` distributes accessory expenses proportionally with cent-exact precision
4. **Service** — Three exported functions: `createAcquisitionAndPayable` (atomic Asset+CP), `parseNfeUpload` (buffer → NfeParsedData), `createFromNfe` (multi-asset NF with rateio)
5. **Routes** — Three POST endpoints at `/api/org/:orgId/asset-acquisitions`, with multer XML upload for `/parse-nfe`
6. **App wiring** — `assetAcquisitionsRouter` registered in `app.ts`

## Commits

- `aeea1f94` — feat(19-01): Prisma migration, types, and NF-e parser with unit tests
- `6e268963` — feat(19-01): asset-acquisitions service, routes, integration tests, and app.ts wiring

## Tests

| Suite | Tests | Status |
|-------|-------|--------|
| nfe-parser.spec.ts | 11 | PASS |
| asset-acquisitions.routes.spec.ts | 15 | PASS |
| **Total** | **26** | **All green** |

## Requirements Coverage

| Requirement | Description | Status |
|-------------|-------------|--------|
| AQUI-01 | Cash purchase creates Asset + Payable atomically | Covered by Test 1+2 |
| AQUI-02 | Financed purchase creates N installments summing to acquisitionValue | Covered by Test 3+4 |
| AQUI-03 | NF-e XML parsing extracts supplier, value, items | Covered by nfe-parser Tests 1-8 |
| AQUI-04 | Multi-asset NF creates N assets with proportional rateio | Covered by Tests 9-11 |
| AQUI-07 | Transaction atomicity: failed CP prevents asset creation | Covered by Test 12 |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files Exist

- [x] apps/backend/prisma/migrations/20260426100000_add_payable_category_asset_acquisition/migration.sql
- [x] apps/backend/src/modules/asset-acquisitions/asset-acquisitions.types.ts
- [x] apps/backend/src/modules/asset-acquisitions/nfe-parser.ts
- [x] apps/backend/src/modules/asset-acquisitions/nfe-parser.spec.ts
- [x] apps/backend/src/modules/asset-acquisitions/asset-acquisitions.service.ts
- [x] apps/backend/src/modules/asset-acquisitions/asset-acquisitions.routes.ts
- [x] apps/backend/src/modules/asset-acquisitions/asset-acquisitions.routes.spec.ts

### Commits Exist

- [x] aeea1f94
- [x] 6e268963

## Self-Check: PASSED
