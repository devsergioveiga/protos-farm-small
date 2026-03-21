# Phase 16: Cadastro de Ativos — Research

**Researched:** 2026-03-19
**Domain:** Asset registry — Prisma schema design, multi-type CRUD, CSV/Excel bulk import, file upload, detail page with tabs, sidebar group wiring, RBAC permissions
**Confidence:** HIGH

## Summary

Phase 16 is the foundation of the entire patrimony module — every downstream phase (depreciation, maintenance, financial integration, disposal) depends on the `Asset` entity being defined correctly now. The schema must encode CPC accounting classification (CPC 27 depreciable, CPC 27 non-depreciable, CPC 29 fair value) as an enum from day one, per the locked architectural decision in STATE.md. Changing the classification enum after Phases 17-24 are built would require schema-wide migrations.

The phase covers six asset types with distinct field sets: MAQUINA (HP, fuel type, engine), VEICULO (RENAVAM, plate, odometer), IMPLEMENTO (may link to parent machine), BENFEITORIA (geo point/polygon, construction material, area m²), TERRA (registry number, area ha, non-depreciable), and EQUIPAMENTO (smaller devices). The project already has all supporting infrastructure — multer disk upload for photos, ExcelJS + manual CSV parser for bulk import, the `CostCenter` model for CC allocation, `Farm` for location, `Supplier` for acquisition data, and a sequential numbering pattern (RC-YYYY/NNNN) usable for asset tags.

The frontend pattern is well-established: lazy-loaded page + modal-per-action + custom hook per operation. The BulkImportModal with multi-step wizard (upload → column mapping → preview → confirm → report) and the AnimalDetailPage tab pattern are the direct references for asset import and asset detail respectively. No new library needs to be installed for any feature in this phase.

**Primary recommendation:** Follow the Supplier + Animals import blueprint exactly. Define all CPC enums in the first plan (schema foundation), then layer CRUD, import, and frontend in subsequent plans.

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                          | Research Support                                                                                                                      |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| ATIV-01 | Gerente pode cadastrar máquinas, veículos e implementos com dados de aquisição, operacionais, status e fotos                                         | Schema types MAQUINA/VEICULO/IMPLEMENTO; multer diskStorage pattern; photoUrl String? on asset; supplier + farm FK                    |
| ATIV-02 | Gerente pode cadastrar benfeitorias e ativos imóveis com geolocalização, material de construção, área e capacidade — visualizando no mapa da fazenda | PostGIS geometry(Point,4326) or geometry(Polygon,4326) — same pattern as Farm.boundary; FarmMap page already renders PostGIS polygons |
| ATIV-04 | Gerente pode cadastrar implementos com vinculação a máquina principal quando aplicável                                                               | parentAssetId FK self-referencing relation on Asset model                                                                             |
| ATIV-06 | Gerente pode visualizar inventário completo com filtros, busca, totalização e exportação CSV/Excel/PDF                                               | ExcelJS for XLSX, pdfkit for PDF — both already in backend deps; pagination pattern from all existing list endpoints                  |
| OPER-01 | Gerente pode registrar abastecimentos por ativo com custo/litro, custo/hora e benchmarking de eficiência                                             | New FuelRecord model linked to Asset; aggregate query for fleet average                                                               |
| OPER-03 | Operador pode atualizar horímetro/odômetro rapidamente pelo mobile com validação anti-regressão                                                      | New MeterReading model with currentValue validation > lastValue; same pattern as animal weighing anti-regression                      |

</phase_requirements>

---

## Standard Stack

### Core

| Library    | Version | Purpose                               | Why Standard                                                     |
| ---------- | ------- | ------------------------------------- | ---------------------------------------------------------------- |
| Prisma     | 7.x     | ORM + migrations                      | Already in use; asset models are new schema additions            |
| Express 5  | 5.x     | HTTP routes                           | All modules follow routes.ts + service.ts + types.ts             |
| ExcelJS    | ^4.4.0  | CSV/XLSX export and bulk import parse | Already installed; used in animals bulk import                   |
| multer     | ^2.1.0  | Photo upload (disk storage)           | Already installed; used in goods-receipts for photo upload       |
| decimal.js | ^10.6.0 | Asset acquisition values (monetary)   | Already installed; required per STATE.md depreciation decision   |
| pdfkit     | ^0.17.2 | PDF inventory export                  | Already installed; used in pesticide-prescriptions               |
| PostGIS    | 3.4     | Benfeitoria geolocation               | Already in stack; Farm.boundary uses geometry(MultiPolygon,4326) |

