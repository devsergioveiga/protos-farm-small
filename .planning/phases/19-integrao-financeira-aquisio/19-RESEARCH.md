# Phase 19: Integração Financeira — Aquisição — Research

**Researched:** 2026-03-22
**Domain:** Asset acquisition financial integration — automatic CP generation, financed purchase installments, NF-e XML parsing, multi-asset NF rateio, cost-center + accounting classification linkage
**Confidence:** HIGH

## Summary

Phase 19 wires the Asset module (Phase 16) to the Payables (CP) module so that every asset acquisition automatically generates the correct financial obligation — without touching GoodsReceipt or StockEntry. The architectural boundary is already in STATE.md: `AssetAcquisition never routes through GoodsReceipt`. The CP must carry `originType = 'ASSET_ACQUISITION'` and `originId = assetId` to maintain traceability without a dedicated foreign key.

The implementation requires a new `asset-acquisitions` backend module. The module's primary service function — `createAcquisitionAndPayable` — wraps asset creation + CP generation in a single Prisma transaction. For financed purchases (AQUI-02), the existing `generateInstallments` utility from `@protos-farm/shared` is reused directly, the same way it is used in `payables.service.ts` and `rural-credit.service.ts`. For NF-e XML upload (AQUI-03 and AQUI-04), the project already has `@xmldom/xmldom` installed and a proven DOMParser pattern in `reconciliation/ofx-parser.ts` and `farms/geo-parser.ts`. No new library is needed.

The frontend work is an extension to the existing `AssetModal.tsx` (already has acquisitionValue, invoiceNumber, acquisitionDate fields) with a new collapsible "Dados Financeiros" section and a separate "Importar NF-e" flow. The cost-center and accounting classification fields required by AQUI-07 are already on the `Asset` model (`costCenterId`, `costCenterMode`, `classification`).

**Primary recommendation:** Create the `asset-acquisitions` module as a thin orchestration layer — it validates, calls `assets.service.createAsset`, then immediately calls CP creation logic within the same transaction. Do not modify `assets.service.ts` directly; keep acquisition logic isolated so it can be extended for disposal (Phase 20) without conflict.

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                        | Research Support                                                                                                                                                                                                                                                           |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AQUI-01 | Ao cadastrar ativo com valor de aquisição, sistema gera CP automaticamente com fornecedor, valor, vencimento e centro de custo     | `assets` model already has `acquisitionValue`, `supplierId`, `costCenterId`; CP creation pattern from `goods-receipts.service.ts` line 730; `originType = 'ASSET_ACQUISITION'` on Payable                                                                                  |
| AQUI-02 | Gerente pode registrar compra financiada com dados do financiamento e parcelas geradas automaticamente no CP                       | `generateInstallments` from `@protos-farm/shared` already handles this; `rural-credit.service.ts` shows the per-installment Payable pattern with `category: 'FINANCING'`                                                                                                   |
| AQUI-03 | Gerente pode importar dados do ativo a partir de NF-e XML com preenchimento automático de fornecedor, valor, itens e dados fiscais | `@xmldom/xmldom` already installed; `DOMParser` pattern from `ofx-parser.ts` and `geo-parser.ts`; NF-e v4.0 tag paths: emit/xNome (supplier name), ICMSTot/vNF (total), nNF (invoice number), dhEmi (date), det/prod/xProd (item description), det/prod/vProd (item value) |
| AQUI-04 | Gerente pode registrar NF com múltiplos ativos, cada um gerando registro patrimonial e rateio proporcional das despesas acessórias | Multi-asset loop in same transaction; despesas acessórias (frete, seguro, outros) rateado proporcional a `vProd` por item; each asset gets proportional `acquisitionValue` = `vProd + allocatedExpenses`                                                                   |
| AQUI-07 | Cada aquisição tem centro de custo e classificação contábil definidos para apropriação correta da depreciação futura               | `Asset.costCenterId`, `Asset.costCenterMode`, `Asset.classification` (AssetClassification enum) already in schema; CP gets `PayableCostCenterItem` with same costCenter; classification passed through from AssetModal                                                     |

