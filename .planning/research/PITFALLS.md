# Pitfalls Research

**Domain:** Asset management, depreciation, maintenance OS, and financial integration added to existing agricultural ERP (financial + purchasing + stock already live)
**Researched:** 2026-03-19
**Confidence:** HIGH for integration pitfalls (derived from codebase analysis); HIGH for Brazilian accounting standards (CPC 27, CPC 29, CPC 06); MEDIUM for OS state machine and batch performance patterns (established ERP practice + training data); LOW where only training data without verification supports a claim.

---

## Critical Pitfalls

### Pitfall 1: Asset Purchase Creates Both a CP and a Stock Entry — Double-Counting Liabilities

**What goes wrong:**
When an asset is purchased, the system needs to generate a `Payable` (CP) so the financial team can track the obligation. If the asset purchase also routes through the existing `stock-entries` module (because the asset arrived on a NF and the receiving flow is reused), the system records both a stock entry for the item AND a CP for the purchase. The result is a phantom "inventory asset" that inflates the stock balance and a duplicate liability if the CP was also created by the goods-receipt flow.

This is the single most dangerous integration pitfall for this milestone. The existing procurement flow (`GoodsReceipt → StockEntry + Payable`) is designed for consumable inputs. Assets are not consumed — they are capitalized. Routing asset acquisitions through the same flow creates irreversible data corruption in both the stock and financial modules.

**Why it happens:**
The asset purchase NF arrives through the same physical receiving dock as stock inputs. A developer extends the existing goods-receipt or stock-entry flow to "also handle assets" by adding a flag: `isAsset: boolean`. The goods-receipt service then conditionally skips stock entry creation but still creates the CP — or vice versa. Under time pressure, the "just add a flag" shortcut avoids designing a separate asset acquisition flow.

**How to avoid:**

- Asset acquisitions must use a separate code path: `AssetAcquisition` module, not `GoodsReceipt` or `StockEntry`. These modules must never share logic other than calling `createPayable()` via the same shared service.
- The `Payable` created for an asset must use `originType = 'ASSET_ACQUISITION'` and `originId = assetId` — using the existing `originType`/`originId` pattern already on the `Payable` model in `schema.prisma`.
- Add `ASSET_ACQUISITION` to the `PayableCategory` enum in `schema.prisma` — do not reuse `OTHER` or `MAINTENANCE`. The distinction is critical for financial reporting (CAPEX vs OPEX).
- The `AssetAcquisition` record links to the `Asset` record (created simultaneously), to the CP, and to the `Supplier`. No `StockEntry` is created.
- For financed purchases: the `AssetAcquisition` service calls `generateInstallments()` from `@protos-farm/shared` (already used in procurement) to create the installment schedule.
- Receiving flow guard: add a check in the `GoodsReceipt` service — if the purchase order line item is of category `ASSET`, reject routing through the standard receiving flow and redirect to `AssetAcquisition`.

**Warning signs:**

- `StockEntry` records with a product category of `ASSET` or `EQUIPAMENTO`.
- `Payable.category` is `OTHER` for an asset purchase.
- `AssetAcquisition` calls `stockEntryService.create()` anywhere in its service.
- The `GoodsReceipt` CONFIRMADO handler does not check whether the PO line is an asset before creating a `StockEntry`.

**Phase to address:** Cadastro e Aquisição de Ativos (Phase 1) — the `AssetAcquisition` data model and its relationship to `Payable` must be defined before any phase that touches the receiving or financial flow.

---

### Pitfall 2: Depreciation Accumulated Value Exceeds Net Book Value Due to Decimal Rounding

**What goes wrong:**
Monthly depreciation is computed as: `(acquisitionValue - residualValue) / usefulLifeMonths`. On a tractor with `acquisitionValue = R$ 450,000.00`, `residualValue = R$ 45,000.00`, and `usefulLifeMonths = 120` (10 years), the monthly depreciation is `R$ 3,375.00` — clean. But on `acquisitionValue = R$ 120,000.00`, `residualValue = R$ 12,000.00`, `usefulLifeMonths = 84` (7 years), the result is `R$ 1,285.7142857...`, which rounds to `R$ 1,285.71`. Over 84 months, the sum is `R$ 107,999.64`, not `R$ 108,000.00`. The asset never fully depreciates.

The reverse problem also occurs: for pro rata die calculations in the first and last months (month of acquisition and month of disposal), the daily rate is `monthlyDepreciation / daysInMonth`. If this is computed with JavaScript `number` (IEEE 754 float), precision loss can accumulate across thousands of assets over years, making the depreciation ledger irreconcilable.

The project already uses `decimal.js` for all financial arithmetic (confirmed in `payables.service.ts` and bank account balance calculations). Using `number` for depreciation instead of `Decimal` is a regression that will not be caught in unit tests with clean numbers.

**Why it happens:**
Depreciation formulas look like simple arithmetic. Developers unfamiliar with the project's `Money`/`Decimal` convention write `acquisitionValue - residualValue / usefulLifeMonths` using plain JavaScript division. Tests pass because test values are chosen to divide evenly.

**How to avoid:**

- All depreciation arithmetic must use `Decimal` from `decimal.js` — same as `Money(value)` factory already in use.
- Depreciation period amount: `Decimal(acquisitionValue).minus(residualValue).dividedBy(usefulLifeMonths).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN)`.
- Last period correction: the final depreciation entry must be `netBookValue - residualValue` (not the computed period amount) to ensure the net book value reaches exactly the residual value. This final-period balancing entry is standard in CPC 27.
- Pro rata die for first/last month: `periodAmount.times(daysUsed).dividedBy(daysInMonth).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN)`.
- Store accumulated depreciation as `Decimal(15, 2)` in the database (same precision as `totalAmount` on `Payable`).
- Add a database constraint or service-layer check: `accumulatedDepreciation <= acquisitionValue - residualValue` — never allow overshoot.
- Unit test specifically: an asset that runs the full depreciation schedule must end with `netBookValue === residualValue` to the cent.

**Warning signs:**

- Depreciation service imports `Money` but computes period amounts with `asset.acquisitionValue / asset.usefulLifeMonths` (JS division).
- No "last period balancing" logic — the final month uses the same computed amount as all other months.
- `DepreciationEntry.amount` stored as `Float` instead of `Decimal(15, 2)`.
- Test fixtures use clean numbers like `R$ 12,000.00` over 12 months — these pass even with float arithmetic.

**Phase to address:** Configuração e Cálculo de Depreciação (Phase 3) — the Decimal arithmetic discipline must be enforced from the first depreciation function written, because retrofitting it requires recalculating all historical entries.