### Supporting

| Library                         | Version | Purpose                                 | When to Use                 |
| ------------------------------- | ------- | --------------------------------------- | --------------------------- |
| lucide-react                    | current | UI icons                                | All frontend icon usage     |
| react-router-dom                | current | Asset detail page routing `/assets/:id` | Detail page needs URL param |
| Vitest + @testing-library/react | current | Frontend specs                          | Any new page spec           |
| Jest + @swc/jest                | current | Backend specs                           | All routes.spec.ts files    |

### Alternatives Considered

| Instead of                           | Could Use                | Tradeoff                                                                                 |
| ------------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------- |
| Manual CSV parser (existing pattern) | react-spreadsheet-import | STATE.md explicitly flags RSI React 19 compat as unverified — do NOT use until validated |
| multer diskStorage (existing)        | S3/MinIO                 | Over-engineering; existing pattern serves all current photo needs                        |
| pdfkit (existing)                    | Puppeteer/html-pdf       | pdfkit already installed and working for prescriptions                                   |

**Installation:** No new packages needed. All required libraries are already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
apps/backend/src/modules/assets/
├── assets.routes.ts          # CRUD + search + export + photo upload
├── assets.routes.spec.ts     # Jest integration tests
├── assets.service.ts         # Business logic, sequential tag generation
├── assets.types.ts           # CreateAssetInput, UpdateAssetInput, AssetItem, etc.
├── asset-file-parser.ts      # CSV/XLSX parser (clone of animal-file-parser.ts)
└── asset-bulk-import.service.ts  # Bulk import validation + insert

apps/backend/src/modules/fuel-records/
├── fuel-records.routes.ts
├── fuel-records.routes.spec.ts
├── fuel-records.service.ts
└── fuel-records.types.ts

apps/backend/src/modules/meter-readings/
├── meter-readings.routes.ts
├── meter-readings.routes.spec.ts
├── meter-readings.service.ts
└── meter-readings.types.ts

apps/frontend/src/pages/
├── AssetsPage.tsx            # List + filters + actions
├── AssetsPage.css
├── AssetDetailPage.tsx       # Tabbed detail view
└── AssetDetailPage.css

apps/frontend/src/components/assets/
├── AssetModal.tsx            # Create/edit — multi-section form (type selector first)
├── AssetModal.css
├── AssetImportModal.tsx      # Bulk import wizard (clone of animal-bulk-import pattern)
├── AssetImportModal.css
├── AssetGeneralTab.tsx       # Tab: dados gerais + fotos
├── AssetDocumentsTab.tsx     # Tab: documentos com vencimento
├── AssetMaintenanceTab.tsx   # Tab: histórico de manutenções (Phase 18 content, empty state now)
└── AssetTimelineTab.tsx      # Tab: timeline de eventos

apps/frontend/src/hooks/
├── useAssets.ts
├── useAssetDetail.ts
├── useAssetForm.ts
├── useAssetBulkImport.ts
├── useFuelRecords.ts
└── useMeterReadings.ts

apps/frontend/src/types/
└── asset.ts
```

### Pattern 1: Asset Schema with CPC Classification Enum

**What:** Single `Asset` table with type discriminator + classification enum. Type-specific fields in JSON column or nullable columns.
**When to use:** Multiple asset types with overlapping but distinct fields. JSON metadata avoids sparse nullable columns for type-specific data.
**Example:**

```prisma
// Source: STATE.md locked decisions + project Prisma schema conventions
enum AssetType {
  MAQUINA
  VEICULO
  IMPLEMENTO
  BENFEITORIA
  TERRA
  EQUIPAMENTO
}

enum AssetClassification {
  DEPRECIABLE_CPC27        // Máquinas, veículos, benfeitorias — straight-line
  NON_DEPRECIABLE_CPC27    // Terra/imóvel rural — never depreciated
  FAIR_VALUE_CPC29         // Ativos biológicos — fair value remeasurement
  BEARER_PLANT_CPC27       // Planta portadora (café, laranja) — depreciable
}

enum AssetStatus {
  ATIVO
  INATIVO
  EM_MANUTENCAO
  ALIENADO
  EM_ANDAMENTO              // WIP — excluded from depreciation batch per STATE.md
}

