# Phase 14: Stock Reversal + Supplier Rating Completion - Research

**Researched:** 2026-03-19
**Domain:** Backend state machine fix + frontend Recharts performance tab + inline badge
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Stock reversal timing (data integrity fix)**

- Move ALL side-effects from APROVADA to CONCLUIDA transition in goods-returns.service.ts
  - StockOutput type RETURN creation
  - StockBalance decrement
  - Financial effect (credit Payable / estorno on original Payable)
- APROVADA transition becomes status-only change (no side-effects)
- CANCELADA after APROVADA becomes status-only change (no rollback needed since APROVADA has no side-effects)
- RETURN_RESOLVED notification already fires on CONCLUIDA — keep as-is
- Business rationale: APROVADA = devolucao autorizada (mercadoria pode estar em transito), CONCLUIDA = resolucao confirmada (mercadoria devolvida de fato)

**Rating alert in QuotationModal**

- Badge inline ao lado do nome do fornecedor na lista de selecao dentro do QuotationModal
- Dois niveis de alerta:
  - Rating < 2: badge vermelho "Avaliacao critica" + tooltip com nota media e numero de avaliacoes
  - Rating >= 2 e < 3: badge amarelo "Avaliacao baixa" + tooltip com nota media e numero de avaliacoes
  - Rating >= 3: sem badge (apenas estrelas normais ja existentes)
- NAO bloqueia selecao — apenas informativo
- Escopo: APENAS QuotationModal — nao adicionar em PurchaseOrderModal, GoodsReceiptModal ou SuppliersPage

**Performance report (FORN-03 completion)**

- Nova aba "Performance" na ficha do fornecedor (SuppliersPage detail section)
- Conteudo: LineChart Recharts (evolucao media geral), barras horizontais por criterio (prazo, qualidade, preco, atendimento), filtro por periodo com presets (ultimo mes, trimestre, ano, todos)
- Backend: novo endpoint GET /org/suppliers/:id/performance?startDate=&endDate=
- Recharts ja instalado

**Notification wiring**

- Manter RETURN_RESOLVED existente (notifica FINANCIAL na CONCLUIDA) — sem notificacoes adicionais
- Nao adicionar notificacao de rating baixo na cotacao
- Nao notificar estoquista sobre ajuste de saldo por devolucao

### Claude's Discretion

- Layout exato da aba Performance (disposicao grafico + barras)
- Cores dos graficos Recharts (seguindo design system)
- Skeleton loading e empty states
- Posicionamento do badge de rating no QuotationModal
- Tooltip styling e conteudo exato
- Tratamento de fornecedor sem avaliacoes no QuotationModal

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                          | Research Support                                                                                                                                |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| DEVO-01 | Gerente de estoque pode registrar devolucao total ou parcial vinculada ao recebimento, com saida automatica do estoque e acompanhamento da resolucao | Stock reversal fix moves StockOutput creation + StockBalance decrement to CONCLUIDA transition — correct business timing for "saida automatica" |
| FORN-03 | Gerente pode avaliar fornecedor apos cada entrega, ver ranking, historico, alerta ao cotar com rating < 3, e relatorio de performance por periodo    | Badge in QuotationModal closes the alert requirement; performance endpoint + SupplierPerformanceTab closes the relatorio requirement            |

</phase_requirements>

## Summary

Phase 14 is a completion phase — no new domain models or migrations required. It closes two previously deferred items: (1) a data integrity bug where stock reversal side-effects fire on APROVADA instead of CONCLUIDA in the goods-return state machine, and (2) the supplier performance report and rating alert that were explicitly postergated during Phase 7.

The backend work is a surgical refactor: the `transitionGoodsReturn()` function in `goods-returns.service.ts` already contains all the side-effect code (StockOutput RETURN creation, StockBalance decrement, financial effects) at lines 341-499 under the APROVADA branch. The fix is to cut that entire block and paste it under the CONCLUIDA branch (line 502). The APROVADA branch becomes a no-op (status update only). Since APROVADA no longer creates any DB records, CANCELADA-after-APROVADA also requires no rollback logic.

The frontend work has two independent pieces: (a) adding a conditional badge to the QuotationModal supplier list rows — `supplier.averageRating` is already available in the existing list data, so only JSX + CSS is needed; (b) a new SupplierPerformanceTab component consuming a new `/org/suppliers/:id/performance` endpoint, rendered as a new tab in the supplier detail section of SuppliersPage. Recharts is confirmed installed and the chart pattern is established in MonthlyEvolutionChart.