---

### Pitfall 3: CPC 27 vs CPC 29 Classification Error for Biological Assets

**What goes wrong:**
The system must handle multiple asset categories: machines and vehicles (CPC 27 — depreciable), land/rural properties (CPC 27 — not depreciable), and biological assets (CPC 29 — measured at fair value less selling costs, NOT depreciated in the traditional sense). Bearer plants (coffee trees, orange trees, sugarcane — used to produce agricultural products over multiple periods) are a special case: they fall under CPC 27 (treated as fixed assets, depreciated over useful life), not CPC 29.

The confusion: a developer classifies cattle as `AssetType.MACHINERY_EQUIPMENT` (wrong), or classifies productive coffee trees as `AssetType.BIOLOGICAL_ASSET` subject to fair-value measurement (wrong — bearer plants use CPC 27 straight-line depreciation). The depreciation engine then either skips depreciation for cattle (no fair-value mechanism implemented) or applies straight-line depreciation to cattle (non-compliant with CPC 29).

**Why it happens:**
The distinction between bearer plants (CPC 27) and other biological assets (CPC 29) is counterintuitive. CPC 29 says "biological assets at fair value" — developers read this and apply it to all living things. But CPC 29 itself was amended (amendment to IAS 41 Agriculture in 2014, transposed to CPC 29) to move bearer plants to CPC 27. This amendment is not well-known among developers without accounting background.

**How to avoid:**

- Define a clear `AssetClassification` enum that explicitly separates the accounting treatment at the schema level:
  - `MACHINERY_VEHICLE` — CPC 27, depreciable
  - `BUILDING_IMPROVEMENT` — CPC 27, depreciable
  - `LAND_RURAL_PROPERTY` — CPC 27, NOT depreciable (land does not depreciate under CPC 27)
  - `BEARER_PLANT` — CPC 27, depreciable (coffee trees, orange trees, sugarcane — multi-period productive plants)
  - `BIOLOGICAL_ASSET_ANIMAL` — CPC 29, fair-value measurement (cattle herd, breeding stock)
  - `BIOLOGICAL_ASSET_OTHER` — CPC 29, fair-value measurement (non-plant, non-animal cases)
  - `IN_PROGRESS` — Imobilizado em andamento, not yet depreciable
- The depreciation engine must check `classification` before computing: `BIOLOGICAL_ASSET_*` skips the depreciation run entirely and logs a `FairValueRevaluation` event instead.
- `LAND_RURAL_PROPERTY` must never enter the depreciation run — add a guard, not just a documentation comment.
- The UI for asset creation must show a tooltip explaining bearer plants: "Plantas produtivas (café, laranja, cana) são classificadas como CPC 27 — Planta Portadora, não como ativo biológico CPC 29."

**Warning signs:**

- `AssetType` enum has `BOVINO`, `OVINO` as values inside the same enum that also has `TRATOR`, `COLHEITADEIRA` — no classification distinction for accounting treatment.
- Depreciation service applies straight-line to all assets regardless of type.
- `LAND` type asset is included in the monthly depreciation batch run.
- Coffee trees classified as `BIOLOGICAL_ASSET` subject to fair-value adjustment (should be `BEARER_PLANT` under CPC 27).

**Phase to address:** Cadastro de Ativos (Phase 1) — the classification enum must be defined at schema creation. Retrofitting this distinction after depreciation records exist requires data migration and recalculation of all historical depreciation.

---

### Pitfall 4: Maintenance OS State Machine Without Explicit Transitions — and Wrong Accounting Classification

**What goes wrong:**
Two separate problems combine in the OS (Ordem de Serviço / Work Order) module:

**Problem A — Invalid state transitions:** The OS lifecycle is `SOLICITADA → APROVADA → EM_EXECUCAO → CONCLUIDA → CANCELADA`. Without an explicit `VALID_OS_TRANSITIONS` map (same pattern as `VALID_TRANSITIONS` in `checks.types.ts` and `GR_VALID_TRANSITIONS` in `goods-receipts.types.ts`), it becomes possible to approve an already-cancelled OS, or to transition directly from `SOLICITADA` to `CONCLUIDA`, skipping execution. Maintenance history becomes unreliable.

**Problem B — Wrong accounting treatment at close:** When an OS is closed (`CONCLUIDA`), the total cost must be classified as one of three accounting treatments: (a) expense (`DESPESA` — the most common, e.g., routine repair), (b) capitalization (`CAPITALIZACAO` — improvement that extends useful life or adds functionality, per CPC 27 para 10), or (c) deferral (`DIFERIMENTO` — prepaid maintenance, e.g., scheduled overhaul amortized over future periods). If this classification is not an explicit mandatory field on OS closure, all maintenance costs default to "expense" in financial reports, and large capitalizeable overhauls are missed. This distorts both the P&L (over-expensed) and the balance sheet (understated asset book value).

**Why it happens:**
The state machine is missing because OS looks simple in the happy path. The accounting classification is missed because it requires accounting knowledge that most developers do not have — it feels like a label field, not a financially consequential decision.

**How to avoid:**

- Define `OS_VALID_TRANSITIONS` map mirroring the `VALID_TRANSITIONS` pattern from `checks.types.ts`:
  ```
  SOLICITADA:   ['APROVADA', 'CANCELADA']
  APROVADA:     ['EM_EXECUCAO', 'CANCELADA']
  EM_EXECUCAO:  ['CONCLUIDA', 'CANCELADA']
  CONCLUIDA:    []  // terminal
  CANCELADA:    []  // terminal
  ```
- At `CONCLUIDA` transition, require `accountingTreatment: 'DESPESA' | 'CAPITALIZACAO' | 'DIFERIMENTO'` as a mandatory field — the transition endpoint must return 400 if this field is missing.
- For `CAPITALIZACAO`: the OS closure must trigger an `AssetCapitalizationEvent` that increments the asset's `bookValue` and recalculates remaining depreciation from the new value. Do not allow the book value to increase silently.
- For `DIFERIMENTO`: OS cost becomes a `PrepaidExpense` record; the `DeferredMaintenanceAmortization` job amortizes it over the defined period.
- For `DESPESA`: OS cost creates a `Payable` with `category = MAINTENANCE` and `originType = 'WORK_ORDER'`, `originId = osId`. Uses the existing CP infrastructure.

**Warning signs:**

- OS service has `if (os.status === 'SOLICITADA') os.status = 'APROVADA'` instead of a transition map.
- `WorkOrder.accountingTreatment` is nullable — can be closed without it.
- A closed OS with `accountingTreatment = 'CAPITALIZACAO'` does not update `asset.bookValue`.
- No `OS_VALID_TRANSITIONS` constant in `work-orders.types.ts`.

