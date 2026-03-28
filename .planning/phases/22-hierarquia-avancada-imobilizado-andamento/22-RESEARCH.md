# Phase 22: Hierarquia Avancada e Imobilizado em Andamento — Research

**Researched:** 2026-03-22
**Domain:** Asset hierarchy (parent-child composite), asset renovation/capitalization, work-in-progress (WIP) assets with staged contributions
**Confidence:** HIGH

## Summary

Phase 22 introduces three advanced patrimonial scenarios that extend the existing `Asset` model without breaking any of the 21 previously completed phases. The schema foundation is already in place: `parentAssetId` self-referential FK with `AssetHierarchy` relation, `AssetStatus.EM_ANDAMENTO` enum value, and the `WorkOrderAccountingTreatment.CAPITALIZACAO` path that bumps `acquisitionValue` on an asset. What does NOT yet exist are: (a) enforcement of the 3-level depth limit on hierarchy, (b) a dedicated `AssetRenovation` model for explicit reforma/ampliacao events with their own accounting decision record, and (c) an `AssetWipContribution` model + `AssetWipStage` model for imobilizado-em-andamento with budget tracking, staged contributions, and an activate endpoint that transitions `EM_ANDAMENTO` → `ATIVO` and starts depreciation.

The depreciation batch already excludes `EM_ANDAMENTO` assets (confirmed in `depreciation-batch.service.ts` line 61: `status: { notIn: ['EM_ANDAMENTO', 'ALIENADO'] }`). The activation endpoint in Phase 22 simply sets `status = ATIVO` and optionally sets `acquisitionDate` to today — the next depreciation run will then pick it up automatically. No changes needed to the batch job.

The HIER-02 reforma/ampliacao scenario is related to but distinct from the `WorkOrder CAPITALIZACAO` path (MANU-06). MANU-06 capitalizes a maintenance OS cost atomically on close. HIER-02 is a standalone reforma event — not tied to an OS — with its own form, explicit user decision (capitalizar vs despesa), and a new `AssetRenovation` record for audit history. The service pattern is identical (increment `acquisitionValue`, optionally update `DepreciationConfig.usefulLifeMonths`), but the entry point and data model differ.

**Primary recommendation:** Build in 3 plans — Wave 0 (spec stubs + schema migration for 3 new models), backend (HIER-01 hierarchy enforcement + HIER-02 renovation + HIER-03 WIP endpoints), frontend (hierarchy tree display in AssetDrawer + RenovationModal + WipContributionsTab).

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                                           | Research Support                                                                                                                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HIER-01 | Gerente pode cadastrar ativo composto (hierarquia pai-filho ate 3 niveis) onde o pai totaliza valores dos filhos e cada filho tem depreciacao independente            | `parentAssetId` FK already in Asset model; need depth-limit guard in createAsset/updateAsset; `childAssets` relation already in ASSET_INCLUDE_FULL; aggregation query for parent totals                     |
| HIER-02 | Gerente pode registrar reforma ou ampliacao de ativo existente com decisao de capitalizar (soma ao valor contabil + reavalia vida util) ou despesa (vai para DRE)     | New `AssetRenovation` model; same increment pattern as MANU-06 CAPITALIZACAO; optionally patches `DepreciationConfig.usefulLifeMonths`; DESPESA path records event without touching acquisitionValue        |
| HIER-03 | Gerente pode registrar imobilizado em andamento acumulando aportes parciais com cronograma de etapas, alerta de orcamento e ativacao ao concluir (inicia depreciacao) | Asset already has `EM_ANDAMENTO` status; new `AssetWipContribution` + `AssetWipStage` models; activate endpoint sets `status=ATIVO` + `acquisitionDate`; depreciation batch already excludes `EM_ANDAMENTO` |

</phase_requirements>

---

## Standard Stack

### Core

| Library    | Version | Purpose                                                                     | Why Standard                                                   |
| ---------- | ------- | --------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Prisma     | 7.x     | ORM + new migrations (AssetRenovation, AssetWipContribution, AssetWipStage) | Already in use; consistent with all prior phases               |
| decimal.js | ^10.6.0 | Monetary arithmetic for renovation value, WIP budget tracking               | STATE.md locked decision; used in every service touching money |
| Express 5  | 5.x     | HTTP routes for renovation + WIP endpoints                                  | All modules follow routes.ts + service.ts + types.ts pattern   |