**Primary recommendation:** Implement in three sequential plans — (P01) backend service refactor + performance endpoint, (P02) QuotationModal badge, (P03) SupplierPerformanceTab frontend.

## Standard Stack

### Core

| Library                 | Version   | Purpose                                    | Why Standard                                              |
| ----------------------- | --------- | ------------------------------------------ | --------------------------------------------------------- |
| Prisma (existing)       | 7         | Transactional DB writes in withRlsContext  | Already used for all stock/financial writes               |
| Recharts (existing)     | installed | LineChart + custom horizontal bars         | Confirmed in MonthlyEvolutionChart.tsx; locked by CONTEXT |
| lucide-react (existing) | installed | AlertCircle, AlertTriangle icons for badge | Project standard per CLAUDE.md                            |

### Supporting

| Library          | Version | Purpose                                            | When to Use                         |
| ---------------- | ------- | -------------------------------------------------- | ----------------------------------- |
| React (existing) | 19      | useState for period filter state in PerformanceTab | Single local state, no store needed |

### Alternatives Considered

| Instead of                          | Could Use                    | Tradeoff                                                                                                                                      |
| ----------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Custom horizontal bars (CSS)        | Recharts BarChart horizontal | Custom CSS is simpler for 4 static bars; Recharts horizontal requires layout='vertical' axis inversion and adds complexity for no visual gain |
| `title` attribute for badge tooltip | Custom Tooltip component     | `title` is sufficient per UI-SPEC for low-risk tooltip; avoids new component                                                                  |

## Architecture Patterns

### Recommended Project Structure

No new files/directories needed beyond:

```
apps/backend/src/modules/
├── suppliers/
│   ├── suppliers.service.ts        # ADD getPerformanceReport()
│   ├── suppliers.routes.ts         # ADD GET /:id/performance route (BEFORE /:id CRUD)
│   └── suppliers.types.ts          # ADD PerformanceReportOutput type
└── goods-returns/
    └── goods-returns.service.ts    # REFACTOR transitionGoodsReturn()

apps/frontend/src/
├── components/
│   ├── suppliers/
│   │   └── SupplierPerformanceTab.tsx  # NEW
│   │   └── SupplierPerformanceTab.css  # NEW
│   └── quotations/
│       └── QuotationModal.tsx          # MODIFY: add badge to supplier rows
└── hooks/
    └── useSupplierPerformance.ts       # NEW
```

### Pattern 1: Moving Side-Effects Between State Machine Branches

**What:** Cut the entire if (input.status === 'APROVADA') block (lines 341-499) and place it inside if (input.status === 'CONCLUIDA'), before the existing CONCLUIDA notification code. The APROVADA branch is removed entirely (status update still flows through the common updateData path).

**When to use:** Whenever the business event triggering an effect is different from the authorization event. Here APROVADA = authorization, CONCLUIDA = physical return confirmed.

**Example (before → after):**

```typescript
// BEFORE (wrong — fires on authorization):
if (input.status === 'APROVADA') {
  // ... stock output creation, balance decrement, financial effects
}
if (input.status === 'CONCLUIDA') {
  updateData.resolutionStatus = 'RESOLVED';
  // ... RETURN_RESOLVED notification
}

// AFTER (correct — fires on confirmation):
// No APROVADA block at all
if (input.status === 'CONCLUIDA') {
  updateData.resolutionStatus = 'RESOLVED';
  // ... stock output creation, balance decrement, financial effects (moved here)
  // ... RETURN_RESOLVED notification (keep after side-effects)
}
```

**Key invariant preserved:** `updateData.stockOutputId` and `updateData.creditPayableId` assignments are still written to the GoodsReturn row — they just happen at CONCLUIDA instead of APROVADA.

### Pattern 2: Performance Endpoint with Date Range Aggregation

**What:** New `getPerformanceReport(ctx, id, startDate?, endDate?)` method in suppliers.service.ts. Uses existing `tx.supplierRating.findMany()` with a `createdAt` where clause. Returns two shapes: `history` (array of `{ date, average }` for LineChart) and `breakdown` (object with per-criterion averages for the horizontal bars).

**When to use:** Lightweight analytics that don't justify a dedicated analytics module — query over existing rating rows.

**Example:**

