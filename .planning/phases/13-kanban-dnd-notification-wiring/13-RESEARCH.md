# Phase 13: Kanban DnD Fixes + Notification Wiring - Research

**Researched:** 2026-03-19
**Domain:** Frontend DnD state machine + Backend notification dispatch
**Confidence:** HIGH — all findings come from direct codebase inspection

## Summary

Phase 13 is entirely a surgical bug-fix and wiring phase: two broken Kanban drag-and-drop
transitions and four unwired notification types. No new models, no migrations, no new endpoints
(the PATCH /transition endpoint already exists on purchase-orders). All infrastructure is in place.

The frontend work is constrained to two files: `usePurchasingKanban.ts` (fix moveCard logic) and
`KanbanBoard.tsx` (update confirmation copy + add navigation shortcut for EM_COTACAO→OC_EMITIDA).
The backend work is adding `createNotification` calls in four service files where the dispatch
points already exist but were skipped.

**Primary recommendation:** Implement in two waves — frontend DnD fixes first (self-contained,
no backend dependencies), then backend notification wiring (four independent service edits).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**EM_COTACAO → OC_EMITIDA transition**

- Navigate to quotation page, same redirect pattern as AGUARDANDO_ENTREGA→RECEBIDO
- ConfirmModal shown before navigating: "Para emitir o pedido de compra, é necessário aprovar a cotação vencedora primeiro." Button: "Ir para Cotações"
- Navigates to `/quotations?highlight={quotationId}` on confirm
- Keep EM_COTACAO→OC_EMITIDA in the VALID_TRANSITIONS map (drop zone lights up) — handler navigates instead of calling API
- No direct PO creation from kanban — user must go through quotation approval flow

**OC_EMITIDA → AGUARDANDO_ENTREGA transition**

- Use PATCH `/purchase-orders/{id}/transition` with `{ action: 'CONFIRM_SHIPMENT' }` (state-machine pattern)
- Follows same VALID_TRANSITIONS pattern as purchase-requests
- Replaces broken PUT `/purchase-orders/{id}/status` with `EM_TRANSITO`

**BUDGET_EXCEEDED notification**

- Disparo duplo: fires at RC approval (orçamento requisitado) AND at OC emission (orçamento comprometido)
- Recipients: the approver + FINANCIAL role users
- Dispatch in: `purchase-requests.service.ts` (APPROVE action, after budget check) and `purchase-orders.service.ts` (at OC creation, after budget check)

**PO_GOODS_RECEIVED notification**

- Fires when `confirmGoodsReceipt` completes successfully
- Recipients: RC creator + buyer (person who emitted the OC)
- Dispatch in: `goods-receipts.service.ts` (after confirm, before return)

**RETURN_REGISTERED notification**

- Fires when a goods return is created
- Recipients: buyer who emitted the OC (needs to contact supplier)
- Dispatch in: `goods-returns.service.ts` (createGoodsReturn)

**RETURN_RESOLVED notification**

- Fires when goods return transitions to CONCLUIDA
- Recipients: FINANCIAL role users (needs to process credit/estorno)
- Fix wrong type: replace existing `GOODS_RETURN_APPROVED` dispatch with `RETURN_RESOLVED` at CONCLUIDA transition
- Dispatch in: `goods-returns.service.ts` (transitionGoodsReturn → CONCLUIDA)

**SC1 removed from scope**

- RC_PENDENTE→RC_APROVADA already calls correct `POST /purchase-requests/{id}/approve` endpoint
- No code changes needed — verified by codebase scout

### Claude's Discretion

- Exact notification message content (title/body text) — follow existing pt-BR patterns
- Whether to add a PATCH /transition endpoint to purchase-orders or reuse/fix existing PUT /status
- Test coverage approach for the DnD fixes and notification wirings
- Error handling in moveCard for failed transitions

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                                                              | Research Support                                                                                        |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| DASH-01 | Comprador/gerente pode ver kanban do fluxo de compras com drag & drop com ações obrigatórias                                                             | Fix moveCard for EM_COTACAO→OC_EMITIDA (navigate) and OC_EMITIDA→AGUARDANDO_ENTREGA (PATCH /transition) |
| DASH-03 | Participantes do processo recebem notificações via push/email/badge em cada etapa relevante (financeiro: recebimento confirmado; gerente: digest diário) | Wire 4 notification types: BUDGET_EXCEEDED, PO_GOODS_RECEIVED, RETURN_REGISTERED, RETURN_RESOLVED       |