**Phase to address:** Planos de Manutenção e Ordens de Serviço (Phase 5) — state machine and accounting treatment must be designed together, before the first OS endpoint is written.

---

### Pitfall 5: Asset Hierarchy Depth Causes Recursive Query Performance Collapse

**What goes wrong:**
The specification supports hierarchical assets (parent-child, up to 3 levels): a combine harvester (root) has a header (child) which has cutting blades (grandchildren). Features like "total book value of asset and all children," "depreciation report for asset group," and "transfer asset with all subcomponents to another farm" all require tree traversal.

If implemented as a naive recursive query (`SELECT * FROM assets WHERE parentId = X`, then repeat for each child), a 3-level hierarchy with 10 children per level requires 111 database round trips per single asset lookup. At month-end batch depreciation, this explodes to O(n log n) queries.

The alternative mistake is to limit depth via application logic but allow database foreign keys to self-reference without a depth guard, so a circular reference (Asset A → B → A) can be inserted and causes infinite recursion in tree traversal.

**Why it happens:**
Parent-child with depth = 3 looks trivial ("just a parentId FK"). The performance collapse only manifests with real data. The circular reference issue is never tested because test data is always a clean tree.

**How to avoid:**

- Use PostgreSQL recursive CTEs (`WITH RECURSIVE`) for all tree traversals — a single query returns the full subtree regardless of depth. Index on `(organizationId, parentId)`.
- Add a database check constraint enforcing maximum depth:
  ```sql
  -- enforced via application layer + trigger, or computed path
  ```
  Alternatively, use a `path` materialized column (ltree extension or simple string `'root.child.grandchild'`) that makes depth queries O(1) and prevents circular references by path validation on insert.
- Store `depth` as a computed column (0 = root, 1 = child, 2 = grandchild) and reject inserts/updates that would set `depth > 2`.
- Circular reference guard: before saving `parentId`, validate that the new parent's ancestor chain does not already contain the current asset's ID.
- Depreciation batch: fetch assets grouped by root via a single CTE, not by repeated parent traversal.

**Warning signs:**

- `asset.service.ts` has a `getAssetTree(assetId)` method that calls `findChildren()` recursively.
- No `depth` or `path` field on the `Asset` model.
- `AssetTransfer` service does not fetch child assets before moving — only the root asset changes `farmId`.
- Test fixtures have exactly 1 parent and 1 child — no 3-level test case.

**Phase to address:** Imobilizado em Andamento e Hierarquia (Phase 2) — define the `path` or `depth` column at schema creation. Retrofitting tree traversal after data exists is a migration plus service rewrite.

---

### Pitfall 6: Batch Depreciation Run Without Idempotency Guard — Creates Duplicate Entries on Retry

**What goes wrong:**
The monthly depreciation batch job runs on a cron (or manually triggered) for all active assets in the organization. If the job crashes midway (network error, server restart, PostgreSQL timeout), a partial run exists: some assets have `DepreciationEntry` records for the current month, others do not. On retry, the job either:
(a) Creates duplicate entries for assets already processed in the partial run, or
(b) Skips assets it processed before, producing an incomplete run with no error surfaced.

In production, this is discovered months later when the depreciation balance report diverges from the asset book value report by the amount of duplicated entries.

**Why it happens:**
Batch jobs are typically written as `SELECT all active assets → for each → INSERT DepreciationEntry`. There is no idempotency check: "has this asset already been depreciated for this period?" The check is obvious in hindsight but is skipped during development because tests run the job once against a clean database.

**How to avoid:**

- Add a unique constraint on `DepreciationEntry(assetId, period)` where `period` is a `YYYY-MM` string. This makes the INSERT idempotent at the database level — duplicate entries for the same asset+period throw a unique constraint violation, not a silent success.
- The batch job must use `INSERT ... ON CONFLICT (assetId, period) DO NOTHING` — PostgreSQL upsert semantics.
- Alternatively, before processing each asset, check: `SELECT COUNT(*) FROM depreciation_entries WHERE assetId = ? AND period = ?` — skip if already exists.
- Add a `DepreciationRun` record per month per organization (`status: PENDING | IN_PROGRESS | COMPLETED | FAILED`) with an `assetCount` and `processedCount` counter. A run that starts but does not reach COMPLETED is automatically retried from the first unprocessed asset.
- Never run two depreciation batches for the same period simultaneously — use PostgreSQL advisory locks (`pg_try_advisory_xact_lock`) keyed on `(organizationId, period)`.

**Warning signs:**

- No unique constraint on `(assetId, period)` in the depreciation entries table.
- Depreciation batch job has no `DepreciationRun` tracking table.
- Job implementation is `for await (const asset of assets) { await createDepreciationEntry(asset, period); }` with no idempotency check.
- Tests do not simulate a mid-batch failure and verify that retry produces exactly the same final state as a clean run.

**Phase to address:** Depreciação Automática (Phase 3) — idempotency must be designed into the schema and batch logic from the start. Retrofitting requires auditing all historical depreciation entries for duplicates.

---

### Pitfall 7: Asset Sold or Written Off Creates CR Without Voiding Remaining Depreciation

**What goes wrong:**
When an asset is sold, the following must happen atomically:

1. Asset status → `BAIXADO` (written off) or `VENDIDO`.
2. All future `DepreciationEntry` records (status `PENDING`) are cancelled.
3. A gain/loss on disposal is calculated: `salePrice - netBookValue` (where `netBookValue = acquisitionValue - accumulatedDepreciation`).
4. If sold: a `Receivable` (CR) is created for the sale price.
5. If written off at loss: a `Payable` record (the loss) or a direct P&L entry is recorded.

The common mistake is implementing step 4 (CR creation) without step 2 (cancelling pending depreciation entries). The asset is marked `VENDIDO`, the CR is created, but future monthly depreciation runs still process the asset because the query is `SELECT * FROM assets WHERE status = 'ACTIVE'` and the status was not correctly updated, or pending entries were not cleaned up. The asset depreciates for months after it was sold, accumulating phantom losses.

**Why it happens:**
Asset disposal is coded as: update `asset.status = 'VENDIDO'`, create `Receivable`. The pending depreciation entries are a separate table that nobody remembers to clean up. The status guard in the depreciation batch is often `status != 'BAIXADO'` but the status set was `'VENDIDO'` — a string mismatch.

**How to avoid:**