</phase_requirements>

---

## Standard Stack

### Core

| Library             | Version | Purpose                                                    | Why Standard                                                                                |
| ------------------- | ------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Prisma              | 7.x     | ORM + transaction for atomic asset+CP creation             | Already in use; `prisma.$transaction` pattern established in `assets.service.ts`            |
| @protos-farm/shared | current | `generateInstallments`, `validateCostCenterItems`, `Money` | Already imported in `payables.service.ts`; handles installment arithmetic and cent residual |
| @xmldom/xmldom      | ^0.8.11 | NF-e XML parsing                                           | Already installed; used in `ofx-parser.ts` and `geo-parser.ts`                              |
| decimal.js          | ^10.6.0 | Monetary arithmetic for acquisition values and rateio      | Locked decision in STATE.md for all monetary math                                           |
| multer              | ^2.1.0  | NF-e XML file upload                                       | Already installed; used for photos in assets module                                         |
| Express 5           | 5.x     | HTTP routes                                                | Standard module pattern                                                                     |

### Supporting

| Library                         | Version | Purpose                   | When to Use              |
| ------------------------------- | ------- | ------------------------- | ------------------------ |
| Jest + @swc/jest                | current | Backend integration tests | All routes.spec.ts files |
| Vitest + @testing-library/react | current | Frontend spec             | AssetModal extension     |
| supertest                       | current | HTTP layer tests          | routes.spec.ts pattern   |

### Alternatives Considered

| Instead of                  | Could Use                     | Tradeoff                                                                         |
| --------------------------- | ----------------------------- | -------------------------------------------------------------------------------- |
| @xmldom/xmldom (existing)   | fast-xml-parser               | Not installed; xmldom is already proven in project                               |
| Per-asset CP in transaction | Async event after creation    | Sync transaction is simpler and guarantees atomicity; no BullMQ needed for this  |
| Extending assets.service.ts | New asset-acquisitions module | Isolation preferred: acquisition logic grows (AQUI-05, AQUI-06 in future phases) |

**Installation:** No new packages needed. All required libraries are already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
apps/backend/src/modules/asset-acquisitions/
├── asset-acquisitions.routes.ts        # POST /asset-acquisitions, POST /asset-acquisitions/parse-nfe
├── asset-acquisitions.routes.spec.ts   # Jest integration tests
├── asset-acquisitions.service.ts       # createAcquisitionAndPayable, createFinancedAcquisition, parseNfeXml
├── nfe-parser.ts                       # NF-e v4.0 XML tag extraction (uses @xmldom/xmldom)
└── asset-acquisitions.types.ts         # Input/output types, error class