### Supporting

| Library                         | Version | Purpose                                                  | When to Use                            |
| ------------------------------- | ------- | -------------------------------------------------------- | -------------------------------------- |
| lucide-react                    | current | UI icons (Layers, Construction, PlusCircle, CheckCircle) | AssetHierarchyTab, WipContributionsTab |
| Vitest + @testing-library/react | current | Frontend spec                                            | Any new component spec                 |
| Jest + @swc/jest                | current | Backend spec                                             | All routes.spec.ts files               |

### Alternatives Considered

| Instead of                      | Could Use                          | Tradeoff                                                                                                                 |
| ------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Dedicated AssetRenovation model | Reuse WorkOrder with CAPITALIZACAO | WorkOrder requires parts/labor tracking — overkill for a direct reforma event; dedicated model gives cleaner audit trail |
| AssetWipContribution rows       | Single aggregate field on Asset    | Per-contribution rows enable timeline, per-stage alerts, and reversal — required by HIER-03                              |
| Depth guard in service          | DB constraint (recursive CTE)      | Recursive CTEs in Prisma are verbose; service-layer depth traversal (3 levels max) is simpler and testable               |

**Installation:** No new packages needed. All required libraries are already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
apps/backend/src/modules/asset-renovations/
├── asset-renovations.routes.ts        # POST (create) + GET (list by asset)
├── asset-renovations.routes.spec.ts
├── asset-renovations.service.ts       # createRenovation: capitalizar path increments acquisitionValue + optional usefulLifeMonths patch; despesa path records only
└── asset-renovations.types.ts

apps/backend/src/modules/asset-wip/
├── asset-wip.routes.ts                # POST contribution + GET summary + POST activate + GET stages
├── asset-wip.routes.spec.ts
├── asset-wip.service.ts               # addContribution, activateWip, listContributions, budget alert logic
└── asset-wip.types.ts

apps/backend/src/modules/assets/assets.service.ts
  # PATCH: add 3-level depth guard to createAsset + updateAsset (parentAssetId)
  # GET /:id: include childAssets recursively up to 3 levels (select only)

apps/frontend/src/components/assets/
├── AssetHierarchyTab.tsx              # Tree view of parent + children up to 3 levels; shows totalized value
├── AssetHierarchyTab.css
├── AssetRenovationModal.tsx           # Form: descricao, valor, data, decisao (CAPITALIZAR | DESPESA), nova_vida_util opcional
├── AssetRenovationModal.css
├── AssetWipContributionsTab.tsx       # List of contributions + stages progress bar + budget alert + Ativar button
└── AssetWipContributionsTab.css

apps/frontend/src/hooks/
├── useAssetHierarchy.ts               # GET /:id with depth=3 param
├── useAssetRenovation.ts              # POST renovation + list
└── useAssetWip.ts                     # POST contribution + GET summary + POST activate
```

### Pattern 1: 3-Level Depth Guard

**What:** Before setting `parentAssetId`, traverse upward to count levels. Reject if depth would exceed 3.
**When to use:** On `createAsset` and `updateAsset` when `parentAssetId` is provided.

```typescript
// Source: pattern derived from OperationType hierarchy in schema (line 2166)
async function getAncestorDepth(tx: TxClient, assetId: string, orgId: string): Promise<number> {
  let depth = 0;
  let current: { parentAssetId: string | null } | null = await tx.asset.findFirst({
    where: { id: assetId, organizationId: orgId, deletedAt: null },
    select: { parentAssetId: true },
  });
  while (current?.parentAssetId) {
    depth++;
    if (depth >= 3) throw new AssetError('Hierarquia maxima de 3 niveis atingida', 400);
    current = await tx.asset.findFirst({
      where: { id: current.parentAssetId, organizationId: orgId },
      select: { parentAssetId: true },
    });
  }
  return depth;
}
// Call: before setting parentAssetId in createAsset/updateAsset
// await getAncestorDepth(tx, input.parentAssetId, ctx.organizationId);
// This counts levels ABOVE the candidate parent.
// Result depth=0 means parent is root → child is level 1 → grandchild at level 2 → ok for 3 levels total.
// Result depth=2 means adding child would be level 3 → ok.
// Result depth=3 means would exceed limit → throw.
```

### Pattern 2: Parent Value Totalization

**What:** GET /assets/:id with `?includeChildren=true` returns parent with aggregated `totalChildValue`.
**When to use:** When loading an asset that has `childAssets`.

```typescript
// Aggregate children acquisitionValue recursively via Prisma nested includes
// Up to 3 levels: childAssets → childAssets → childAssets (limited depth)
const asset = await tx.asset.findFirst({
  where: { id, organizationId: ctx.organizationId, deletedAt: null },
  include: {
    ...ASSET_INCLUDE_FULL,
    childAssets: {
      include: {
        childAssets: {
          include: { childAssets: true },
        },
      },
    },
  },
});