</phase_requirements>

---

## Standard Stack

### Core (already installed — no new dependencies)

| Library/Tool             | Version           | Purpose                                | Already In Use                             |
| ------------------------ | ----------------- | -------------------------------------- | ------------------------------------------ |
| @dnd-kit/core            | installed         | Drag-and-drop context and events       | Yes — KanbanBoard.tsx                      |
| react-router-dom         | installed         | `useNavigate` for redirect transitions | Yes — KanbanBoard.tsx line 10              |
| ConfirmModal             | project component | Pre-action confirmation dialog         | Yes — KanbanBoard.tsx line 13              |
| createNotification       | project service   | BADGE + fire-and-forget EMAIL          | Yes — notifications.service.ts             |
| shouldNotify             | project service   | Preference check before dispatch       | Yes — called inside createNotification     |
| dispatchPushNotification | project service   | Fire-and-forget push (placeholder)     | Yes — purchase-requests.service.ts pattern |

**No new packages required.** Phase 13 is purely internal wiring.

---

## Architecture Patterns

### Pattern 1: Navigation-Based Transition (redirect instead of API call)

The AGUARDANDO_ENTREGA→RECEBIDO transition already implements this pattern (KanbanBoard.tsx line 151-155). The EM_COTACAO→OC_EMITIDA transition must follow the exact same shape:

```typescript
// Source: KanbanBoard.tsx lines 151-155 (existing AGUARDANDO_ENTREGA→RECEBIDO)
if (from === 'AGUARDANDO_ENTREGA' && to === 'RECEBIDO') {
  setConfirmPending(null);
  navigate(`/goods-receipts?poId=${card.id}`);
  return;
}

// Same pattern for EM_COTACAO→OC_EMITIDA (to add):
if (from === 'EM_COTACAO' && to === 'OC_EMITIDA') {
  setConfirmPending(null);
  navigate(`/quotations?highlight=${card.id}`);
  return;
}
```

The card.id in the EM_COTACAO column represents the RC (purchase request) ID — the backend kanban
query places the card by RC status, not by quotation entity. The `highlight` query param navigates
to the quotations page and the quotation list must handle the param. If the quotations page does
not already handle `highlight`, the navigate target may need to be simply `/quotations` or accept
the RC id — this needs verification during implementation.

### Pattern 2: PATCH /transition for OC_EMITIDA → AGUARDANDO_ENTREGA

The endpoint **already exists**: `PATCH /org/purchase-orders/:id/transition` (routes.ts line 144).
The `transitionPO` service function accepts `{ status: string }` via `TransitionPOInput`. The
OC state machine (`OC_VALID_TRANSITIONS`) allows `CONFIRMADA → EM_TRANSITO`. The broken call
was `PUT /purchase-orders/{id}/status` — replace with `PATCH /transition` using `{ status: 'EM_TRANSITO' }`.

The CONTEXT.md uses `{ action: 'CONFIRM_SHIPMENT' }` as the payload — but the actual
`TransitionPOInput` interface accepts `{ status: string; reason?: string }`. The service uses
`input.status` directly. The planner must resolve this: either use `{ status: 'EM_TRANSITO' }`
(what the service expects) or add an `action` mapper. Using `{ status: 'EM_TRANSITO' }` is
the simpler path, consistent with how other callers use transitionPO.

**Confidence: HIGH** — both endpoint and service confirmed from source.

### Pattern 3: Notification Dispatch in Service Layer

All existing notification dispatches in purchase-requests.service.ts follow this pattern:

```typescript
// Source: purchase-requests.service.ts lines 472-482 (RC_APPROVED dispatch)
const notification = await createNotification(tx, ctx.organizationId, {
  recipientId: rc.createdBy,
  type: 'RC_APPROVED',
  title: 'Requisicao aprovada',
  body: `${rc.sequentialNumber} foi aprovada.`,
  referenceId: id,
  referenceType: 'purchase_request',
});
void dispatchPushNotification(notification).catch((err: Error) => {
  console.warn('Push dispatch failed', err);
});
```

For notifications with multiple recipients (FINANCIAL users), use a `for...of` loop with
`void createNotification(...).catch(...)` — same pattern as the existing GOODS_RETURN_APPROVED
dispatch at goods-returns.service.ts line 491-503 (just with correct type).

### Pattern 4: Finding FINANCIAL Role Recipients