apps/frontend/src/components/assets/
├── AssetModal.tsx                      # Extended with "Dados Financeiros" section
├── AssetNfeImportModal.tsx             # NEW: multi-step NF-e XML upload + asset assignment
└── AssetNfeImportModal.css             # NEW
```

### Pattern 1: Atomic Asset + CP Creation (AQUI-01)

**What:** Single Prisma transaction creates `Asset` record then immediately creates `Payable` + `PayableInstallment` + `PayableCostCenterItem`, all within the same DB transaction.
**When to use:** Any asset with `acquisitionValue > 0` and `supplierId` and `dueDate`.
**Example:**

```typescript
// Source: goods-receipts.service.ts line 730 + rural-credit.service.ts line 243
export async function createAcquisitionAndPayable(
  ctx: RlsContext,
  input: CreateAssetAcquisitionInput,
): Promise<AssetAcquisitionOutput> {
  return prisma.$transaction(async (tx) => {
    // 1. Create asset (reuse assets.service helpers via tx)
    const asset = await tx.asset.create({ data: { ...assetData } });

    // 2. Create CP if acquisitionValue present
    if (input.acquisitionValue && input.dueDate) {
      const totalMoney = Money(input.acquisitionValue);
      const installmentCount = input.paymentType === 'AVISTA' ? 1 : (input.installmentCount ?? 1);
      const installments = generateInstallments(
        totalMoney,
        installmentCount,
        new Date(input.dueDate),
      );

      const payable = await tx.payable.create({
        data: {
          organizationId: ctx.organizationId,
          farmId: input.farmId,
          supplierName: input.supplierName, // resolved from supplierId
          category: input.paymentType === 'FINANCIADO' ? 'FINANCING' : 'OTHER',
          description: `Aquisição ${asset.assetTag} — ${asset.name}`,
          totalAmount: totalMoney.toDecimal(),
          dueDate: new Date(input.dueDate),
          documentNumber: input.invoiceNumber ?? null,
          installmentCount,
          originType: 'ASSET_ACQUISITION',
          originId: asset.id,
        },
      });

      await tx.payableInstallment.createMany({
        data: installments.map((inst) => ({
          payableId: payable.id,
          number: inst.number,
          amount: inst.amount.toDecimal(),
          dueDate: inst.dueDate,
        })),
      });

      if (input.costCenterId) {
        await tx.payableCostCenterItem.create({
          data: {
            payableId: payable.id,
            costCenterId: input.costCenterId,
            farmId: input.farmId,
            allocMode: 'PERCENTAGE',
            percentage: 100,
          },
        });
      }
    }

    return { asset, payableId: payable?.id ?? null };
  });
}
```

### Pattern 2: NF-e XML Parsing (AQUI-03)

**What:** Upload NF-e v4.0 XML file via multer; parse with `@xmldom/xmldom` DOMParser; extract supplier name, total value, invoice number, date, and per-item data. Return pre-filled DTO — do not create anything yet (preview step).
**When to use:** User chooses "Importar NF-e" flow.
**Example:**

```typescript
// Source: reconciliation/ofx-parser.ts + farms/geo-parser.ts DOMParser pattern
import { DOMParser } from '@xmldom/xmldom';

function getTag(doc: Document, tag: string): string | undefined {
  const el = doc.getElementsByTagName(tag);
  return el.length > 0 ? el[0].textContent?.trim() : undefined;
}

export function parseNfeXml(xmlString: string): NfeParsedData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  const supplierName = getTag(doc, 'xNome'); // emit/xNome
  const invoiceNumber = getTag(doc, 'nNF'); // ide/nNF
  const issueDateStr = getTag(doc, 'dhEmi'); // ide/dhEmi — ISO 8601
  const totalNf = getTag(doc, 'vNF'); // ICMSTot/vNF — total NF value
  const freight = getTag(doc, 'vFrete'); // ICMSTot/vFrete
  const insurance = getTag(doc, 'vSeg'); // ICMSTot/vSeg
  const otherCosts = getTag(doc, 'vOutro'); // ICMSTot/vOutro

  const detElements = doc.getElementsByTagName('det');
  const items: NfeItem[] = [];
  for (let i = 0; i < detElements.length; i++) {
    const det = detElements[i];
    items.push({
      description: det.getElementsByTagName('xProd')[0]?.textContent?.trim() ?? '',
      value: parseFloat(det.getElementsByTagName('vProd')[0]?.textContent ?? '0'),
      ncm: det.getElementsByTagName('NCM')[0]?.textContent?.trim(),
      quantity: parseFloat(det.getElementsByTagName('qCom')[0]?.textContent ?? '1'),
      unit: det.getElementsByTagName('uCom')[0]?.textContent?.trim(),
    });
  }

  return {
    supplierName,
    invoiceNumber,
    issueDate: issueDateStr,
    totalNf,
    freight,
    insurance,
    otherCosts,
    items,
  };
}
```

### Pattern 3: Multi-Asset NF Rateio (AQUI-04)

**What:** NF with N items → N asset records. Accessory expenses (freight, insurance, other costs) allocated proportionally to each item's `vProd` value. Each asset's `acquisitionValue = vProd_item + (accessoryExpenses * vProd_item / totalVProd)`.
**When to use:** NF-e XML has multiple `<det>` elements each mapped to a separate asset.
**Example:**

```typescript
// Rateio calculation — decimal.js for precision
const totalVProd = items.reduce((sum, i) => sum.add(Money(i.value)), Money(0));
const totalAccessory = Money(freight ?? 0)
  .add(Money(insurance ?? 0))
  .add(Money(otherCosts ?? 0));