```typescript
// Source: derived from existing computeAverageRating() and listRatings() patterns
export async function getPerformanceReport(
  ctx: RlsContext,
  supplierId: string,
  startDate?: string,
  endDate?: string,
): Promise<PerformanceReportOutput> {
  return withRlsContext(ctx, async (tx) => {
    const supplier = await tx.supplier.findFirst({
      where: { id: supplierId, organizationId: ctx.organizationId, deletedAt: null },
    });
    if (!supplier) throw new SupplierError('Fornecedor nao encontrado', 404);

    const where: Prisma.SupplierRatingWhereInput = { supplierId };
    if (startDate) where.createdAt = { ...(where.createdAt as object), gte: new Date(startDate) };
    if (endDate) where.createdAt = { ...(where.createdAt as object), lte: new Date(endDate) };

    const ratings = await tx.supplierRating.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    const history = ratings.map((r) => ({
      date: r.createdAt.toISOString().slice(0, 10),
      average: Math.round(((r.deadline + r.quality + r.price + r.service) / 4) * 100) / 100,
    }));

    const breakdown =
      ratings.length === 0
        ? { deadline: 0, quality: 0, price: 0, service: 0 }
        : {
            deadline: avg(ratings.map((r) => r.deadline)),
            quality: avg(ratings.map((r) => r.quality)),
            price: avg(ratings.map((r) => r.price)),
            service: avg(ratings.map((r) => r.service)),
          };

    return { history, breakdown, totalRatings: ratings.length };
  });
}
```

### Pattern 3: Conditional Badge in Existing Supplier Row JSX

**What:** Add a `getRatingBadge(rating)` helper that returns null or a `<span>` badge element. Insert it into both the suggestedSuppliers map and the activeSuppliers map in QuotationModal, between the name span and the existing star display.

**When to use:** Inline alerts that must not block actions — purely informational.

**Example:**

```tsx
// Source: 14-UI-SPEC.md badge specs
function getRatingBadge(rating: number | null | undefined) {
  if (rating == null || rating >= 3) return null;
  const isCritical = rating < 2;
  return (
    <span
      className={`qm-rating-badge qm-rating-badge--${isCritical ? 'critical' : 'low'}`}
      title={`Nota media: ${rating.toFixed(1)}`}
    >
      {isCritical ? (
        <AlertCircle size={12} aria-hidden="true" />
      ) : (
        <AlertTriangle size={12} aria-hidden="true" />
      )}
      {isCritical ? 'Avaliacao critica' : 'Avaliacao baixa'}
    </span>
  );
}
```

**Data availability note:** QuotationModal already receives `activeSuppliers` and `suggestedSuppliers` from `useSuppliers`. The `Supplier` type already has `averageRating?: number`. The badge helper works directly on that field — no new API call needed.

### Pattern 4: New Tab in SuppliersPage Detail Section

**What:** SuppliersPage shows a supplier detail panel when a supplier is selected. Add a "Performance" tab to that panel. Follow the existing Tabs component pattern (look at how tabs are structured in other pages — e.g., StockOutputsPage with tabs Saidas/Movimentacoes/Saldos pattern as reference).

**When to use:** When adding secondary views to an existing detail section.

**Example structure:**

```tsx
// SupplierPerformanceTab receives supplierId and onRateClick callback
<SupplierPerformanceTab
  supplierId={selectedSupplier.id}
  onRateClick={() => setShowRatingModal(true)}
/>
```

### Anti-Patterns to Avoid

- **Running side-effects in both branches:** Do NOT leave any stock/financial logic in APROVADA. The whole point is that APROVADA is now a clean status-only transition.
- **Creating a migration for DEVO-01:** No schema change is needed — the GoodsReturn model already has `stockOutputId` and `creditPayableId` fields that get populated at CONCLUIDA instead of APROVADA. The Prisma schema is unchanged.
- **Separate endpoint for badge data:** The `averageRating` field is already returned by `GET /org/suppliers` (listSuppliers includes ratings and computes averageRating). QuotationModal already fetches the full supplier list. No extra call needed for the badge.
- **Horizontal Recharts BarChart for criteria breakdown:** Use custom CSS horizontal bars per UI-SPEC. Recharts BarChart horizontal layout adds complexity; 4 static bars are trivially done with CSS flex + div fills.
- **Adding the performance route AFTER /:id:** Must register `/:id/performance` BEFORE `/:id` CRUD routes in suppliers.routes.ts (same pattern as import/export/top3 routes placed before /:id — see line 73 comment in existing routes file).