```typescript
// Source: goods-returns.service.ts lines 482-489 (MANAGER recipients — same pattern for FINANCIAL)
const financialUsers = await tx.user.findMany({
  where: {
    organizationId: ctx.organizationId,
    role: 'FINANCIAL',
  },
  select: { id: true },
  take: 5,
});
```

The `role: 'FINANCIAL'` value is confirmed in `org-users.types.ts` line 8.

### Pattern 5: Acquiring RC Creator and OC Buyer for PO_GOODS_RECEIVED

The `confirmGoodsReceipt` function in goods-receipts.service.ts has access to the full GR object
including `purchaseOrderId`. The PO has a `createdBy` field and the PO `creator` relation (see
PO_INCLUDE in purchase-orders.service.ts line 46). To notify both RC creator and OC buyer, the
service needs to fetch the PO with its quotation→purchaseRequest chain.

The GR at the point of confirmation (around line 800) has `gr.purchaseOrderId`. The PO createdBy
(buyer) can be fetched within the same transaction.

### Recommended Project Structure for Changes

```
apps/frontend/src/hooks/
  usePurchasingKanban.ts     — Fix moveCard: remove EM_COTACAO→OC_EMITIDA API call + fix OC_EMITIDA→AGUARDANDO_ENTREGA

apps/frontend/src/components/kanban/
  KanbanBoard.tsx            — Add EM_COTACAO→OC_EMITIDA navigation case + update confirmation copy

apps/backend/src/modules/purchase-requests/
  purchase-requests.service.ts   — Add BUDGET_EXCEEDED dispatch after budgetCheck (APPROVE action ~line 467)

apps/backend/src/modules/purchase-orders/
  purchase-orders.service.ts     — Add BUDGET_EXCEEDED dispatch after budgetCheck (EMITIDA branch ~line 361)

apps/backend/src/modules/goods-receipts/
  goods-receipts.service.ts      — Add PO_GOODS_RECEIVED dispatch after step 6 (~line 822)

apps/backend/src/modules/goods-returns/
  goods-returns.service.ts       — Add RETURN_REGISTERED in createGoodsReturn (~line 205)
                                 — Fix RETURN_RESOLVED in transitionGoodsReturn CONCLUIDA (~line 494)
```

### Anti-Patterns to Avoid

- **Do not `await` email inside transaction**: `createNotification` already handles email
  fire-and-forget internally. Never add a direct `sendMail` call in the service transactions.
- **Do not use `GOODS_RETURN_APPROVED` type**: It is not in `NOTIFICATION_TYPES` — TypeScript
  catches this with the `as any` cast present at line 495. Remove the cast and use `RETURN_RESOLVED`.
- **Do not call `createEmergencyPO` from kanban**: The broken `EM_COTACAO→OC_EMITIDA` call was
  `POST /purchase-orders` which hits `createEmergencyPO`. This was the Phase 12 bug — replace
  with navigation entirely.
- **Do not remove EM_COTACAO from VALID_TRANSITIONS**: The CONTEXT locked this — drop zone must
  still light up, handler just navigates.

---

## Don't Hand-Roll

| Problem               | Don't Build              | Use Instead                                        |
| --------------------- | ------------------------ | -------------------------------------------------- |
| Notification delivery | Custom email/badge logic | `createNotification` service (handles both)        |
| User preference check | Custom preference query  | `shouldNotify` (called inside createNotification)  |
| Navigation on drop    | Custom state machine     | Exact pattern from AGUARDANDO_ENTREGA→RECEBIDO     |
| PO status transition  | New endpoint             | Existing PATCH /org/purchase-orders/:id/transition |

---

## Common Pitfalls

### Pitfall 1: TransitionPOInput uses `status`, not `action`

**What goes wrong:** CONTEXT.md describes the payload as `{ action: 'CONFIRM_SHIPMENT' }` but
the backend `transitionPO` service reads `input.status` (not `input.action`). Using the
action-based payload will result in a no-op or error.

**How to avoid:** Use `{ status: 'EM_TRANSITO' }` in the `moveCard` PATCH call. If the planner
wants to use `action` semantics, add an action→status map at the route handler level.

**Warning signs:** TypeScript will not catch this if `TransitionPOInput.status` is typed as
`string` — the call will silently pass `undefined` to `canOcTransition`.

### Pitfall 2: card.id in EM_COTACAO column is the RC id, not the quotation id

**What goes wrong:** Navigating to `/quotations?highlight={card.id}` passes the RC id as the
highlight param — the quotations page may not know how to highlight by RC id.