const assetsToCreate = items.map((item) => {
  const proportion = Money(item.value).toDecimal().dividedBy(totalVProd.toDecimal());
  const allocatedAccessory = Money(totalAccessory.toDecimal().times(proportion));
  const acquisitionValue = Money(item.value).add(allocatedAccessory);
  return { ...itemAsAsset, acquisitionValue: acquisitionValue.toNumber() };
});
```

### Anti-Patterns to Avoid

- **Routing through GoodsReceipt:** Creating a GoodsReceiptItem for the asset NF will trigger StockEntry creation. The STATE.md decision is absolute: asset NF must never create StockEntry. Use `asset-acquisitions` module exclusively.
- **Mutating assets.service.ts for CP logic:** Keep acquisition orchestration in `asset-acquisitions` module. assets.service.ts remains pure CRUD for use by Phase 16 frontend flows.
- **Calling payables.service.createPayable() from transaction:** `payables.service.ts` uses `withRlsContext` which opens its own transaction. Calling it inside a Prisma `$transaction` will deadlock. Instead, duplicate the raw `tx.payable.create` inline (same as goods-receipts.service.ts line 730).
- **Storing NF-e XML in the database:** Parse it at upload time, extract the DTO, discard the blob. The asset's `invoiceNumber` field stores the NF number; full XML storage is out of scope.

---

## Don't Hand-Roll

| Problem                | Don't Build             | Use Instead                                          | Why                                                                         |
| ---------------------- | ----------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| Installment arithmetic | Custom division logic   | `generateInstallments` from `@protos-farm/shared`    | Handles cent residual on first installment; same as payables.service.ts     |
| Cost center validation | Custom percentage check | `validateCostCenterItems` from `@protos-farm/shared` | Handles PERCENTAGE vs FIXED_VALUE, tolerance ±0.01%, same as all CP modules |
| XML DOM parsing        | String regex extraction | `DOMParser` from `@xmldom/xmldom`                    | Already installed; handles nested tags, encoding, malformed XML             |
| Monetary rateio        | Float arithmetic        | `decimal.js` via `Money()` value object              | Float rounding causes cents off; Money wrapper already used everywhere      |

**Key insight:** Every piece of arithmetic and XML parsing already has a proven solution in the codebase. Phase 19 is primarily orchestration, not new infrastructure.

---

## Common Pitfalls

### Pitfall 1: Calling payables.service inside Prisma.$transaction

**What goes wrong:** `payables.service.createPayable` calls `withRlsContext` which creates a nested transaction context. Prisma 7 does not support nested interactive transactions — this will either fail or produce inconsistent state.
**Why it happens:** Temptation to reuse the high-level service instead of raw Prisma client calls.
**How to avoid:** In `asset-acquisitions.service.ts`, call `tx.payable.create(...)` directly, same as `goods-receipts.service.ts` does at line 730.
**Warning signs:** TypeScript error or runtime `AlreadyInTransaction` error during test.

### Pitfall 2: NF-e XML tag namespace conflicts

**What goes wrong:** NF-e files sometimes include the `nfeProc` root wrapper or the `NFe` namespace prefix. `getElementsByTagName('nNF')` returns empty if the parser sees `ns:nNF`.
**Why it happens:** NF-e XML structure varies between emission software. The document element may be `<nfeProc>` (processed) or `<NFe>` (raw).
**How to avoid:** After parsing, check `doc.documentElement.tagName` and strip namespace prefixes if needed. Use `getTag` helper that iterates `el[0]` from a live NodeList — this works regardless of namespace.
**Warning signs:** All parsed fields come back as `undefined` on real NF-e files even though regex tests pass.

### Pitfall 3: STATE.md warning — validate NF-e v4.0 tag paths against real sample

**What goes wrong:** Tag paths researched from documentation may differ from real files exported by farm management ERP software.
**Why it happens:** STATE.md explicitly flags this as a pending todo: "Validate NF-e v4.0 XML tag paths against real sample before Phase 19 story writing."
**How to avoid:** The `nfe-parser.ts` implementation should use defensive `?.textContent?.trim()` everywhere and return `null` gracefully for any missing tag. The frontend preview step shows the parsed data and lets the user correct any field before creating assets.
**Warning signs:** Unit tests pass with synthetic XML but integration fails with customer files.

### Pitfall 4: Missing `PayableCategory` enum value for asset acquisitions

**What goes wrong:** The existing `PayableCategory` enum does not have `ASSET_ACQUISITION`. Using `OTHER` loses meaning; the cashflow module maps categories to DFC classifications.
**Why it happens:** The enum was defined before Phase 19 was designed.
**How to avoid:** Add `ASSET_ACQUISITION` to the `PayableCategory` enum via migration and add the label to `PAYABLE_CATEGORY_LABELS` in `payables.types.ts`. Update `cashflow.types.ts` to map it to the appropriate DFC classification (Investimento/CAPEX).
**Warning signs:** Payables created with `originType = 'ASSET_ACQUISITION'` show as "Outros" in the financial dashboard, confusing the accountant.

### Pitfall 5: Multi-asset NF — cent residual in rateio

**What goes wrong:** Proportional allocation of accessory expenses across N items may not sum exactly to the total accessory amount due to Decimal rounding.
**Why it happens:** Each item's proportion is rounded to 2 decimal places; multiplied across N items the sum drifts.
**How to avoid:** Allocate accessory to items 2..N first, then assign residual to item 1 (same strategy as `generateInstallments`). Use `Decimal.ROUND_DOWN` on items 2..N.
**Warning signs:** Sum of all asset `acquisitionValue` does not equal NF `vNF`.

---

## Code Examples

### NF-e v4.0 Key Tag Paths (HIGH confidence — official schema)

```
nfeProc > NFe > infNFe > emit > xNome          — Supplier name
nfeProc > NFe > infNFe > ide > nNF             — Invoice number
nfeProc > NFe > infNFe > ide > dhEmi            — Issue date (ISO 8601)
nfeProc > NFe > infNFe > total > ICMSTot > vNF — Total NF value
nfeProc > NFe > infNFe > total > ICMSTot > vProd  — Sum of products
nfeProc > NFe > infNFe > total > ICMSTot > vFrete — Freight
nfeProc > NFe > infNFe > total > ICMSTot > vSeg   — Insurance
nfeProc > NFe > infNFe > total > ICMSTot > vOutro — Other costs
nfeProc > NFe > infNFe > det[n] > prod > xProd  — Item description
nfeProc > NFe > infNFe > det[n] > prod > vProd  — Item gross value
nfeProc > NFe > infNFe > det[n] > prod > NCM    — NCM code
nfeProc > NFe > infNFe > det[n] > prod > qCom   — Quantity (commercial)
nfeProc > NFe > infNFe > det[n] > prod > uCom   — Unit (commercial)
```

`getElementsByTagName` works flat (finds regardless of depth), so `doc.getElementsByTagName('xNome')[0]` finds `emit/xNome` without traversal.

### Payable creation inside transaction (existing pattern)

```typescript
// Source: apps/backend/src/modules/goods-receipts/goods-receipts.service.ts:730
// and rural-credit.service.ts:243 — both create payables directly via tx, not service
const payable = await (tx as any).payable.create({
  data: {
    organizationId: ctx.organizationId,
    farmId,
    supplierName: supplier.name,
    category: 'ASSET_ACQUISITION', // new enum value — migration needed
    description: `Aquisição ${asset.assetTag} — ${asset.name}`,
    totalAmount: totalMoney.toDecimal(),
    dueDate: firstDueDate,
    documentNumber: invoiceNumber ?? null,
    installmentCount,
    originType: 'ASSET_ACQUISITION',
    originId: asset.id,
  },
});
```

### generateInstallments usage (existing pattern)

```typescript
// Source: packages/shared/src/utils/installments.ts
import { generateInstallments, Money } from '@protos-farm/shared';