## Don't Hand-Roll

| Problem               | Don't Build                  | Use Instead                                  | Why                                                       |
| --------------------- | ---------------------------- | -------------------------------------------- | --------------------------------------------------------- |
| Average per criterion | Custom reduce loop per field | Reuse `computeAverageRating()` helper inline | Already handles edge cases (0 ratings → null)             |
| Date filtering        | Raw SQL date comparison      | Prisma `gte`/`lte` on `createdAt`            | Type-safe, RLS-compatible                                 |
| Chart trend line      | Canvas/SVG manually          | Recharts LineChart (already installed)       | Responsive, accessible, zero-dependency cost              |
| Tooltip on badge      | Tooltip component            | Native `title` attribute                     | UI-SPEC explicitly allows this; no interactivity required |

**Key insight:** Everything needed already exists in the codebase. Phase 14 is pure composition and relocation of existing logic.

## Common Pitfalls

### Pitfall 1: CANCELADA transition rollback — misunderstanding the new semantics

**What goes wrong:** Developer adds rollback logic when transitioning from APROVADA to CANCELADA, thinking the stock was already decremented.
**Why it happens:** Old code had side-effects on APROVADA, so CANCELADA-after-APROVADA previously needed to undo them.
**How to avoid:** After the fix, APROVADA has NO side-effects. CANCELADA-after-APROVADA is a pure status change — no rollback needed. The VALID_TRANSITIONS map already allows `APROVADA: ['CONCLUIDA']` only (not CANCELADA from APROVADA), so this path may not even be reachable. Verify `GR_RETURN_VALID_TRANSITIONS` before adding any rollback logic.
**Warning signs:** Any `if (input.status === 'CANCELADA' && gr.status === 'APROVADA')` block is wrong after the fix.

### Pitfall 2: Performance route registered after /:id routes

**What goes wrong:** Express matches `/org/suppliers/perf-123-abc/performance` as `/:id` with id = `perf-123-abc`, and then `/performance` as a nested segment — route not found.
**Why it happens:** Express route matching is first-match; `:id` is greedy.
**How to avoid:** Register `GET ${base}/:id/performance` in the same pre-`/:id` section as top3/export/import routes. Add comment: "BEFORE /:id CRUD."
**Warning signs:** 404 on GET /org/suppliers/some-id/performance in integration tests.

### Pitfall 3: `updateData.stockOutputId` / `updateData.creditPayableId` not set at CONCLUIDA

**What goes wrong:** The GoodsReturn row is updated with resolutionStatus=RESOLVED but stockOutputId remains null because the assignments were left out of the moved block.
**Why it happens:** Careless copy-paste — the side-effect creation code is moved but the `updateData.X = result.id` assignments are missed.
**How to avoid:** The moved block must include both the create calls AND the `updateData` assignments. Check the final `tx.goodsReturn.update({ data: updateData })` call — `stockOutputId` and `creditPayableId` must be in updateData for CONCLUIDA transitions that produce them.
**Warning signs:** GoodsReturn row has status=CONCLUIDA but stockOutputId=null after transition.

### Pitfall 4: Badge inserted after star display instead of before

**What goes wrong:** Badge appears to the right of stars, making the row layout confusing (stars then badge then nothing).
**Why it happens:** Misreading the UI-SPEC insertion point.
**How to avoid:** UI-SPEC states: "Positioned: inline after supplier name span, before existing star display." Insert badge JSX between the `<span className="qm-supplier-item__name">` and `{supplier.rating != null && <span className="qm-supplier-item__rating">...}`.
**Warning signs:** Badge visually appears at right edge after stars.

### Pitfall 5: Performance fetch on every SuppliersPage render

**What goes wrong:** `useSupplierPerformance` hook fetches on mount without checking if the Performance tab is even visible, causing unnecessary API calls when browsing suppliers.
**Why it happens:** Hook is placed at the SupplierDetail component level instead of inside PerformanceTab.
**How to avoid:** The fetch should be triggered only when the Performance tab is active (pass supplierId to SupplierPerformanceTab, fetch on mount inside that component). Use `enabled: !!supplierId` pattern — or simply let the component mount only when the tab is active.

## Code Examples

Verified patterns from existing codebase:

### Existing transitionGoodsReturn CONCLUIDA branch (what we extend)