- Define a single terminal status for all asset disposal cases: `INATIVO` (covering VENDIDO, BAIXADO, SINISTRADO, DESCARTADO). The depreciation batch checks `status = 'ATIVO'`. Terminal status is mutually exclusive with active depreciation.
- Asset disposal must be a single `prisma.$transaction()` that atomically:
  - Updates `asset.status` to the appropriate terminal value.
  - Cancels all `DepreciationEntry` records with `status = 'PENDING'` for that asset.
  - Creates the `Receivable` or `Payable` for the disposal event.
  - Calculates and records gain/loss: `salePrice - (acquisitionValue - accumulatedDepreciation)`.
- Add a test: create asset → depreciate 3 months → sell → verify no pending depreciation entries exist → verify monthly batch does not create new entries for that asset.
- The `AssetDisposal` record must reference the `assetId`, `disposalDate`, `salePrice`, `netBookValueAtDisposal`, `gainOrLoss`, and linked `receivableId` or `payableId`.

**Warning signs:**

- `asset-disposal.service.ts` does not include `prisma.$transaction()`.
- No step cancels `DepreciationEntry` records with `status = 'PENDING'` on disposal.
- Asset disposal sets `status = 'VENDIDO'`, but the depreciation batch query filters for `status != 'BAIXADO'` — VENDIDO passes the filter.
- `AssetDisposal` table has no `gainOrLoss` column — financial impact is not tracked.

**Phase to address:** Baixa e Transferência de Ativos (Phase 4) — must be reviewed against the depreciation batch logic before implementation. The depreciation batch must be written before disposal, so disposal can correctly cancel its pending entries.

---

### Pitfall 8: CPC 06 Leasing — Right-of-Use Asset Not Depreciated Separately from Lease Liability Amortization

**What goes wrong:**
Under CPC 06 (R2) / IFRS 16, a finance lease (arrendamento financeiro or leasing) creates two obligations:

1. A right-of-use (ROU) asset that must be depreciated over the asset's useful life or the lease term (whichever is shorter).
2. A lease liability that must be amortized using the effective interest method (principal + interest components per installment).

The common mistake is treating the lease installment as a single expense entry (`Payable` per installment) and never creating the ROU asset or its depreciation. The result is that lease payments are expensed entirely as `FINANCING` in the P&L instead of being split into depreciation (balance sheet) and interest expense (P&L). This is non-compliant with CPC 06 (R2) and will be flagged in any audit.

The reverse mistake is creating the ROU asset and its depreciation but also treating the full installment as a `Payable` expense — double-counting the cost.

**Why it happens:**
Leasing "feels like" a recurring payment (similar to rent). The developer creates a `Payable` record per installment with `category = FINANCING`. This matches v1.0's rural credit installment pattern (which itself creates installments per `RuralCreditInstallment`). The two concepts look similar enough to blur.

**How to avoid:**

- Model leasing as a first-class entity: `LeasingContract` with `type: FINANCEIRO | OPERACIONAL`, total value, lease term, interest rate, residual value, and linked `Asset` (ROU).
- On `LeasingContract` creation:
  - Create the `Asset` record with `acquisitionValue = presentValueOfLease`, `assetType = RIGHT_OF_USE`, linked `leasingContractId`.
  - Generate installment schedule with principal/interest split (effective interest method — same `generateInstallments` helper with a `rateType: 'COMPOUND_MONTHLY'` option, or a new leasing-specific calculator).
  - Each installment creates a `Payable` for the total installment amount, but the `Payable` stores `principalAmount` and `interestAmount` as separate fields for P&L classification.
- The ROU asset enters the standard depreciation run — same batch as all other assets.
- The lease installment `Payable` is NOT a full expense — only `interestAmount` is P&L expense; `principalAmount` reduces the `LeasingContract.remainingLiability`.
- Operational lease (`OPERACIONAL`): much simpler — installment is fully expensed, no ROU asset, no depreciation. The type distinction must be mandatory at contract creation.
- Do not reuse the `RuralCredit` installment model for leasing — they look similar but have different accounting treatment.

**Warning signs:**

- `LeasingContract` creates a `Payable` per installment with `category = FINANCING` and no `principalAmount`/`interestAmount` split.
- No `Asset` record is created when a leasing contract is registered.
- The depreciation batch does not process any `assetType = RIGHT_OF_USE` assets.
- `LeasingContract.type` defaults to `FINANCEIRO` without the user selecting it — making all leases finance leases by default.

**Phase to address:** Integração Financeira — Leasing e Arrendamento (Phase 7) — this phase must define the data model for ROU asset + liability amortization before any UI is built.

---

### Pitfall 9: Cost Center Rateio for Shared Assets Computed at Registration Time, Not at Usage Time

**What goes wrong:**
A tractor is shared across three plots (`talhoes`) with different cost centers. The asset's cost center allocation is registered as fixed: 40% CC-Soja, 30% CC-Café, 30% CC-Milho. When the depreciation batch runs, it creates three `PayableCostCenterItem` records per asset per period, splitting the depreciation amount by these percentages.

The problem: by month 6, the soja talhão has been sold and its cost center deactivated. The 40% allocation tries to write to `costCenterId = CC-Soja` — which no longer exists or is inactive. The depreciation entry fails silently (service catches the FK constraint error and logs a warning) or creates an orphaned entry against a deleted cost center. Six months of depreciation is missing from the financial reports.

The secondary problem: the fixed allocation percentages were set at asset registration and never reviewed. In reality, usage shifts seasonally (the tractor works on café in April-June, exclusively on milho in July-September). Fixed allocation misrepresents actual cost.

**Why it happens:**
Cost center allocation is copied from the existing `PayableCostCenterItem` pattern — which works for invoices (single point-in-time allocation) but not for recurring depreciation (monthly allocation over years). The pattern is technically correct for the first month but becomes stale.

**How to avoid:**

- Model asset cost center allocation as `AssetCostCenterAllocation` with a validity period (`validFrom`, `validTo`): when the allocation changes, close the current record and open a new one. The depreciation batch uses the allocation valid at the period being depreciated.
- The depreciation batch must validate each cost center before creating `DepreciationEntry`: if a cost center is inactive, look for the most recent valid allocation and use it; if none exists, defer the entry and create an alert for the financial team.
- Provide a "Revisar alocação de centros de custo" prompt in the UI when an asset's cost center allocation has not been reviewed in 90+ days.
- For shared assets (multiple farms), depreciation rateio follows the same `CostCenterAllocMode: PERCENTAGE | FIXED_VALUE` pattern used in `PayableCostCenterItem` — do not invent a new allocation model.
- The `validateCostCenterItems` helper from `@protos-farm/shared` (used in procurement) must be reused here to validate that percentages sum to 100%.

**Warning signs:**