**How to avoid:** Check how the quotations page handles the `highlight` param. If it expects a
quotation id, consider navigating to `/quotations?purchaseRequestId={card.id}` instead, which
is a natural filter param.

**Warning signs:** Quotation list shows nothing highlighted, user cannot find the quotation.

### Pitfall 3: BUDGET_EXCEEDED recipient lookup for the approver

**What goes wrong:** The CONTEXT says recipients are "the approver + FINANCIAL role users" but
in the purchase-requests APPROVE flow, `ctx.userId` is the approver. The approver id is available
directly from context — no extra query needed.

**How to avoid:** Use `ctx.userId` for the approver dispatch in `purchase-requests.service.ts`.
For FINANCIAL users, use the `findMany` query above.

### Pitfall 4: PO_GOODS_RECEIVED needs a GR → PO → createdBy chain

**What goes wrong:** `confirmGoodsReceipt` at the point of step 6 has `updated` (the GR), but
`updated.purchaseOrderId` is available from the GR. Fetching the PO's `createdBy` requires an
additional query inside the same transaction.

**How to avoid:** Add a targeted PO select within the transaction after step 6:

```typescript
const po = await tx.purchaseOrder.findFirst({
  where: { id: updated.purchaseOrderId },
  select: {
    createdBy: true,
    quotation: { select: { purchaseRequest: { select: { createdBy: true } } } },
  },
});
```

Then dispatch to both `po.createdBy` (buyer) and `po.quotation.purchaseRequest.createdBy` (RC creator).

### Pitfall 5: RETURN_REGISTERED — no buyer reference in createGoodsReturn

**What goes wrong:** `createGoodsReturn` receives `input.goodsReceiptId`. The GR has a
`purchaseOrderId`. The PO has a `createdBy` (buyer). Getting the buyer requires traversing
goodsReceipt → purchaseOrder → createdBy within the transaction.

**How to avoid:** Fetch the GR with PO relation before creating the return:

```typescript
const receipt = await tx.goodsReceipt.findFirst({
  where: { id: input.goodsReceiptId },
  select: { purchaseOrder: { select: { createdBy: true } } },
});
```

The buyer is `receipt.purchaseOrder?.createdBy`.

---

## Code Examples

### Example 1: Adding BUDGET_EXCEEDED in purchase-requests.service.ts

```typescript
// Source: direct inspection, purchase-requests.service.ts ~line 466
// After: budgetCheck result, before: the tx.purchaseRequest.update
const budgetCheck = await checkBudgetExceeded(
  tx,
  ctx.organizationId,
  rc.requestType,
  rc.farmId,
  rcTotal,
);

await tx.purchaseRequest.update({
  where: { id },
  data: { status: 'APROVADA', budgetExceeded: budgetCheck.exceeded },
});

// Add here: notify approver + FINANCIAL if budget exceeded
if (budgetCheck.exceeded) {
  // Approver (ctx.userId)
  void createNotification(tx, ctx.organizationId, {
    recipientId: ctx.userId,
    type: 'BUDGET_EXCEEDED',
    title: 'Orçamento excedido',
    body: `A aprovação de ${rc.sequentialNumber} ultrapassou o orçamento configurado.`,
    referenceId: id,
    referenceType: 'purchase_request',
  }).catch(() => {});

  // FINANCIAL users
  const financialUsers = await tx.user.findMany({
    where: { organizationId: ctx.organizationId, role: 'FINANCIAL' },
    select: { id: true },
    take: 5,
  });
  for (const u of financialUsers) {
    void createNotification(tx, ctx.organizationId, {
      recipientId: u.id,
      type: 'BUDGET_EXCEEDED',
      title: 'Orçamento excedido',
      body: `Requisição ${rc.sequentialNumber} ultrapassou o orçamento ao ser aprovada.`,
      referenceId: id,
      referenceType: 'purchase_request',
    }).catch(() => {});
  }
}
```

### Example 2: Fixing RETURN_RESOLVED in goods-returns.service.ts

```typescript
// Source: goods-returns.service.ts lines 491-503 (existing wrong dispatch)
// BEFORE (wrong):
void createNotification(tx, ctx.organizationId, {
  recipientId: manager.id,
  type: 'GOODS_RETURN_APPROVED' as any,  // type doesn't exist in NOTIFICATION_TYPES
  ...
}).catch(() => {});

// AFTER (correct):
void createNotification(tx, ctx.organizationId, {
  recipientId: financialUser.id,
  type: 'RETURN_RESOLVED',  // no cast needed — type exists
  title: 'Devolução resolvida',
  body: `Devolução ${gr.sequentialNumber} foi concluída e aguarda processamento financeiro.`,
  referenceId: gr.id,
  referenceType: 'GOODS_RETURN',
}).catch(() => {});
```