```typescript
// Source: goods-returns.service.ts lines 502-521
if (input.status === 'CONCLUIDA') {
  updateData.resolutionStatus = 'RESOLVED';

  // Notify FINANCIAL users that return is resolved (fire-and-forget)
  const financialUsers = await tx.user.findMany({ ... });
  for (const u of financialUsers) {
    void createNotification(tx, ctx.organizationId, { type: 'RETURN_RESOLVED', ... }).catch(() => {});
  }
}
// After fix: all stock+financial logic from APROVADA block goes HERE,
// before the RETURN_RESOLVED notification.
```

### Existing supplier list route registration pattern

```typescript
// Source: suppliers.routes.ts lines 73-196
// Import routes (BEFORE /:id to avoid Express matching "import" as ID)
suppliersRouter.get(`${base}/import/template`, ...);
suppliersRouter.post(`${base}/import/preview`, ...);
// Export routes (BEFORE /:id)
suppliersRouter.get(`${base}/export/csv`, ...);
// Top 3 route (BEFORE /:id)
suppliersRouter.get(`${base}/top3`, ...);
// NEW: Performance route (BEFORE /:id)
suppliersRouter.get(`${base}/:id/performance`, ...);
// CRUD routes
suppliersRouter.get(base, ...);
suppliersRouter.get(`${base}/:id`, ...);
```

### Existing Recharts pattern (MonthlyEvolutionChart reference)

```tsx
// Source: established pattern from purchasing-dashboard/MonthlyEvolutionChart.tsx
<ResponsiveContainer width="100%" height={240}>
  <LineChart data={history}>
    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-200)" />
    <XAxis dataKey="date" tick={{ fontSize: 12, fontFamily: 'Source Sans 3' }} />
    <YAxis
      domain={[1, 5]}
      ticks={[1, 2, 3, 4, 5]}
      tick={{ fontSize: 12, fontFamily: 'JetBrains Mono' }}
    />
    <Tooltip formatter={(value: number) => [`Nota: ${value.toFixed(1)}`, '']} />
    <Line
      type="monotone"
      dataKey="average"
      stroke="#2E7D32"
      strokeWidth={2}
      dot={{ r: 4 }}
      activeDot={{ r: 6 }}
    />
  </LineChart>
</ResponsiveContainer>
```

### Horizontal bar (CSS, not Recharts)

```tsx
// Source: 14-UI-SPEC.md criteria breakdown spec
<div className="sp-criteria-row">
  <span className="sp-criteria-label">Prazo de Entrega</span>
  <div
    className="sp-criteria-bar-track"
    role="meter"
    aria-valuenow={breakdown.deadline}
    aria-valuemin={1}
    aria-valuemax={5}
    aria-label={`Prazo de Entrega: ${breakdown.deadline.toFixed(1)} de 5`}
  >
    <div
      className="sp-criteria-bar-fill"
      style={{ width: `${((breakdown.deadline - 1) / 4) * 100}%` }}
    />
  </div>
  <span className="sp-criteria-value">{breakdown.deadline.toFixed(1)}</span>
</div>
```

Note: bar fill uses `(value - 1) / 4 * 100%` to map the 1-5 scale correctly (1 = 0%, 5 = 100%).

## State of the Art

| Old Approach                                | Current Approach                               | When Changed | Impact                                                           |
| ------------------------------------------- | ---------------------------------------------- | ------------ | ---------------------------------------------------------------- |
| Side-effects on APROVADA                    | Side-effects on CONCLUIDA                      | Phase 14 fix | Stock + financials only change when physical return is confirmed |
| No rating alert in QuotationModal           | Inline badge on supplier rows                  | Phase 14     | Buyer sees risk before selecting supplier                        |
| No performance report (postergated Phase 7) | LineChart + criteria breakdown + period filter | Phase 14     | FORN-03 fully closed                                             |

**Deprecated/outdated:**

- The APROVADA branch with side-effects: remove entirely after moving to CONCLUIDA.

## Open Questions

1. **SuppliersPage detail panel structure**
   - What we know: SuppliersPage.tsx imports SupplierModal, SupplierImportModal, SupplierRatingModal. There is a detail side panel in the page (inferred from the top-ranked supplier detail flow).
   - What's unclear: Whether the detail panel already uses a Tabs component or is a simple div with sections. Needs the implementer to read SuppliersPage.tsx lines 80+ before adding the Performance tab.
   - Recommendation: Read SuppliersPage.tsx fully before planning the tab insertion. If no existing Tabs infrastructure, implement with simple button-row tab pattern consistent with StockOutputsPage.