function sumChildValues(asset: AssetWithChildren): Decimal {
  let total = new Decimal(0);
  for (const child of asset.childAssets ?? []) {
    if (child.acquisitionValue) total = total.plus(child.acquisitionValue);
    total = total.plus(sumChildValues(child));
  }
  return total;
}
```

### Pattern 3: AssetRenovation — Capitalization Path

**What:** Record a reforma/ampliacao event; if CAPITALIZAR, increment `acquisitionValue` and optionally patch `DepreciationConfig.usefulLifeMonths`.
**When to use:** HIER-02, triggered from RenovationModal on asset detail page.

```typescript
// Source: derived from work-orders.service.ts line 461 — CAPITALIZACAO path
export async function createRenovation(
  ctx: RlsContext,
  assetId: string,
  input: CreateRenovationInput,
) {
  return prisma.$transaction(async (tx) => {
    const asset = await tx.asset.findFirst({
      where: { id: assetId, organizationId: ctx.organizationId, deletedAt: null },
    });
    if (!asset) throw new RenovationError('Ativo nao encontrado', 404);
    if (asset.status === 'ALIENADO')
      throw new RenovationError('Ativo alienado nao pode ser reformado', 400);

    const renovation = await tx.assetRenovation.create({
      data: {
        organizationId: ctx.organizationId,
        assetId,
        description: input.description,
        renovationDate: new Date(input.renovationDate),
        totalCost: new Decimal(input.totalCost),
        accountingDecision: input.accountingDecision, // CAPITALIZAR | DESPESA
        newUsefulLifeMonths: input.newUsefulLifeMonths ?? null,
        notes: input.notes ?? null,
      },
    });

    if (input.accountingDecision === 'CAPITALIZAR') {
      await tx.asset.update({
        where: { id: assetId },
        data: { acquisitionValue: { increment: new Decimal(input.totalCost).toNumber() } },
      });
      if (input.newUsefulLifeMonths) {
        await tx.depreciationConfig.updateMany({
          where: { assetId, organizationId: ctx.organizationId },
          data: { usefulLifeMonths: input.newUsefulLifeMonths },
        });
      }
    }
    // DESPESA path: renovation record only — DRE treatment is outside module scope

    return renovation;
  });
}
```

### Pattern 4: WIP Asset Lifecycle

**What:** Asset created with `status=EM_ANDAMENTO`; contributions accumulate; budget alert fires when `totalContributed >= budgetWarningThreshold`; activate endpoint transitions to `ATIVO`.
**When to use:** HIER-03 — construction projects, long-horizon asset builds.

```typescript
// Activation — starts depreciation on next batch run
export async function activateWipAsset(ctx: RlsContext, assetId: string, input: ActivateWipInput) {
  return prisma.$transaction(async (tx) => {
    const asset = await tx.asset.findFirst({
      where: {
        id: assetId,
        organizationId: ctx.organizationId,
        status: 'EM_ANDAMENTO',
        deletedAt: null,
      },
    });
    if (!asset) throw new WipError('Ativo em andamento nao encontrado', 404);

    // Sum all contributions to set final acquisitionValue
    const { _sum } = await tx.assetWipContribution.aggregate({
      where: { assetId, organizationId: ctx.organizationId },
      _sum: { amount: true },
    });
    const totalContributed = new Decimal(_sum.amount ?? 0);

    await tx.asset.update({
      where: { id: assetId },
      data: {
        status: 'ATIVO',
        acquisitionDate: input.activationDate ? new Date(input.activationDate) : new Date(),
        acquisitionValue: totalContributed.toNumber(),
      },
    });

    return { assetId, finalValue: totalContributed.toNumber() };
  });
}
```

### Pattern 5: Budget Alert

**What:** After adding a contribution, check `totalContributed / budget > warningThreshold (e.g. 0.9)`. Return `budgetAlert: true` in response.
**When to use:** Every `POST /asset-wip/:assetId/contributions` call.

```typescript
// Source: pattern derived from stock-alerts module (budget warning pattern)
const summary = await getWipSummary(ctx, assetId);
const ratio = summary.totalContributed / summary.budget;
return {
  contribution,
  budgetAlert: ratio >= 0.9,
  budgetExceeded: summary.totalContributed > summary.budget,
  totalContributed: summary.totalContributed,
};
```

### Anti-Patterns to Avoid

- **Setting parentAssetId without depth check:** Leads to unbounded chains and circular reference risk. Always traverse upward before allowing a new parent link.
- **Calling activateWip without aggregating contributions:** Leaves `acquisitionValue` at null or acquisition-time value rather than actual WIP total. Always aggregate before setting final value.
- **Patching `usefulLifeMonths` via `updateMany` without verifying config exists:** `updateMany` with no matching rows silently succeeds — acceptable, but document clearly. Do not throw if no config exists yet.
- **Nesting `withRlsContext` inside `prisma.$transaction`:** Confirmed pattern from STATE.md Phase 19/20 decisions — use `prisma.$transaction` directly, NOT `withRlsContext`, in asset module transactions.
- **Using `window.confirm()` for WIP activation:** Must use `ConfirmModal` with `variant="warning"` per CLAUDE.md. Activation is medium-criticality (irreversible status change).

---

## Schema Changes Required

Three new models needed. No changes to existing Asset model columns (all required fields already exist).

### Model 1: AssetRenovation

```prisma
// New enum for renovation accounting decision
enum AssetRenovationDecision {
  CAPITALIZAR   // Adds to acquisitionValue + optionally updates usefulLifeMonths
  DESPESA       // DRE — no balance sheet effect
}