Note: change recipient loop from `role: 'MANAGER'` to `role: 'FINANCIAL'` per CONTEXT decision.

### Example 3: EM_COTACAO→OC_EMITIDA navigation in KanbanBoard.tsx

```typescript
// Source: KanbanBoard.tsx lines 151-155 (existing AGUARDANDO_ENTREGA→RECEBIDO pattern)
// Add BEFORE the existing AGUARDANDO_ENTREGA check in handleConfirm:
if (from === 'EM_COTACAO' && to === 'OC_EMITIDA') {
  setConfirmPending(null);
  navigate(`/quotations?purchaseRequestId=${card.id}`);
  return;
}
```

### Example 4: OC_EMITIDA→AGUARDANDO_ENTREGA fix in usePurchasingKanban.ts

```typescript
// Source: usePurchasingKanban.ts lines 122-125 (broken call)
// BEFORE (broken):
} else if (fromCol === 'OC_EMITIDA' && toCol === 'AGUARDANDO_ENTREGA') {
  await api.put(`/org/${orgId}/purchase-orders/${cardId}/status`, { status: 'EM_TRANSITO' });
}

// AFTER (correct):
} else if (fromCol === 'OC_EMITIDA' && toCol === 'AGUARDANDO_ENTREGA') {
  await api.patch(`/org/${orgId}/purchase-orders/${cardId}/transition`, { status: 'EM_TRANSITO' });
}
```

Note: `api.patch` not `api.put` — verify `api` service client exposes a `patch` method.

### Example 5: Confirmation copy for EM_COTACAO→OC_EMITIDA in KanbanBoard.tsx

```typescript
// Source: KanbanBoard.tsx lines 50-54 (current wrong copy)
// BEFORE (misleading — implies PO creation):
'EM_COTACAO->OC_EMITIDA': {
  title: 'Emitir pedido?',
  message: 'A cotação aprovada se tornará um pedido de compra formal.',
  confirmLabel: 'Emitir pedido',
},

// AFTER (correct — redirect to quotations):
'EM_COTACAO->OC_EMITIDA': {
  title: 'Aprovar cotação vencedora?',
  message: 'Para emitir o pedido de compra, é necessário aprovar a cotação vencedora primeiro.',
  confirmLabel: 'Ir para Cotações',
},
```

---

## State of the Art

| Old Approach                    | Current Approach                       | Impact                                                          |
| ------------------------------- | -------------------------------------- | --------------------------------------------------------------- |
| PUT /purchase-orders/:id/status | PATCH /purchase-orders/:id/transition  | Use correct endpoint; old PUT endpoint doesn't exist as a route |
| `GOODS_RETURN_APPROVED` as any  | `RETURN_RESOLVED` (valid enum member)  | Removes TypeScript cast, type-safe                              |
| Kanban creates PO directly      | Kanban navigates to quotation approval | Enforces quotation → PO approval flow                           |

---

## Open Questions

1. **Does the api service client expose a `patch` method?**
   - What we know: `api.get`, `api.post`, `api.put` are used in usePurchasingKanban.ts line 123
   - What's unclear: Whether `api.patch` exists or if it needs to be added
   - Recommendation: Check `apps/frontend/src/services/api.ts` before implementing

2. **Does the quotations page handle `purchaseRequestId` query param?**
   - What we know: CONTEXT says navigate to `/quotations?highlight={quotationId}` but card.id is the RC id
   - What's unclear: What the quotations page actually accepts as filter/highlight params
   - Recommendation: Inspect QuotationsPage route handler to confirm correct param name before implementing