- `Asset.costCenterAllocation` is a JSON column with a static array — no validity period.
- Depreciation batch does not check if cost centers are active before creating entries.
- The `validateCostCenterItems` helper from `@protos-farm/shared` is not imported in the depreciation service.
- No `AssetCostCenterAllocation` history — only the current allocation is stored.

**Phase to address:** Depreciação e Centro de Custo (Phase 3) — the time-bounded allocation model must be designed at the same time as the depreciation schema.

---

### Pitfall 10: Imobilizado em Andamento (WIP Asset) Depreciates Before Activation

**What goes wrong:**
A construction project (obra em andamento) accumulates costs over months before the building/infrastructure is ready for use. Under CPC 27, depreciation begins only when the asset is "available for use in the location and condition intended by management" — i.e., after the WIP is transferred to a finalized asset record.

If the depreciation batch query is `SELECT * FROM assets WHERE status = 'ATIVO'` and the WIP asset's status is incorrectly set to `ATIVO` at creation (rather than `EM_ANDAMENTO`), it enters the depreciation run with partial cost accumulated. The result is premature depreciation against an asset that is not yet in service — non-compliant with CPC 27 and distorts early-period financial statements.

**Why it happens:**
WIP assets look like assets. The developer creates an `Asset` record immediately when the first expense is logged for the construction. The status is set to `ATIVO` because `EM_ANDAMENTO` was not defined in the status enum, or the developer did not realize the distinction matters.

**How to avoid:**

- Define `AssetStatus` enum explicitly including `EM_ANDAMENTO` for WIP. The `EM_ANDAMENTO` status must be excluded from all depreciation batch queries at the database level (add `WHERE classification != 'IN_PROGRESS'` or `WHERE status = 'ATIVO'`).
- WIP activation is a separate action: `POST /assets/:id/activate` that transitions status `EM_ANDAMENTO → ATIVO`, sets `activationDate`, and triggers the first depreciation period calculation.
- The `acquisitionValue` of the finalized asset is the sum of all partial investments recorded during the WIP phase.
- Partial WIP investments are `Payable` records with `originType = 'WIP_ASSET'`. They are NOT depreciation — they are cost accumulation.
- Add a UI step: when creating a WIP asset, require the user to explicitly schedule the "activation date" (planned) or leave it blank; the system alerts when activation date is passed without activation.

**Warning signs:**

- `AssetStatus` enum does not include `EM_ANDAMENTO` — only `ATIVO`, `INATIVO`.
- Newly created WIP asset has `status = 'ATIVO'` in the database.
- Depreciation batch query uses `status = 'ATIVO'` and processes WIP assets.
- No `activationDate` field on the `Asset` model — no way to know when WIP ended.

**Phase to address:** Imobilizado em Andamento (Phase 2) — the WIP lifecycle must be defined before the depreciation batch is written. The batch implementation must explicitly exclude `IN_PROGRESS` assets.

---

## Moderate Pitfalls

### Pitfall 11: Hours-Based Depreciation Without Horímetro Reading Enforcement

**What goes wrong:**
Agricultural machinery (tractors, combines) is often depreciated using the hours-of-use method: `depreciationPerHour = (acquisitionValue - residualValue) / totalUsefulHours`. Monthly depreciation = `hoursUsedThisMonth * depreciationPerHour`.

If the horímetro (hour meter) readings are not recorded every month, the depreciation run for that month has no data and produces R$ 0.00 depreciation. The system appears to work but the asset is under-depreciated by the missed months. Recovery requires reconstructing usage hours retroactively — often impossible.

**Prevention:**

- The depreciation batch for hours-based assets must check whether an horímetro reading exists for the period before processing. If missing, flag as `PENDING_HOURS_DATA` and skip — not silently R$ 0.00.
- Create an alert for assets with `depreciationMethod = HOURS` that lack a horímetro reading as month-end approaches (e.g., alert on day 25 of each month).
- The `HorimetroReading` entity must have a `period` field (YYYY-MM) and a unique constraint on `(assetId, period)` to prevent duplicate readings.

---

### Pitfall 12: Asset Transfer Between Farms Does Not Update Cost Center Allocation

**What goes wrong:**
When an asset is transferred from Fazenda A to Fazenda B, the cost center allocation (which references `farmId` in `PayableCostCenterItem`) still points to Fazenda A's cost centers. Depreciation after the transfer is posted to the wrong farm's P&L.

**Prevention:**

- `AssetTransfer` must trigger a mandatory review of cost center allocation — the transfer endpoint returns a 400 if the new farm's cost centers are not confirmed.
- Close the current `AssetCostCenterAllocation` on the transfer date and require creating a new allocation for the destination farm.
- Test the scenario: transfer asset on day 15 of a month → depreciation for the first 15 days goes to Farm A's cost center, remaining 15 days to Farm B's cost center (pro rata transfer treatment).

---

### Pitfall 13: Biological Asset Fair Value Update Creates Unrealized Gains That Inflate P&L

**What goes wrong:**
CPC 29 requires biological assets (cattle, breeding stock) to be remeasured at fair value at each balance sheet date. The gain/loss on remeasurement flows through the P&L. If the system auto-calculates fair value using market prices (e.g., arroba price × animal weight), a market spike creates a large unrealized gain that inflates profit — with no cash received. Farm managers may misinterpret the P&L as cash profit available for distribution.

**Prevention:**

- Fair value updates must be manual (user-confirmed) with a mandatory note field explaining the basis of valuation.
- The `FairValueRevaluation` event must be clearly labeled as "ajuste a valor justo — não representa entrada de caixa" in all P&L reports that include biological assets.
- The cash flow statement (DFC) must exclude fair value movements from operating activities and show them as non-cash items.
- MEDIUM confidence: the specific reporting treatment depends on the farm's accounting policy. Flag for validation with the customer's accountant.

---

### Pitfall 14: Parts Inventory for Maintenance Not Segregated from Main Consumable Stock

**What goes wrong:**
Maintenance parts (rolamentos, filtros, correias) are stored in the same stock database as agricultural inputs (seeds, fertilizers, pesticides). When a maintenance OS is completed and parts are consumed, the stock output uses `StockOutput.type = CONSUMPTION` — the same type used for seed planting. Cost reports cannot distinguish "input consumed in field operation" from "part consumed in maintenance." The maintenance cost KPI is inaccurate.

**Prevention:**