model AssetRenovation {
  id                  String                   @id @default(uuid())
  organizationId      String
  assetId             String
  description         String
  renovationDate      DateTime
  totalCost           Decimal                  @db.Decimal(15, 2)
  accountingDecision  AssetRenovationDecision
  newUsefulLifeMonths Int?                     // only relevant for CAPITALIZAR
  notes               String?
  createdAt           DateTime                 @default(now())

  asset        Asset        @relation(fields: [assetId], references: [id])
  organization Organization @relation(fields: [organizationId], references: [id])

  @@index([assetId])
  @@index([organizationId])
  @@map("asset_renovations")
}
```

Add to Asset model:

```prisma
renovations AssetRenovation[]
```

### Model 2: AssetWipStage (optional — for stage milestones)

```prisma
model AssetWipStage {
  id             String   @id @default(uuid())
  organizationId String
  assetId        String
  name           String
  targetDate     DateTime?
  completedAt    DateTime?
  notes          String?
  sortOrder      Int      @default(0)
  createdAt      DateTime @default(now())

  asset        Asset        @relation(fields: [assetId], references: [id])
  organization Organization @relation(fields: [organizationId], references: [id])

  @@index([assetId])
  @@map("asset_wip_stages")
}
```

### Model 3: AssetWipContribution

```prisma
model AssetWipContribution {
  id              String   @id @default(uuid())
  organizationId  String
  assetId         String
  stageId         String?             // optional link to a stage
  contributionDate DateTime
  amount          Decimal             @db.Decimal(15, 2)
  description     String
  supplierId      String?
  invoiceRef      String?
  notes           String?
  createdAt       DateTime @default(now())

  asset        Asset          @relation(fields: [assetId], references: [id])
  organization Organization   @relation(fields: [organizationId], references: [id])
  stage        AssetWipStage? @relation(fields: [stageId], references: [id])

  @@index([assetId])
  @@index([organizationId])
  @@map("asset_wip_contributions")
}
```

Add to Asset model:

```prisma
wipContributions AssetWipContribution[]
wipStages        AssetWipStage[]
```

**WIP budget fields** must be added to Asset model:

```prisma
wipBudget          Decimal?  @db.Decimal(15, 2)  // total authorized budget for obra
wipBudgetAlertPct  Decimal?  @db.Decimal(5, 2)   // default 90.00 (%)
```

These are nullable — only populated for `EM_ANDAMENTO` assets.

---

## Don't Hand-Roll

| Problem                                    | Don't Build            | Use Instead                                                         | Why                                                                                                                          |
| ------------------------------------------ | ---------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Circular reference prevention in hierarchy | Custom graph traversal | Simple upward depth counter (3 max)                                 | Problem is bounded at 3 levels — a recursive CTE is unnecessary complexity                                                   |
| Budget alert notification                  | Push/email system      | Response flag `budgetAlert: boolean`                                | In-scope is the alert flag on the API response + frontend warning banner — push notifications are EPIC-13 territory          |
| Accounting journal entries for DESPESA     | DRE module integration | `accountingDecision` field only                                     | DRE module does not exist yet — record the decision, leave integration for future phase                                      |
| Depreciation restart logic on activation   | New batch job          | Set `acquisitionDate` + `status=ATIVO` + let existing batch pick up | The existing batch already queries `status NOT IN ['EM_ANDAMENTO', 'ALIENADO']` — activation just moves the asset into scope |

---

## Common Pitfalls

### Pitfall 1: Circular Hierarchy Reference

**What goes wrong:** Setting `parentAssetId` to a descendant creates a cycle. DB does not prevent this by default.
**Why it happens:** Self-referential FK allows any valid UUID as parent.
**How to avoid:** In `createAsset` / `updateAsset`, verify the proposed parent is not a descendant of the current asset. Since depth is limited to 3, a simple 3-step upward traversal is sufficient and can double as the cycle detector.
**Warning signs:** Infinite loop in `sumChildValues` helper; test for this explicitly.

### Pitfall 2: WIP Activation Without DepreciationConfig

**What goes wrong:** Asset is activated (status → ATIVO) but has no `DepreciationConfig`. Next batch run skips it silently (no config = no entry). Accountant never gets depreciation.
**Why it happens:** Config creation was optional in Phase 17 — only explicitly configured assets get depreciated.
**How to avoid:** On `activateWip`, check if `DepreciationConfig` exists. If not, return a `depreciationConfigMissing: true` flag in the response and display a warning banner in the frontend prompting the accountant to configure depreciation.

### Pitfall 3: Parent Value Totalizing Stale Data

**What goes wrong:** Parent shows total value including disposed/alienated children.
**Why it happens:** `sumChildValues` traverses all `childAssets` without status filter.
**How to avoid:** In the aggregation helper, skip children with `status === 'ALIENADO'` or `deletedAt != null`.

### Pitfall 4: Renovation on EM_ANDAMENTO Asset

**What goes wrong:** Reforma registered against an asset that is still under construction — semantically incorrect.
**Why it happens:** No guard in renovation service.
**How to avoid:** `createRenovation` must reject assets with `status === 'EM_ANDAMENTO'` or `status === 'ALIENADO'`. Return 400 with clear message.

### Pitfall 5: Budget Alert Threshold Off-By-One

**What goes wrong:** Alert fires even when contribution exactly equals budget (100%), conflating "alert" with "exceeded".
**How to avoid:** Use two distinct flags: `budgetAlert` (>= `wipBudgetAlertPct`%, default 90%) and `budgetExceeded` (total > budget). Frontend shows different UI for each.

---

## Code Examples

### Hierarchy Depth Guard (verified pattern)

```typescript
// Source: existing OperationType.children pattern in prisma schema + STATE.md hierarchy decision
async function checkHierarchyDepth(
  tx: TxClient,
  proposedParentId: string,
  orgId: string,
): Promise<void> {
  let depth = 1; // the child being added is at depth 1 relative to parent
  let currentId: string | null = proposedParentId;

  while (currentId) {
    const node = await tx.asset.findFirst({
      where: { id: currentId, organizationId: orgId },
      select: { parentAssetId: true },
    });
    if (!node) break;
    if (node.parentAssetId) {
      depth++;
      if (depth >= 3) {
        throw new AssetError('Limite de 3 niveis de hierarquia atingido', 400);
      }
    }
    currentId = node.parentAssetId;
  }
}
```

### WIP Summary Endpoint Response Shape

```typescript
// GET /org/:orgId/asset-wip/:assetId/summary
interface WipSummaryResponse {
  assetId: string;
  assetName: string;
  assetTag: string;
  status: 'EM_ANDAMENTO';
  budget: number | null;
  budgetAlertPct: number; // default 90
  totalContributed: number;
  contributionCount: number;
  budgetAlert: boolean;
  budgetExceeded: boolean;
  stages: WipStageItem[];
  contributions: WipContributionItem[];
}
```

### Frontend: AssetHierarchyTab Props

```typescript
// New tab added to AssetDrawer TABS array
// id: 'hierarquia', label: 'Hierarquia'
// Only shown when: asset.parentAsset || (asset.childAssets && asset.childAssets.length > 0)
interface AssetHierarchyTabProps {
  asset: Asset;
  onNavigate: (assetId: string) => void; // navigate to parent or child in drawer
}
```

---

## State of the Art

| Old Approach                                                     | Current Approach                                                     | When Changed | Impact                              |
| ---------------------------------------------------------------- | -------------------------------------------------------------------- | ------------ | ----------------------------------- |
| parentAssetId exists but only used for IMPLEMENTO → MAQUINA link | Phase 22 generalizes to any asset type with depth limit              | Phase 22     | All types can be composite          |
| EM_ANDAMENTO status exists but no WIP contribution tracking      | Phase 22 adds AssetWipContribution + AssetWipStage models            | Phase 22     | Full obra lifecycle management      |
| CAPITALIZACAO only via OS close wizard (MANU-06)                 | Phase 22 adds standalone AssetRenovation for explicit reforma events | Phase 22     | Reforma without OS is now supported |

**Existing decisions that constrain this phase (from STATE.md):**

- `WIP exclusion from depreciation batch`: AssetStatus.EM_ANDAMENTO excluded from batch query — no change needed.
- `prisma.$transaction used directly (NOT withRlsContext)` in asset module — follow same pattern for renovation + WIP services.
- `Decimal-only depreciation` — all monetary arithmetic in Decimal.js.
- `OS accounting treatment is mandatory` — this is for OS close; HIER-02 renovation has its own mandatory `accountingDecision` field (same spirit, different model).

---

## Open Questions

1. **Should reforma (HIER-02) require a minimum value threshold to suggest capitalization?**
   - What we know: MANU-06 has `accountingThreshold` on WorkOrder to guide the wizard. HIER-02 is a standalone form.
   - What's unclear: Whether the planner should include an optional threshold field or let the user always decide freely.
   - Recommendation: Make decision free (no threshold) for MVP — user always sees both options. Keep API open for threshold addition later.

2. **Should WIP contributions generate Payable records (CP) automatically?**
   - What we know: Phase 19 (AQUI-01) generates CP automatically on asset acquisition. WIP contributions are partial payments toward construction.
   - What's unclear: HIER-03 requirement does not explicitly mention CP generation.
   - Recommendation: Do NOT generate CP automatically in Phase 22. Record contribution amount only. Leave CP integration for a future phase if needed.

3. **Should hierarchy depth limit (3 levels) apply when moving a subtree?**
   - What we know: Moving a parent asset to a new parent could push its descendants beyond level 3.
   - What's unclear: Whether move-subtree is in scope.
   - Recommendation: In `updateAsset`, check depth of the entire subtree rooted at the asset being re-parented. If any descendant would exceed level 3, reject with clear message listing the deepest descendant.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| Framework          | Jest 29 + @swc/jest (backend), Vitest (frontend)                                                                |
| Config file        | `apps/backend/jest.config.ts`                                                                                   |
| Quick run command  | `cd apps/backend && pnpm test -- --testPathPattern="asset-renovations\|asset-wip\|assets.routes" --no-coverage` |
| Full suite command | `cd apps/backend && pnpm test`                                                                                  |

### Phase Requirements to Test Map

| Req ID  | Behavior                                                            | Test Type | Automated Command                                                                  | File Exists? |
| ------- | ------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------- | ------------ |
| HIER-01 | Create child asset with valid parent                                | unit      | `pnpm test -- --testPathPattern="assets.routes.spec" -t "hierarchy"`               | Wave 0       |
| HIER-01 | Reject parent assignment exceeding 3 levels                         | unit      | `pnpm test -- --testPathPattern="assets.routes.spec" -t "depth"`                   | Wave 0       |
| HIER-01 | GET asset includes totalized child values                           | unit      | `pnpm test -- --testPathPattern="assets.routes.spec" -t "totalValue"`              | Wave 0       |
| HIER-02 | POST renovation with CAPITALIZAR increments acquisitionValue        | unit      | `pnpm test -- --testPathPattern="asset-renovations.routes.spec" -t "capitalizar"`  | Wave 0       |
| HIER-02 | POST renovation with DESPESA does not change acquisitionValue       | unit      | `pnpm test -- --testPathPattern="asset-renovations.routes.spec" -t "despesa"`      | Wave 0       |
| HIER-02 | POST renovation with newUsefulLifeMonths updates DepreciationConfig | unit      | `pnpm test -- --testPathPattern="asset-renovations.routes.spec" -t "usefulLife"`   | Wave 0       |
| HIER-02 | Reject renovation on ALIENADO or EM_ANDAMENTO asset                 | unit      | `pnpm test -- --testPathPattern="asset-renovations.routes.spec" -t "status guard"` | Wave 0       |
| HIER-03 | POST contribution accumulates on WIP asset                          | unit      | `pnpm test -- --testPathPattern="asset-wip.routes.spec" -t "contribution"`         | Wave 0       |
| HIER-03 | Budget alert fires at configured threshold                          | unit      | `pnpm test -- --testPathPattern="asset-wip.routes.spec" -t "budget alert"`         | Wave 0       |
| HIER-03 | Activate sets status=ATIVO and acquisitionValue=totalContributed    | unit      | `pnpm test -- --testPathPattern="asset-wip.routes.spec" -t "activate"`             | Wave 0       |
| HIER-03 | Depreciation batch excludes EM_ANDAMENTO (regression)               | unit      | `pnpm test -- --testPathPattern="depreciation-batch.spec" -t "EM_ANDAMENTO"`       | Exists       |

### Sampling Rate

- **Per task commit:** `cd apps/backend && pnpm test -- --testPathPattern="asset-renovations\|asset-wip" --no-coverage`
- **Per wave merge:** `cd apps/backend && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/backend/src/modules/asset-renovations/asset-renovations.routes.spec.ts` — covers HIER-02
- [ ] `apps/backend/src/modules/asset-wip/asset-wip.routes.spec.ts` — covers HIER-03
- [ ] Migration `20260428100000_add_asset_hierarchy_renovation_wip` — AssetRenovation + AssetWipContribution + AssetWipStage models + wipBudget/wipBudgetAlertPct fields on Asset

---

## Sources

### Primary (HIGH confidence)

- Prisma schema `/apps/backend/prisma/schema.prisma` — Asset model with parentAssetId/childAssets, AssetStatus.EM_ANDAMENTO, WorkOrderAccountingTreatment
- `depreciation-batch.service.ts` lines 56-65 — confirmed EM_ANDAMENTO exclusion
- `work-orders.service.ts` lines 460-468 — confirmed CAPITALIZACAO acquisition value increment pattern
- STATE.md accumulated decisions — confirmed `prisma.$transaction` direct (no withRlsContext), Decimal-only money, WIP exclusion from batch
- Phase 16 RESEARCH.md + Phase 17 RESEARCH.md — confirmed no new packages needed, full module pattern

### Secondary (MEDIUM confidence)

- CPC 27 / NBC TG 27 (IBRACON) — intangible/tangible assets: reforma capitalizable when extends useful life or increases capacity; direct expense when restores to original condition. This is the accounting basis for the CAPITALIZAR vs DESPESA decision in HIER-02.

### Tertiary (LOW confidence)

- None — all key findings are verifiable from existing codebase.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries already installed; no new dependencies
- Architecture: HIGH — patterns verified against existing modules (work-orders capitalization, asset hierarchy FK, EM_ANDAMENTO batch exclusion)
- Pitfalls: HIGH — circular reference and activation-without-config issues directly observable in current schema; accounting semantics verified against CPC 27

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable domain — no external dependencies)