3. **Does `confirmGoodsReceipt` have access to the RC creator through the PO→quotation chain?**
   - What we know: GR has `purchaseOrderId`; PO has `quotation.purchaseRequest.createdBy`
   - What's unclear: Whether the GR include already fetches this chain or requires a new select
   - Recommendation: Inspect `GR_FULL_INCLUDE` constant in goods-receipts.service.ts before implementing

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                        |
| ------------------ | ---------------------------------------------------------------------------- |
| Backend Framework  | Jest 29.7                                                                    |
| Frontend Framework | Vitest 3.0                                                                   |
| Backend config     | `apps/backend/jest.config.*`                                                 |
| Frontend config    | `apps/frontend/vite.config.ts`                                               |
| Backend quick run  | `cd apps/backend && pnpm test -- --testPathPattern=purchase-requests.routes` |
| Backend full suite | `cd apps/backend && pnpm test`                                               |
| Frontend quick run | `cd apps/frontend && pnpm test`                                              |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                       | Test Type          | Automated Command                                                            | File Exists? |
| ------- | -------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------- | ------------ |
| DASH-01 | OC_EMITIDA→AGUARDANDO_ENTREGA calls PATCH /transition          | unit (routes spec) | `cd apps/backend && pnpm test -- --testPathPattern=purchase-orders.routes`   | ✅ exists    |
| DASH-01 | EM_COTACAO→OC_EMITIDA navigates instead of calling API         | unit (hook spec)   | `cd apps/frontend && pnpm test -- usePurchasingKanban`                       | ❌ Wave 0    |
| DASH-03 | BUDGET_EXCEEDED fires on RC APPROVE                            | unit (routes spec) | `cd apps/backend && pnpm test -- --testPathPattern=purchase-requests.routes` | ✅ exists    |
| DASH-03 | BUDGET_EXCEEDED fires on OC EMITIDA                            | unit (routes spec) | `cd apps/backend && pnpm test -- --testPathPattern=purchase-orders.routes`   | ✅ exists    |
| DASH-03 | RETURN_REGISTERED fires on goods return creation               | unit (routes spec) | `cd apps/backend && pnpm test -- --testPathPattern=goods-returns.routes`     | ✅ exists    |
| DASH-03 | RETURN_RESOLVED fires at CONCLUIDA (not GOODS_RETURN_APPROVED) | unit (routes spec) | `cd apps/backend && pnpm test -- --testPathPattern=goods-returns.routes`     | ✅ exists    |
| DASH-03 | PO_GOODS_RECEIVED fires on goods receipt confirmation          | unit (routes spec) | `cd apps/backend && pnpm test -- --testPathPattern=goods-receipts.routes`    | ✅ exists    |

### Sampling Rate

- **Per task commit:** Run the spec for the modified module only
- **Per wave merge:** `cd apps/backend && pnpm test` + `cd apps/frontend && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/frontend/src/hooks/usePurchasingKanban.spec.ts` — covers DASH-01 DnD navigation behavior

_(All backend spec files already exist. One frontend hook spec is missing.)_

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection — all claims verified from actual source files listed in CONTEXT.md canonical refs
- `apps/frontend/src/hooks/usePurchasingKanban.ts` — moveCard function, VALID_TRANSITIONS, broken calls (lines 120-125)
- `apps/frontend/src/components/kanban/KanbanBoard.tsx` — handleConfirm, navigation pattern, confirmation copy
- `apps/backend/src/modules/purchase-orders/purchase-orders.routes.ts` — PATCH /transition exists (line 144)
- `apps/backend/src/modules/purchase-orders/purchase-orders.service.ts` — transitionPO uses `input.status` not `input.action`
- `apps/backend/src/modules/purchase-orders/purchase-orders.types.ts` — TransitionPOInput shape, OC_VALID_TRANSITIONS
- `apps/backend/src/modules/notifications/notifications.types.ts` — all 4 unwired types confirmed in NOTIFICATION_TYPES array
- `apps/backend/src/modules/notifications/notifications.service.ts` — createNotification signature
- `apps/backend/src/modules/purchase-requests/purchase-requests.service.ts` — APPROVE path, budgetCheck exists, notification pattern
- `apps/backend/src/modules/goods-returns/goods-returns.service.ts` — GOODS_RETURN_APPROVED bug confirmed (line 495 with `as any` cast)
- `apps/backend/src/modules/goods-receipts/goods-receipts.service.ts` — confirmGoodsReceipt, PO status update, no PO_GOODS_RECEIVED dispatch
- `apps/backend/src/modules/org-users/org-users.types.ts` — FINANCIAL role confirmed in ASSIGNABLE_ROLES

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries confirmed from source imports
- Architecture: HIGH — all patterns confirmed from existing working code in same codebase
- Pitfalls: HIGH — pitfalls derived from direct code inspection (not speculation)
- Open questions: MEDIUM — two of three require checking one additional file each

**Research date:** 2026-03-19
**Valid until:** 2026-04-18 (stable codebase, 30 days)