- Add `MAINTENANCE_PARTS` as a separate `StockOutputType` or use `Product.category = MAINTENANCE_PART` as a filter. At minimum, an OS closure that consumes parts must create `StockOutput` records with `originType = 'WORK_ORDER'` and `originId = workOrderId`.
- Alternatively, model maintenance parts as a separate inventory context: `parts_stock` vs `inputs_stock` — but this increases schema complexity. The simpler approach is to preserve the existing stock model and use `originType` tagging for reporting separation.
- Add a check at OS closure: the parts consumed must have `Product.category = MAINTENANCE_PART` — do not allow field inputs (seeds, pesticides) to be consumed via an OS.

---

### Pitfall 15: NF-e XML Import Maps Multiple Asset Lines to a Single Asset Record

**What goes wrong:**
A single NF may contain multiple items — e.g., "3 x Trator Massey Ferguson 7180" on line 1 and "1 x Grade Aradora" on line 2. If the NF-e import creates a single `Asset` record per NF (not per line item, not per asset unit), three tractors become one asset record with value 3×. Depreciation is then calculated on a single record worth 3× the individual tractor — producing the correct total depreciation but making individual asset tracking impossible.

**Prevention:**

- NF-e import must create one `Asset` record per unit per NF line item. If `quantity = 3`, it creates 3 separate `Asset` records, each with `acquisitionValue = unitPrice`.
- The import UI must show the expansion: "NF linha 1: 3 × Trator — serão criados 3 ativos individuais. Confirmar?"
- Allow the user to optionally group (e.g., create 1 asset representing the "tractor group") — but default to individual asset creation.
- The `AssetAcquisition` record links to the NF and shows all assets created from it.

---

## Minor Pitfalls

### Pitfall 16: Document Expiry Alerts Fire for Inactive Assets

**What goes wrong:**
CRLV, insurance, and revision documents tracked per asset generate alerts when they are about to expire. If the alert query does not filter by `asset.status = 'ATIVO'`, sold or written-off assets continue generating expiry alerts, cluttering the dashboard.

**Prevention:** Document expiry alert query must join `WHERE asset.status = 'ATIVO'`.

---

### Pitfall 17: Fuel Consumption Records Without Horímetro Context Prevent Cost/Hour Calculation

**What goes wrong:**
Fuel refueling records track `liters` and `cost`. Cost per hour requires dividing total fuel cost by hours operated. Without a `horómetroAtRefueling` reading on the fuel record, the cost/hour calculation falls back to estimated hours — making the metric unreliable.

**Prevention:** `FuelRecord.horímetroAtRefueling` should be required (not optional) for hour-metered machinery. For odometer-based vehicles, `odometerAtRefueling` serves the same purpose.

---

### Pitfall 18: Accumulated Depreciation Not Shown Separately in Asset Report (Net vs Gross Book Value)

**What goes wrong:**
The asset report shows only `currentBookValue = acquisitionValue - accumulatedDepreciation`. Auditors and accountants require separate disclosure of gross value and accumulated depreciation for the balance sheet (CPC 27 para 73a). If only net book value is stored, the report cannot be generated without recalculating from all depreciation entries — slow and prone to rounding drift.

**Prevention:** Store `accumulatedDepreciation` as a running total on the `Asset` record, updated atomically whenever a `DepreciationEntry` is created or cancelled. Never compute it on-the-fly in reports by summing all entries.

---

## Technical Debt Patterns

| Shortcut                                                              | Immediate Benefit              | Long-term Cost                                                                   | When Acceptable                                                      |
| --------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Asset purchase routed through GoodsReceipt → StockEntry flow          | Reuses existing receiving code | Stock balance inflated with capitalized assets; CP double-counted                | Never                                                                |
| Depreciation arithmetic with JavaScript `number` instead of `Decimal` | Simpler code                   | Rounding drift makes depreciation ledger irreconcilable over years               | Never — project already uses decimal.js                              |
| All biological assets treated as CPC 27 depreciable                   | Simpler code                   | Bearer plants: correct; cattle: non-compliant, will fail audit                   | Never for entities subject to CPC 29                                 |
| OS `accountingTreatment` field nullable                               | Simpler OS creation            | All maintenance expenses treated as OPEX; capitalizeable overhauls missed        | Never — mandatory at closure                                         |
| WIP asset created with `status = 'ATIVO'`                             | No separate activation step    | WIP depreciates from cost accumulation, not from ready-for-use date              | Never                                                                |
| Asset hierarchy traversal with N+1 recursive queries                  | Simple code                    | Depreciation batch and asset report collapse at scale (>50 child assets)         | Acceptable for MVP if depth guard is enforced and tree size is small |
| Static cost center allocation (no validity period)                    | Simpler model                  | After cost center deactivation, monthly depreciation fails silently              | Acceptable for MVP if cost center lifecycle is stable and monitored  |
| Single PayableCategory for all asset-related expenses                 | No enum migration              | Cannot separate CAPEX (acquisition) from OPEX (maintenance) in financial reports | Never — ASSET_ACQUISITION category must be distinct                  |

---

## Integration Gotchas

| Integration                               | Common Mistake                                                         | Correct Approach                                                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Payables service (asset acquisition CP)   | Using `category = OTHER` or `MAINTENANCE` for asset purchase           | Add and use `ASSET_ACQUISITION` enum value; set `originType = 'ASSET_ACQUISITION'`, `originId = assetId`                    |
| Payables service (OS maintenance expense) | Creating CP directly from OS without `originType`                      | OS creates CP with `originType = 'WORK_ORDER'`, `originId = workOrderId`; `category = MAINTENANCE`                          |
| Receivables service (asset sale CR)       | Creating CR without gain/loss calculation                              | Asset sale creates `Receivable` with `originType = 'ASSET_DISPOSAL'`; a separate `AssetDisposal` record stores `gainOrLoss` |
| Stock entries (maintenance parts)         | Parts consumption uses `CONSUMPTION` type identically to field inputs  | Tag with `originType = 'WORK_ORDER'` or add `MAINTENANCE_PARTS` output type for reporting separation                        |
| Depreciation batch (cost centers)         | Using `PayableCostCenterItem` pattern directly without validity period | Create `AssetCostCenterAllocation` with `validFrom`/`validTo`; reuse `validateCostCenterItems` from `@protos-farm/shared`   |
| GoodsReceipt service (asset on PO)        | Routing asset-type PO lines through standard stock-entry creation      | Guard in GoodsReceipt service: if PO line is ASSET category, redirect to AssetAcquisition flow, do not create StockEntry    |
| Leasing installments (LeasingContract)    | Reusing RuralCredit installment pattern with `category = FINANCING`    | Leasing installments split into principal (reduces liability) and interest (P&L expense); ROU asset depreciated separately  |

---

## Performance Traps