model Asset {
  id                  String               @id @default(uuid())
  organizationId      String
  farmId              String
  assetType           AssetType
  classification      AssetClassification
  status              AssetStatus          @default(ATIVO)
  name                String
  description         String?
  assetTag            String               // Sequential: AT-YYYY/NNNN
  acquisitionDate     DateTime?
  acquisitionValue    Decimal?             @db.Decimal(15, 2)
  supplierId          String?
  invoiceNumber       String?
  costCenterId        String?
  costCenterMode      CostCenterAllocMode  @default(FIXED)
  costCenterPercent   Decimal?             @db.Decimal(5, 2)
  // Type-specific fields
  serialNumber        String?
  manufacturer        String?
  model               String?
  yearOfManufacture   Int?
  // MAQUINA / VEICULO / IMPLEMENTO
  engineHp            Decimal?             @db.Decimal(8, 2)
  fuelType            String?
  renavamCode         String?
  licensePlate        String?
  parentAssetId       String?              // IMPLEMENTO linked to MAQUINA
  // BENFEITORIA
  constructionMaterial String?
  areaM2              Decimal?             @db.Decimal(12, 2)
  capacity            String?
  geoPoint            Unsupported("geometry(Point, 4326)")?
  geoBoundary         Unsupported("geometry(Polygon, 4326)")?
  // TERRA
  registrationNumber  String?
  areaHa              Decimal?             @db.Decimal(12, 4)
  carCode             String?
  // Meter readings (current snapshot — history in MeterReading)
  currentHourmeter    Decimal?             @db.Decimal(12, 2)
  currentOdometer     Decimal?             @db.Decimal(12, 2)
  // Photos stored as JSON array of paths
  photoUrls           Json?                @default("[]")
  notes               String?
  deletedAt           DateTime?
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt

  organization   Organization     @relation(...)
  farm           Farm             @relation(...)
  supplier       Supplier?        @relation(...)
  costCenter     CostCenter?      @relation(...)
  parentAsset    Asset?           @relation("AssetHierarchy", fields: [parentAssetId], references: [id])
  childAssets    Asset[]          @relation("AssetHierarchy")
  fuelRecords    FuelRecord[]
  meterReadings  MeterReading[]

  @@unique([organizationId, assetTag])
  @@index([organizationId, assetType])
  @@index([organizationId, status])
  @@index([farmId])
  @@map("assets")
}

model FuelRecord {
  id              String   @id @default(uuid())
  organizationId  String
  assetId         String
  farmId          String
  fuelDate        DateTime
  liters          Decimal  @db.Decimal(10, 3)
  pricePerLiter   Decimal  @db.Decimal(10, 4)
  totalCost       Decimal  @db.Decimal(15, 2)
  hourmeterAtFuel Decimal? @db.Decimal(12, 2)
  odometerAtFuel  Decimal? @db.Decimal(12, 2)
  notes           String?
  createdBy       String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  asset Asset @relation(...)
  @@index([assetId])
  @@index([organizationId, fuelDate])
  @@map("fuel_records")
}