// Cash purchase (1 installment)
const installments = generateInstallments(Money(50000), 1, new Date('2026-04-01'));

// Financed (36 months, starting May 2026, monthly)
const installments = generateInstallments(Money(120000), 36, new Date('2026-05-01'), 1);
// frequencyMonths defaults to 1 — matches rural-credit pattern
```

---

## State of the Art

| Old Approach              | Current Approach                      | When Changed    | Impact                                                                       |
| ------------------------- | ------------------------------------- | --------------- | ---------------------------------------------------------------------------- |
| Asset creation without CP | Asset creation triggers CP atomically | Phase 19        | Accountant no longer needs to manually create CP after each asset purchase   |
| Manual NF data entry      | NF-e XML upload pre-fills form        | Phase 19        | Reduces data entry errors; supplier, value, date auto-populated              |
| GoodsReceipt as CP hub    | AssetAcquisition as separate module   | STATE.md locked | GoodsReceipt must never process asset NF lines to avoid StockEntry pollution |

**Deprecated/outdated:**

- Creating Payable records with `category: 'OTHER'` for asset acquisitions: replaced by new `ASSET_ACQUISITION` category value.

---

## Open Questions

1. **NF-e v4.0 tag paths against real customer files**
   - What we know: Official NF-e v4.0 schema uses paths listed above; `@xmldom/xmldom` can parse them.
   - What's unclear: Customer's NF-e files may have `nfeProc` wrapper or bare `NFe` root; some emit software uses different namespace prefixes. STATE.md explicitly flags this as unvalidated.
   - Recommendation: The planner should include a Wave 0 task to acquire a real NF-e XML sample (or synthetic one matching schema spec) and validate parser output. Parser must handle missing tags gracefully (return null, let user correct in UI).

2. **PayableCategory enum migration strategy**
   - What we know: `ASSET_ACQUISITION` does not exist in enum; using `OTHER` loses DFC classification.
   - What's unclear: Whether adding a new enum value requires all consumers of `PayableCategory` to be updated (cashflow.service.ts, payables.types.ts labels, frontend selects).
   - Recommendation: Add `ASSET_ACQUISITION` to enum in Wave 0 migration. Update `PAYABLE_CATEGORY_LABELS` and `cashflow.types.ts` in the same plan. Frontend payables filter should exclude `ASSET_ACQUISITION` from manual CP creation dropdown (asset CPs are generated-only).

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                             |
| ------------------ | --------------------------------------------------------------------------------- |
| Framework          | Jest + @swc/jest (backend), Vitest + @testing-library/react (frontend)            |
| Config file        | `apps/backend/jest.config.ts`, `apps/frontend/vite.config.ts`                     |
| Quick run command  | `pnpm --filter @protos-farm/backend test -- --testPathPattern asset-acquisitions` |
| Full suite command | `pnpm --filter @protos-farm/backend test`                                         |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                          | Test Type   | Automated Command                                                                        | File Exists? |
| ------- | ----------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------- | ------------ |
| AQUI-01 | POST /asset-acquisitions creates Asset + CP in same transaction   | integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern asset-acquisitions.routes` | ❌ Wave 0    |
| AQUI-01 | CP has originType=ASSET_ACQUISITION, originId=assetId             | integration | same                                                                                     | ❌ Wave 0    |
| AQUI-01 | CP cost center item created with asset's costCenterId             | integration | same                                                                                     | ❌ Wave 0    |
| AQUI-02 | Financed purchase creates N installments (36 months)              | integration | same                                                                                     | ❌ Wave 0    |
| AQUI-02 | Installments sum equals acquisitionValue exactly (no cent drift)  | unit        | `pnpm --filter @protos-farm/shared test -- --testPathPattern installments`               | ✅ exists    |
| AQUI-03 | parseNfeXml extracts supplierName, invoiceNumber, totalNf, items  | unit        | `pnpm --filter @protos-farm/backend test -- --testPathPattern nfe-parser`                | ❌ Wave 0    |
| AQUI-03 | POST /asset-acquisitions/parse-nfe returns parsed DTO             | integration | `pnpm --filter @protos-farm/backend test -- --testPathPattern asset-acquisitions.routes` | ❌ Wave 0    |
| AQUI-04 | Multi-item NF creates N assets with proportional acquisitionValue | integration | same                                                                                     | ❌ Wave 0    |
| AQUI-04 | Sum of all asset acquisitionValues equals NF vNF                  | unit        | `pnpm --filter @protos-farm/backend test -- --testPathPattern nfe-parser`                | ❌ Wave 0    |
| AQUI-07 | Asset classification passed to CP cost center appropriation       | integration | same                                                                                     | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `pnpm --filter @protos-farm/backend test -- --testPathPattern asset-acquisitions`
- **Per wave merge:** `pnpm --filter @protos-farm/backend test && pnpm --filter @protos-farm/shared test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/asset-acquisitions/asset-acquisitions.routes.spec.ts` — covers AQUI-01, AQUI-02, AQUI-03, AQUI-04, AQUI-07
- [ ] `apps/backend/src/modules/asset-acquisitions/nfe-parser.spec.ts` — covers AQUI-03 unit (tag extraction) and AQUI-04 rateio arithmetic
- [ ] Migration: `PayableCategory` enum + `ASSET_ACQUISITION` value — must run before any service test