| Trap                                                                                       | Symptoms                                                 | Prevention                                                                                              | When It Breaks                      |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Depreciation batch with N+1 asset hierarchy traversal                                      | Month-end batch runs 30+ minutes with large asset tree   | Use PostgreSQL recursive CTE; fetch all subtrees in one query                                           | >50 child assets per organization   |
| No idempotency guard on depreciation batch                                                 | Partial run on crash produces duplicate entries on retry | Unique constraint on `(assetId, period)`; advisory lock on `(organizationId, period)`                   | Every server restart mid-batch      |
| Accumulated depreciation computed from SUM of all entries on every report load             | Asset report page times out                              | Maintain running `accumulatedDepreciation` column on `Asset`; update atomically per `DepreciationEntry` | >200 depreciation entries per asset |
| Cost center allocation validation (sum = 100%) computed by fetching all allocation records | Slow validation on asset save with many allocations      | In-memory validation at service layer before transaction; do not re-query after INSERT                  | >20 cost center items per asset     |
| Fair value batch update for all biological assets without batching                         | OOM or timeout if org has large cattle herd              | Process biological asset revaluation in batches of 100; use `cursor`-based pagination                   | >500 biological assets              |
| Document expiry alert query joining all assets without index                               | Slow dashboard load                                      | Index on `(organizationId, expiryDate)` on asset documents table; exclude `status != 'ATIVO'` assets    | >1,000 asset documents              |

---

## Security Mistakes

| Mistake                                                        | Risk                                                                          | Prevention                                                                                                                                                                             |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset acquisition endpoint accessible to `OPERATOR` role       | Field operator registers unauthorized capital expenditures                    | `assets:create` permission limited to `MANAGER`, `FINANCIAL`, `ADMIN` roles; mobile flow for maintenance requests, not asset creation                                                  |
| Depreciation run triggerable via API by any authenticated user | Malicious or accidental double-run produces duplicate entries                 | Depreciation run endpoint requires `assets:depreciate` permission (`FINANCIAL` or `ADMIN` only); idempotency constraint at database level as last resort                               |
| Asset book value visible in list API to all roles              | Confidential asset valuation exposed to field workers                         | Book value, acquisition value, and depreciation details returned only for `FINANCIAL`, `MANAGER`, `ADMIN` roles; `OPERATOR` sees only operational fields (status, location, documents) |
| OS accounting treatment selectable by maintenance technician   | Technician classifies routine repair as capitalization to inflate asset value | `accountingTreatment` selection on OS closure requires `FINANCIAL` or `MANAGER` role; technician can close OS but accounting classification is locked to authorized users              |

---

## UX Pitfalls

| Pitfall                                                                                         | User Impact                                                                      | Better Approach                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Depreciation run triggered manually with no progress feedback                                   | User clicks "Executar Depreciação" and sees nothing for 30 seconds, clicks again | Show progress: "Processando X de Y ativos..." with a cancel option; disable button during run                                                                                      |
| OS closure form shows `accountingTreatment` as a dropdown with three options and no explanation | Maintenance team selects wrong treatment (CAPITALIZACAO for a simple oil change) | Show contextual help: "Capitalização: melhora ou estende vida útil. Despesa: manutenção de rotina. Diferimento: reforma planejada com amortização futura." Link to CPC 27 summary. |
| Asset transfer form does not show current cost center allocation                                | User transfers asset without realizing cost center must be updated for new farm  | Show current allocation in read-only panel on transfer form; require confirmation that allocation will be updated                                                                  |
| Biological asset fair value update with no cash flow warning                                    | Manager sees large P&L gain, assumes profit available for distribution           | Show inline: "Ajuste a valor justo de R$ X,XXX — não representa entrada de caixa. Não afeta o saldo bancário."                                                                     |
| Imobilizado em andamento shows depreciation amount of R$ 0.00 in asset list                     | Manager thinks the WIP asset is depreciating at zero                             | Show "Em andamento — depreciação inicia na ativação" instead of R$ 0.00                                                                                                            |
| Document expiry dashboard shows expired documents for deactivated assets                        | Cluttered dashboard with irrelevant alerts                                       | Filter document alerts to `asset.status = 'ATIVO'` assets only; show count of inactive assets with expired documents as a collapsed section                                        |

---

## "Looks Done But Isn't" Checklist

- [ ] **Asset Purchase CP:** Often uses `category = OTHER` — verify `Payable.category = ASSET_ACQUISITION` and `originType = 'ASSET_ACQUISITION'` for all asset acquisition CP records.
- [ ] **No StockEntry for Assets:** Often routes through GoodsReceipt — verify no `StockEntry` record exists with `originType = 'ASSET_ACQUISITION'`.
- [ ] **Depreciation Arithmetic:** Often uses float — verify that a tractor depreciated over 84 months reaches exactly `residualValue` at month 84 (not ±R$ 0.36).
- [ ] **CPC 29 Biological Assets:** Often depreciated — verify that cattle records have no `DepreciationEntry` records; verify that coffee trees have `classification = BEARER_PLANT` and DO have depreciation entries.
- [ ] **WIP Not Depreciated:** Often `status = 'ATIVO'` prematurely — verify that a newly created WIP asset with `status = 'EM_ANDAMENTO'` produces R$ 0.00 depreciation in the batch run.
- [ ] **Batch Idempotency:** Often no guard — verify that running the depreciation batch twice for the same period produces the same number of entries as running it once (second run is a no-op due to unique constraint).
- [ ] **Asset Disposal Cleans Pending Entries:** Often missed — verify that after asset sale, no `DepreciationEntry` with `status = 'PENDING'` exists for that asset; verify next batch run does not process the sold asset.
- [ ] **OS Accounting Treatment Mandatory:** Often nullable — verify that closing an OS via `PATCH /work-orders/:id/close` without `accountingTreatment` returns 400.
- [ ] **Cost Center Validation:** Often unchecked — verify that an asset with allocation 50% CC-A + 40% CC-B (sum = 90%) returns 400 on save.
- [ ] **Leasing ROU Asset:** Often missing — verify that creating a `LeasingContract` with `type = FINANCEIRO` creates an `Asset` record with `assetType = RIGHT_OF_USE` in the database.
- [ ] **Hierarchy Depth Guard:** Often unbounded — verify that attempting to set an asset's `parentId` to its own grandchild (circular reference) returns 400.
- [ ] **Land Not Depreciated:** Often included in batch — verify that an asset with `classification = LAND_RURAL_PROPERTY` has R$ 0.00 depreciation after batch run.

---

## Recovery Strategies