model MeterReading {
  id             String   @id @default(uuid())
  organizationId String
  assetId        String
  readingDate    DateTime
  readingType    String   // HOURMETER | ODOMETER
  value          Decimal  @db.Decimal(12, 2)
  previousValue  Decimal? @db.Decimal(12, 2)
  createdBy      String
  createdAt      DateTime @default(now())

  asset Asset @relation(...)
  @@index([assetId, readingType])
  @@map("meter_readings")
}
```

### Pattern 2: Sequential Asset Tag Generation

**What:** Same `findFirst + increment` pattern used in purchase-requests.service.ts
**Example:**

```typescript
// Source: apps/backend/src/modules/purchase-requests/purchase-requests.service.ts (lines 26-44)
async function getNextAssetTag(tx: TxClient, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const last = await tx.asset.findFirst({
    where: { organizationId, assetTag: { startsWith: `AT-${year}/` } },
    orderBy: { assetTag: 'desc' },
    select: { assetTag: true },
  });
  let lastNum = 0;
  if (last?.assetTag) {
    const parts = last.assetTag.split('/');
    lastNum = parseInt(parts[1] ?? '0', 10);
  }
  return `AT-${year}/${String(lastNum + 1).padStart(4, '0')}`;
}
```

### Pattern 3: Multi-Photo Upload (multer diskStorage)

**What:** Multiple photos uploaded via multipart/form-data, stored under `uploads/assets/{orgId}/{assetId}/`
**Example:**

```typescript
// Source: apps/backend/src/modules/goods-receipts/goods-receipts.routes.ts (lines 48-59)
const photoStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const orgId = req.user?.organizationId ?? 'unknown';
    const assetId = (req.params.id as string) ?? 'unknown';
    const dir = path.join('uploads', 'assets', orgId, assetId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
// Photo URLs stored as JSON array: ["/api/uploads/assets/{orgId}/{assetId}/..."]
```

### Pattern 4: Bulk Import Multi-Step Wizard

**What:** Three-phase backend (parse headers → preview → confirm) + multi-step frontend modal
**Reference:** `apps/backend/src/modules/animals/animal-file-parser.ts` + `apps/frontend/src/components/bulk-import/BulkImportModal.tsx`

Steps:

1. `POST /api/org/assets/import/parse` — returns `{ columnHeaders, rows }` (no DB write)
2. `POST /api/org/assets/import/preview` — validates rows with column mapping, returns `{ valid, invalid }`
3. `POST /api/org/assets/import/confirm` — inserts valid rows, returns `{ imported, skipped, failed, errors }`

Required CSV columns to map: `nome`, `tipo`, `classificacao_cpc`, `fazenda`, `data_aquisicao`, `valor_aquisicao`.
Optional: `tag`, `numero_serie`, `fabricante`, `modelo`, `ano`, `centro_custo`.

### Pattern 5: Meter Reading Anti-Regression

**What:** On MeterReading create, validate new value > last recorded value for same asset + readingType
**Example:**

```typescript
// Source: pattern from animal weighing validation in project
const lastReading = await prisma.meterReading.findFirst({
  where: { assetId: input.assetId, readingType: input.readingType },
  orderBy: { readingDate: 'desc' },
});
if (lastReading && input.value <= lastReading.value) {
  throw new AssetError('Leitura não pode ser menor ou igual à última registrada.', 400);
}
```

### Pattern 6: Tabbed Asset Detail Page

**What:** URL `/assets/:assetId` with useState for active tab — same as AnimalDetailPage
**Reference:** `apps/frontend/src/pages/AnimalDetailPage.tsx`
**Tabs for Phase 16:** `general` | `documents` | `fuel` | `readings` | `timeline`
(Maintenance tab added empty with "Fases futuras" note — maintenance module is Phase 18)

### Anti-Patterns to Avoid

- **Separate tables per asset type:** Creates JOIN hell when listing all assets. Use single table with nullable type-specific columns.
- **Boolean `isDepreciable` column:** Replace with `AssetClassification` enum — captures CPC chapter, not just a flag.
- **Storing photos as comma-separated string:** Use `Json?` array or dedicated `AssetPhoto` model (JSON array simpler for Phase 16, migrate to model if Phase 18 needs photo-level metadata).
- **react-spreadsheet-import for bulk import:** STATE.md flags React 19 compatibility as unverified. Use existing ExcelJS + manual CSV parser pattern.
- **Routing AssetAcquisition through GoodsReceipt:** Locked decision in STATE.md — asset NF must never create StockEntry.

---

## Don't Hand-Roll

| Problem                                  | Don't Build            | Use Instead                                                  | Why                                                                                                |
| ---------------------------------------- | ---------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| XLSX parsing                             | Custom XLSX reader     | ExcelJS (already installed)                                  | Handles merged cells, date serialization, BOM — edge cases already solved in animal-file-parser.ts |
| Photo storage                            | S3/presigned URL logic | multer diskStorage + `/api/uploads` static (already working) | Sufficient for current scale; pattern established in goods-receipts                                |
| PDF export                               | HTML-to-PDF            | pdfkit (already installed)                                   | Used in pesticide-prescriptions; consistent output format                                          |
| CSV export                               | Manual string builder  | ExcelJS `.csv` writer (already in use)                       | Handles quoting, special characters                                                                |
| Decimal arithmetic for acquisition value | Native JS float        | decimal.js (already installed)                               | Required per STATE.md locked decision for all monetary/depreciation math                           |
| Sequential asset tags                    | UUID-only IDs          | findFirst + increment in Prisma transaction                  | Same pattern as RC-YYYY/NNNN in purchase-requests — race-safe within transaction                   |

---

## Common Pitfalls

### Pitfall 1: Sparse Nullable Columns vs JSON Metadata

**What goes wrong:** Defining 20+ nullable columns on the `assets` table for type-specific fields creates a very wide sparse row.
**Why it happens:** Trying to stay "pure relational" instead of pragmatic.
**How to avoid:** Type-specific data that is only meaningful for one asset type goes into a `typeMetadata Json?` column. Fields used for search/filter/sort stay as first-class columns (assetType, status, acquisitionValue, farmId, costCenterId).
**Warning signs:** More than 5 columns that are always NULL for a given asset type.

### Pitfall 2: Missing `organizationId` Index

**What goes wrong:** Asset list queries scan all assets across all organizations — performance degrades with scale.
**Why it happens:** Forgetting the RLS pattern — every query in this project is scoped to `organizationId`.
**How to avoid:** `@@index([organizationId, assetType])` and `@@index([organizationId, status])` on the assets table from the start.

### Pitfall 3: CPC Classification as Boolean Instead of Enum

**What goes wrong:** `isDepreciable: Boolean` cannot represent CPC 29 fair value assets or bearer plants.
**Why it happens:** Simplifying for Phase 16 without thinking ahead.
**How to avoid:** Use `AssetClassification` enum from day one per STATE.md locked decision. Phase 17 (depreciation engine) reads this enum to determine calculation method.

### Pitfall 4: PhotoUrls as Bare Array Without Served Path

**What goes wrong:** Storing filename only; frontend cannot construct the URL to display the photo.
**Why it happens:** Mismatch between storage path and served path.
**How to avoid:** Store the full served path `/api/uploads/assets/{orgId}/{assetId}/{filename}` in the array, not just the filename. The static server is already mounted at `/api/uploads`.

### Pitfall 5: Bulk Import Without Column Mapping Step

**What goes wrong:** Users have CSV files with column names in Portuguese that don't match the system field names.
**Why it happens:** Hardcoding expected column headers.
**How to avoid:** Three-endpoint import pattern with explicit column mapping (parse → preview with mapping → confirm). Reference: animal bulk import in this project.

### Pitfall 6: Missing `assets` PermissionModule

**What goes wrong:** Using `financial:manage` or `operations:manage` for asset routes — misaligns RBAC semantics.
**How to avoid:** Add `'assets'` to `PermissionModule` union type in `apps/backend/src/shared/rbac/permissions.ts`. Assign `assets:create/read/update/delete` to MANAGER; `assets:read` to OPERATOR and FINANCIAL.

### Pitfall 7: Meter Reading Race Condition

**What goes wrong:** Two concurrent requests both pass the anti-regression check before either commits.
**Why it happens:** Check-then-insert without locking.
**How to avoid:** Wrap in Prisma `$transaction`; the `findFirst` + `create` runs atomically within the transaction block. For higher safety: unique constraint on `(assetId, readingType, readingDate)`.

---

## Code Examples

### Asset CRUD — Create with Tag Generation

```typescript
// Source: project pattern — apps/backend/src/modules/purchase-requests/purchase-requests.service.ts
export async function createAsset(ctx: RlsContext & { userId: string }, input: CreateAssetInput) {
  return prisma.$transaction(async (tx) => {
    const assetTag = await getNextAssetTag(tx, ctx.organizationId);
    return tx.asset.create({
      data: {
        organizationId: ctx.organizationId,
        farmId: input.farmId,
        assetType: input.assetType,
        classification: input.classification,
        name: input.name,
        assetTag,
        acquisitionDate: input.acquisitionDate ? new Date(input.acquisitionDate) : null,
        acquisitionValue: input.acquisitionValue ? new Decimal(input.acquisitionValue) : null,
        supplierId: input.supplierId ?? null,
        costCenterId: input.costCenterId ?? null,
        photoUrls: [],
      },
    });
  });
}
```

### Asset List with Filters

```typescript
// Source: pattern from animals.service.ts and stock-entries.service.ts
const where = {
  organizationId: ctx.organizationId,
  deletedAt: null,
  ...(input.farmId && { farmId: input.farmId }),
  ...(input.assetType && { assetType: input.assetType }),
  ...(input.status && { status: input.status }),
  ...(input.costCenterId && { costCenterId: input.costCenterId }),
  ...(input.minValue && { acquisitionValue: { gte: new Decimal(input.minValue) } }),
  ...(input.maxValue && { acquisitionValue: { lte: new Decimal(input.maxValue) } }),
  ...(input.search && {
    OR: [
      { name: { contains: input.search, mode: 'insensitive' } },
      { assetTag: { contains: input.search, mode: 'insensitive' } },
      { serialNumber: { contains: input.search, mode: 'insensitive' } },
    ],
  }),
};
```

### Frontend Asset Form — Type-Conditional Fields

```tsx
// Source: project pattern — SupplierModal.tsx, AnimalModal.tsx
const [assetType, setAssetType] = useState<AssetType>('MAQUINA');

// Render type-specific section based on selected type
{assetType === 'VEICULO' && (
  <section>
    <h3>Dados do Veículo</h3>
    <label htmlFor="renavamCode">RENAVAM</label>
    <input id="renavamCode" name="renavamCode" ... />
    <label htmlFor="licensePlate">Placa *</label>
    <input id="licensePlate" name="licensePlate" aria-required="true" ... />
  </section>
)}
{assetType === 'BENFEITORIA' && (
  <section>
    <h3>Localização no Mapa</h3>
    {/* Reuse FarmMap + click-to-pin pattern from existing map components */}
  </section>
)}
```

### Fuel Record Benchmarking Query

```typescript
// Aggregate query for fleet average l/h
const fleetAvg = await prisma.fuelRecord.aggregate({
  where: {
    organizationId: ctx.organizationId,
    asset: { assetType: { in: ['MAQUINA', 'VEICULO'] } },
    hourmeterAtFuel: { not: null },
    fuelDate: { gte: periodStart },
  },
  _avg: { liters: true },
});
// Individual asset cost/hour = sum(totalCost) / sum(hours worked)
```

---

## State of the Art

| Old Approach                     | Current Approach                                    | When Changed      | Impact                                                                       |
| -------------------------------- | --------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------- |
| photoUrl: String? (single photo) | photoUrls: Json? (array)                            | Phase 16 decision | Multiple photos per asset from the start                                     |
| Ad-hoc permission strings        | `'assets'` PermissionModule added to permissions.ts | Phase 16          | MANAGER gets assets:\*, OPERATOR gets assets:read + write for meter readings |

**Deprecated/outdated:**

- None — this is greenfield schema work.

---

## Open Questions

1. **react-spreadsheet-import React 19 compatibility**
   - What we know: STATE.md explicitly flags this as unverified
   - What's unclear: Whether RSI works with React 19 (the project runs React 19)
   - Recommendation: Do NOT use RSI in Phase 16. Use existing ExcelJS + manual CSV parser pattern. Validate RSI separately before any future phase.

2. **Multiple photos — JSON array vs AssetPhoto model**
   - What we know: JSON array is simpler and sufficient for Phase 16
   - What's unclear: Phase 18 (maintenance OS) may need photo-level metadata (caption, upload date) for each OS photo
   - Recommendation: Use JSON array for asset-level photos in Phase 16. Phase 18 will introduce `WorkOrderPhoto` model; asset photos can be migrated then if needed.

3. **Benfeitoria map interaction in AssetModal**
   - What we know: Farm boundary map uses Leaflet; click-to-place marker is established
   - What's unclear: Whether the asset create modal should embed a mini-map for coordinate entry or accept manual lat/lon input
   - Recommendation: Provide both — manual coordinate input fields + optional map picker using the same `FarmMap` pattern. Keeps modal lean while enabling precision.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                  |
| ------------------ | ---------------------------------------------------------------------- |
| Framework          | Jest + @swc/jest (backend), Vitest + @testing-library/react (frontend) |
| Config file        | `apps/backend/jest.config.js`, `apps/frontend/vitest.config.ts`        |
| Quick run command  | `cd apps/backend && pnpm test -- --testPathPattern assets`             |
| Full suite command | `cd apps/backend && pnpm test`                                         |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                | Test Type        | Automated Command                                      | File Exists? |
| ------- | ------------------------------------------------------- | ---------------- | ------------------------------------------------------ | ------------ |
| ATIV-01 | POST /api/org/assets creates asset with sequential tag  | unit/integration | `pnpm test -- --testPathPattern assets.routes`         | ❌ Wave 0    |
| ATIV-01 | GET /api/org/assets returns paginated list with filters | unit/integration | `pnpm test -- --testPathPattern assets.routes`         | ❌ Wave 0    |
| ATIV-01 | PATCH /api/org/assets/:id updates asset                 | unit/integration | `pnpm test -- --testPathPattern assets.routes`         | ❌ Wave 0    |
| ATIV-01 | DELETE /api/org/assets/:id soft-deletes                 | unit/integration | `pnpm test -- --testPathPattern assets.routes`         | ❌ Wave 0    |
| ATIV-01 | POST /api/org/assets/:id/photos uploads photo to disk   | unit/integration | `pnpm test -- --testPathPattern assets.routes`         | ❌ Wave 0    |
| ATIV-02 | POST creates BENFEITORIA with geoPoint stored           | unit/integration | `pnpm test -- --testPathPattern assets.routes`         | ❌ Wave 0    |
| ATIV-04 | IMPLEMENTO links to parentAssetId                       | unit/integration | `pnpm test -- --testPathPattern assets.routes`         | ❌ Wave 0    |
| ATIV-06 | GET with CSV export returns valid CSV                   | unit/integration | `pnpm test -- --testPathPattern assets.routes`         | ❌ Wave 0    |
| ATIV-06 | POST import/parse returns column headers                | unit/integration | `pnpm test -- --testPathPattern assets.routes`         | ❌ Wave 0    |
| ATIV-06 | POST import/preview returns valid/invalid rows          | unit/integration | `pnpm test -- --testPathPattern assets.routes`         | ❌ Wave 0    |
| ATIV-06 | POST import/confirm inserts valid rows                  | unit/integration | `pnpm test -- --testPathPattern assets.routes`         | ❌ Wave 0    |
| OPER-01 | POST /api/org/fuel-records creates fuel record          | unit/integration | `pnpm test -- --testPathPattern fuel-records.routes`   | ❌ Wave 0    |
| OPER-01 | GET /api/org/assets/:id/fuel-stats returns benchmarking | unit/integration | `pnpm test -- --testPathPattern fuel-records.routes`   | ❌ Wave 0    |
| OPER-03 | POST /api/org/meter-readings rejects regression         | unit/integration | `pnpm test -- --testPathPattern meter-readings.routes` | ❌ Wave 0    |
| OPER-03 | POST /api/org/meter-readings accepts valid increment    | unit/integration | `pnpm test -- --testPathPattern meter-readings.routes` | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `cd apps/backend && pnpm test -- --testPathPattern "assets|fuel-records|meter-readings"`
- **Per wave merge:** `cd apps/backend && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/assets/assets.routes.spec.ts` — covers ATIV-01, ATIV-02, ATIV-04, ATIV-06
- [ ] `apps/backend/src/modules/fuel-records/fuel-records.routes.spec.ts` — covers OPER-01
- [ ] `apps/backend/src/modules/meter-readings/meter-readings.routes.spec.ts` — covers OPER-03

_(Frontend specs for AssetsPage and AssetDetailPage are created in the frontend plan, not Wave 0)_

---

## Sources

### Primary (HIGH confidence)

- Project codebase — `apps/backend/prisma/schema.prisma` (existing models, enums, patterns)
- Project codebase — `apps/backend/src/modules/purchase-requests/purchase-requests.service.ts` (sequential numbering)
- Project codebase — `apps/backend/src/modules/animals/animal-file-parser.ts` (CSV/XLSX parser)
- Project codebase — `apps/backend/src/modules/goods-receipts/goods-receipts.routes.ts` (multer diskStorage photo upload)
- Project codebase — `apps/backend/src/shared/rbac/permissions.ts` (PermissionModule system)
- Project codebase — `apps/frontend/src/components/bulk-import/BulkImportModal.tsx` (wizard pattern)
- Project codebase — `apps/frontend/src/pages/AnimalDetailPage.tsx` (tabbed detail page)
- `.planning/STATE.md` — locked architectural decisions for v1.2

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — ATIV-01 through ATIV-06, OPER-01, OPER-03 descriptions
- `.planning/ROADMAP.md` — Phase 16 success criteria and dependencies

### Tertiary (LOW confidence)

- None — all findings verified against project codebase.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries already installed and in use
- Architecture: HIGH — directly derived from existing patterns in the codebase
- Pitfalls: HIGH — identified from actual code patterns, locked decisions, and known gotchas in STATE.md
- Schema design: HIGH — enums locked in STATE.md; field choices derived from requirements analysis

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable domain — no fast-moving libraries)