2. **averageRating field in QuotationModal supplier list**
   - What we know: `Supplier` type has `averageRating?: number`. `listSuppliers` includes ratings and computes averageRating. QuotationModal currently reads `supplier.rating` (line 290) — not `supplier.averageRating`.
   - What's unclear: Whether the QuotationModal uses a different supplier type/shape that uses `.rating` vs `.averageRating`.
   - Recommendation: Implementer must read QuotationModal.tsx lines 1-80 to find the supplier data type/hook used and confirm the field name. The badge logic must use whichever field is actually available.

## Validation Architecture

### Test Framework

| Property           | Value                                                                               |
| ------------------ | ----------------------------------------------------------------------------------- |
| Framework          | Jest (backend) + Vitest (frontend)                                                  |
| Config file        | jest.config.js (backend root)                                                       |
| Quick run command  | `pnpm --filter @protos-farm/backend test -- --testPathPattern=goods-returns.routes` |
| Full suite command | `pnpm --filter @protos-farm/backend test`                                           |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                           | Test Type | Automated Command                                                                   | File Exists?                    |
| ------- | ------------------------------------------------------------------ | --------- | ----------------------------------------------------------------------------------- | ------------------------------- |
| DEVO-01 | CONCLUIDA transition creates StockOutput + decrements StockBalance | unit      | `pnpm --filter @protos-farm/backend test -- --testPathPattern=goods-returns.routes` | ✅ goods-returns.routes.spec.ts |
| DEVO-01 | APROVADA transition does NOT create StockOutput (no side-effects)  | unit      | same                                                                                | ✅ goods-returns.routes.spec.ts |
| DEVO-01 | CANCELADA after APROVADA does NOT attempt rollback                 | unit      | same                                                                                | ✅ goods-returns.routes.spec.ts |
| FORN-03 | GET /org/suppliers/:id/performance returns history + breakdown     | unit      | `pnpm --filter @protos-farm/backend test -- --testPathPattern=suppliers.routes`     | ✅ suppliers.routes.spec.ts     |
| FORN-03 | Performance endpoint filters by startDate/endDate                  | unit      | same                                                                                | ✅ suppliers.routes.spec.ts     |
| FORN-03 | Performance endpoint returns empty history when no ratings         | unit      | same                                                                                | ✅ suppliers.routes.spec.ts     |

### Sampling Rate

- **Per task commit:** `pnpm --filter @protos-farm/backend test -- --testPathPattern="goods-returns|suppliers"`
- **Per wave merge:** `pnpm --filter @protos-farm/backend test`
- **Phase gate:** Full backend suite green before `/gsd:verify-work`

### Wave 0 Gaps

- None — existing test infrastructure covers all phase requirements. New test cases are additions to `goods-returns.routes.spec.ts` and `suppliers.routes.spec.ts` which already exist.

## Sources

### Primary (HIGH confidence)

- Direct read of `goods-returns.service.ts` lines 302-531 — current APROVADA side-effects block, CONCLUIDA notification block
- Direct read of `goods-returns.types.ts` — GR_RETURN_VALID_TRANSITIONS confirms APROVADA→CONCLUIDA only (CANCELADA not reachable from APROVADA)
- Direct read of `suppliers.service.ts` — computeAverageRating(), listRatings(), createRating() patterns
- Direct read of `suppliers.routes.ts` — route ordering pattern (import/export/top3 BEFORE /:id)
- Direct read of `QuotationModal.tsx` lines 270-360 — existing supplier row structure, star display at lines 290-297, field name `supplier.rating`
- Direct read of `14-UI-SPEC.md` — approved design contract with exact specs
- Direct read of `14-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)

- `SuppliersPage.tsx` lines 1-80 partial read — confirms SupplierRatingModal import, StarRating component; full tab structure not read
- `supplier.ts` frontend type — confirms `averageRating?: number` field exists on Supplier type

### Tertiary (LOW confidence)

- None

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries confirmed installed in codebase
- Architecture: HIGH — all patterns verified from direct source reads
- Pitfalls: HIGH — derived from direct inspection of existing code and route ordering pattern
- Test locations: HIGH — spec files confirmed to exist via Glob

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable — no fast-moving dependencies)