| Pitfall                                                                                 | Recovery Cost | Recovery Steps                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset purchases already creating StockEntry records discovered in production            | HIGH          | Audit all `StockEntry` records with `product.category = ASSET`; reverse stock balance for affected items; reprocess as `AssetAcquisition`; financial reporting for affected periods must be regenerated |
| Depreciation computed with float arithmetic — accumulated rounding drift                | HIGH          | Recalculate all `DepreciationEntry` records using Decimal arithmetic; compare with stored values; create adjustment entries for the difference; audit trail required for accounting sign-off            |
| Biological assets (cattle) have depreciation entries instead of fair value revaluations | MEDIUM        | Identify all `DepreciationEntry` records for `classification = BIOLOGICAL_ASSET_*` assets; void them; create compensating entries; requires accountant review                                           |
| WIP assets with premature depreciation entries                                          | MEDIUM        | Identify `DepreciationEntry` records for assets with `activationDate > entryDate`; void premature entries; recalculate from correct activation date                                                     |
| Batch run created duplicate entries for same period                                     | LOW           | Delete duplicates using unique constraint violation analysis; unique constraint prevents future occurrences after it is added                                                                           |
| Asset disposed without cancelling pending depreciation entries                          | MEDIUM        | Write script: for each disposed asset with `status != 'ATIVO'`, void all `DepreciationEntry` records with `status = 'PENDING'`; verify net book values                                                  |

---

## Pitfall-to-Phase Mapping

| Pitfall                                         | Prevention Phase                        | Verification                                                                                                                                   |
| ----------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Asset purchase double-counting via GoodsReceipt | Cadastro e Aquisição (Phase 1)          | No StockEntry created for asset-category products; CP has `originType = ASSET_ACQUISITION`; `GoodsReceipt` service rejects asset-type PO lines |
| CPC 27 vs CPC 29 classification confusion       | Cadastro de Ativos (Phase 1)            | `AssetClassification` enum has explicit CPC mapping; bearer plants classified as `BEARER_PLANT`; cattle as `BIOLOGICAL_ASSET_ANIMAL`           |
| WIP asset premature depreciation                | Imobilizado em Andamento (Phase 2)      | WIP asset with `status = EM_ANDAMENTO` produces R$0 in depreciation batch; batch query excludes `IN_PROGRESS` classification                   |
| Asset hierarchy N+1 query performance           | Imobilizado em Andamento (Phase 2)      | Tree traversal uses recursive CTE; `depth` or `path` column enforces max depth; circular reference returns 400                                 |
| Depreciation decimal precision                  | Depreciação Automática (Phase 3)        | 84-month depreciation ends at exactly residual value; all arithmetic via Decimal                                                               |
| Depreciation batch idempotency                  | Depreciação Automática (Phase 3)        | Double batch run produces identical result as single run; unique constraint on (assetId, period)                                               |
| Cost center allocation staleness                | Depreciação e Centro de Custo (Phase 3) | After cost center deactivation, batch skips and alerts; allocation has validity period                                                         |
| Asset disposal missing pending entry cleanup    | Baixa e Transferência (Phase 4)         | Sold asset has zero PENDING depreciation entries; next batch ignores sold assets                                                               |
| OS state machine invalid transitions            | Manutenção e OS (Phase 5)               | Direct API call with invalid transition returns 409; OS_VALID_TRANSITIONS is source of truth                                                   |
| OS accounting treatment missing                 | Manutenção e OS (Phase 5)               | Close OS without accountingTreatment returns 400; CAPITALIZACAO updates asset.bookValue                                                        |
| Leasing ROU asset not created                   | Leasing e Arrendamento (Phase 7)        | LeasingContract FINANCEIRO creates Asset(RIGHT_OF_USE) + amortization schedule; depreciation batch processes ROU asset                         |
| Hours-based depreciation with missing horímetro | Operacional (Phase 6)                   | Assets with HOURS method and no horímetro reading flagged as PENDING_HOURS_DATA, not R$0                                                       |

---

## Sources

- Codebase analysis: `apps/backend/prisma/schema.prisma` — `PayableCategory` enum (no `ASSET_ACQUISITION` value; must be added); `Payable.originType`/`originId` pattern confirmed; `Decimal(15, 2)` precision standard (HIGH confidence)
- Codebase analysis: `apps/backend/src/modules/checks/checks.types.ts` — `VALID_TRANSITIONS` pattern for state machine; adopted by `goods-receipts.types.ts` as `GR_VALID_TRANSITIONS` (HIGH confidence)
- Codebase analysis: `apps/backend/src/modules/payables/payables.types.ts` — `Money` factory confirmed; `generateInstallments` imported; `CostCenterItemInput` pattern for allocation (HIGH confidence)
- Codebase analysis: `apps/backend/src/modules/goods-receipts/goods-receipts.types.ts` — 6-scenario receiving state machine confirmed; `GR_VALID_TRANSITIONS` pattern (HIGH confidence)
- CPC 27 (IAS 16) — Ativo Imobilizado: depreciation start on "available for use," bearer plants under CPC 27 after 2014 amendment, no depreciation for land, componentization rules (HIGH confidence — official Brazilian accounting standard)
- CPC 29 (IAS 41) — Ativos Biológicos: fair value measurement for non-bearer biological assets, cattle and breeding stock treatment (HIGH confidence — official Brazilian accounting standard)
- CPC 06 R2 (IFRS 16) — Arrendamentos: ROU asset creation, liability amortization, financial vs operational lease distinction (HIGH confidence — official Brazilian accounting standard, verified via KPMG Brasil guide and CVM publication)
- Domain knowledge: depreciation pro rata die calculation, last-period balancing entry (HIGH confidence — standard ERP accounting, corroborated by SAP support note 2748419 and Odoo community discussion on Decimal rounding)
- Domain knowledge: PostgreSQL recursive CTE for hierarchy traversal, advisory locks for batch idempotency (HIGH confidence — official PostgreSQL documentation patterns)
- Web search: agricultural machinery depreciation methods in Brazil (hours-of-use, linear, accelerated) — Aegro blog on custo operacional, Afixcode on cálculo de depreciação (MEDIUM confidence — industry sources, not CPC)
- Web search: batch depreciation performance, concurrent PostgreSQL lock contention (MEDIUM confidence — multiple AWS and PostgreSQL community sources, no specific benchmark for this codebase's scale)
- Domain knowledge: CPC 29 fair value subjectivity for unlisted biological assets (MEDIUM confidence — academic literature confirmed; specific P&L treatment in farm management context not verified against a specific auditor's guidance)

---

_Pitfalls research for: Asset Management, Depreciation, Maintenance OS, and Financial Integration (v1.2 Gestão de Patrimônio) added to existing financial + purchasing + stock ERP_
_Researched: 2026-03-19_