---

## Sources

### Primary (HIGH confidence)

- Codebase: `apps/backend/src/modules/goods-receipts/goods-receipts.service.ts` lines 715-774 — inline CP creation inside Prisma transaction pattern
- Codebase: `apps/backend/src/modules/rural-credit/rural-credit.service.ts` lines 241-280 — per-installment Payable creation with `category: 'FINANCING'`
- Codebase: `packages/shared/src/utils/installments.ts` — `generateInstallments` signature and cent-residual strategy
- Codebase: `apps/backend/src/modules/reconciliation/ofx-parser.ts` — `DOMParser` from `@xmldom/xmldom` usage pattern
- Codebase: `apps/backend/prisma/schema.prisma` lines 5577-5624 — Payable model with `originType`, `originId`, `goodsReceiptId` pattern
- Codebase: `apps/backend/prisma/schema.prisma` lines 5515-5525 — `PayableCategory` enum (no ASSET_ACQUISITION yet)
- Codebase: `.planning/STATE.md` lines 70, 88 — locked decisions: "AssetAcquisition never routes through GoodsReceipt" and NF-e tag validation pending todo

### Secondary (MEDIUM confidence)

- NF-e XML v4.0 official schema tag paths (from NF-e v4.0 technical note and FlexDocs reference): `emit/xNome`, `ide/nNF`, `ide/dhEmi`, `total/ICMSTot/vNF`, `total/ICMSTot/vFrete`, `det/prod/xProd`, `det/prod/vProd` — verified against official schema structure; actual customer files may vary (STATE.md flags this)

### Tertiary (LOW confidence)

- None — all findings verified against codebase or official NF-e schema.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries verified as installed in `apps/backend/package.json`
- Architecture: HIGH — patterns copied directly from existing service files with exact line numbers
- Pitfalls: HIGH — Prisma nested transaction issue and NF-e tag variation are verified from codebase and STATE.md
- NF-e tag paths: MEDIUM — official schema verified; customer file variance acknowledged per STATE.md pending todo

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (NF-e schema is stable; only risk is customer file variance)
