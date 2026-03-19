# Phase 15: Frontend API Path Fixes - Research

**Researched:** 2026-03-19
**Domain:** Frontend HTTP path mismatches — orgId embedding in API calls
**Confidence:** HIGH — all findings from direct codebase inspection

## Summary

Phase 15 is a pure frontend surgical fix with no backend changes, no new models, and no
migrations. The re-audit identified three integration gaps (INT-01, INT-02, INT-03) that
survived Phase 13 because the verifier only checked code presence, not the actual URL strings
in the HTTP calls.

The root cause is a split convention in the codebase: some backend routes have `:orgId` in
the path (kanban, notification-preferences), while others derive orgId from the JWT
`req.user!.organizationId` (purchase-requests, quotations, purchase-orders). Phase 12 wired
the DnD actions using the kanban convention (with orgId in path), but those three action
endpoints follow the JWT convention (without orgId). Two of the three DnD action transitions
therefore produce 404s.

Additionally, `useNotificationPreferences` calls `/org/notification-preferences` (no orgId)
but the backend registers `/org/:orgId/notification-preferences`. And `useNotifications` omits
`DAILY_DIGEST` from its `NotificationType` union, so the bell renders notifications of that
type without a label.

**Primary recommendation:** Fix all five issues in one frontend-only wave. Three are one-line
path string fixes, one requires injecting orgId via `useAuth()`, and one adds a single entry
to a type union and label map.

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                           | Research Support                                                                                           |
| ------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| DASH-01 | Comprador/gerente pode ver kanban do fluxo de compras com drag & drop com ações obrigatórias          | Fix 3 DnD action API paths: RC_PENDENTE→RC_APROVADA, RC_APROVADA→EM_COTACAO, OC_EMITIDA→AGUARDANDO_ENTREGA |
| DASH-03 | Participantes recebem notificações em cada etapa relevante com configuração de preferências por canal | Fix notification preferences path (INT-02) and add DAILY_DIGEST to frontend type union (INT-03)            |

</phase_requirements>

---

## Standard Stack

### Core (already installed — no new dependencies)

| Library/Tool           | Version | Purpose                                | Already In Use                                      |
| ---------------------- | ------- | -------------------------------------- | --------------------------------------------------- |
| api service client     | project | HTTP calls — get/post/put/patch/delete | Yes — `apps/frontend/src/services/api.ts`           |
| useAuth()              | project | Access `user.organizationId` from JWT  | Yes — `apps/frontend/src/stores/AuthContext.tsx`    |
| NotificationType union | project | Type-safe notification type labels     | Yes — `apps/frontend/src/hooks/useNotifications.ts` |

**No new packages required.** Phase 15 is purely string and type corrections in three files.

---

## Architecture Patterns

### Pattern 1: Backend Route OrgId Convention (the two conflicting patterns)

**JWT convention** (purchase-requests, quotations, purchase-orders):

- Route path: `/org/purchase-requests/:id/transition` (no `:orgId` segment)
- orgId source: `req.user!.organizationId` from JWT
- Frontend must NOT embed orgId in the path

**Path-param convention** (kanban, notification-preferences):

- Route path: `/org/:orgId/purchasing/kanban`
- orgId source: `req.params.orgId`
- Frontend MUST embed orgId in the path

The three DnD action endpoints (purchase-requests, quotations, purchase-orders) all use
the JWT convention. The frontend's `usePurchasingKanban.moveCard` incorrectly uses the
path-param convention for these calls — same bug for all three.

### Pattern 2: orgId Injection via useAuth()

`useNotificationPreferences` currently takes no parameters. To fix INT-02, the hook must
obtain the orgId. The established pattern in `PurchasingKanbanPage.tsx` shows the correct
approach: call `useAuth()` from within the hook (or the caller passes orgId as a param).

Looking at the hook's current signature `useNotificationPreferences()` — the cleanest fix
that minimizes change surface is to call `useAuth()` inside the hook itself:

```typescript
// Source: apps/frontend/src/stores/AuthContext.tsx
import { useAuth } from '../stores/AuthContext';
// ...
const { user } = useAuth();
const orgId = user?.organizationId ?? '';
```

Then use `/org/${orgId}/notification-preferences` in both GET and PUT calls.

### Pattern 3: Fix DnD Action Paths in usePurchasingKanban.ts

The three broken transitions and their correct paths:

| Transition                    | Current (broken)                                           | Correct                                                                         |
| ----------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| RC_PENDENTE→RC_APROVADA       | `POST /org/${orgId}/purchase-requests/${cardId}/approve`   | `POST /org/purchase-requests/${cardId}/transition` with `{ action: 'APPROVE' }` |
| RC_APROVADA→EM_COTACAO        | `POST /org/${orgId}/quotations`                            | `POST /org/quotations`                                                          |
| OC_EMITIDA→AGUARDANDO_ENTREGA | `PATCH /org/${orgId}/purchase-orders/${cardId}/transition` | `PATCH /org/purchase-orders/${cardId}/transition`                               |

For RC_PENDENTE→RC_APROVADA: the backend route is `POST /org/purchase-requests/:id/transition`
(confirmed in `purchase-requests.routes.ts` line 107). The `TransitionPurchaseRequestInput`
interface has `action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'RETURN' | 'CANCEL'` (confirmed in
`purchase-requests.types.ts` line 104). The correct body is `{ action: 'APPROVE' }`.

For RC_APROVADA→EM_COTACAO: the backend route is `POST /org/quotations` (confirmed in
`quotations.routes.ts` line 63 with `const base = '/org/quotations'`). Body stays
`{ purchaseRequestId: cardId }` — only the path changes.

For OC_EMITIDA→AGUARDANDO_ENTREGA: already using `api.patch` and correct body
`{ status: 'EM_TRANSITO' }` from Phase 13. Only the path needs orgId stripped.

### Pattern 4: Adding DAILY_DIGEST to Frontend Type Union

```typescript
// Source: apps/frontend/src/hooks/useNotifications.ts
// Current NotificationType union (lines 4-18) — missing DAILY_DIGEST

// Backend NOTIFICATION_TYPES (notifications.types.ts line 18) — has 'DAILY_DIGEST'

// Fix: add to NotificationType union AND to NOTIFICATION_LABELS map
export type NotificationType =
  | 'RC_APPROVED'
  | ... (existing)
  | 'DAILY_DIGEST'; // ADD

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  ...existing,
  DAILY_DIGEST: 'Resumo diario', // ADD
};
```

### Recommended Project Structure for Changes

```
apps/frontend/src/hooks/
  usePurchasingKanban.ts     — Fix 3 DnD action paths (strip orgId from paths, fix /approve → /transition)
  useNotificationPreferences.ts — Add useAuth() + inject orgId in GET/PUT paths
  useNotifications.ts        — Add DAILY_DIGEST to NotificationType union + NOTIFICATION_LABELS
```

Three files, all in `apps/frontend/src/hooks/`. No other files need changes.

### Anti-Patterns to Avoid

- **Do not add `:orgId` to backend routes**: The three DnD action routes already work correctly for all other callers. Changing the backend to match the broken frontend calls would break the existing service test suite.
- **Do not pass orgId as parameter to useNotificationPreferences**: The hook already has no params. The `useAuth()` approach is self-contained and consistent with how `usePurchasingKanban` gets orgId from the kanban page.
- **Do not remove orgId from the kanban data-fetch call**: `/org/${orgId}/purchasing/kanban` is correct — the kanban route IS path-param convention. Only the action calls inside `moveCard` are wrong.

---

## Don't Hand-Roll

| Problem                       | Don't Build          | Use Instead                                  |
| ----------------------------- | -------------------- | -------------------------------------------- |
| OrgId access in hook          | Custom token decoder | `useAuth()` from `@/stores/AuthContext`      |
| Type-safe notification labels | Custom label lookup  | Extend existing `NOTIFICATION_LABELS` Record |

---

## Common Pitfalls

### Pitfall 1: orgId parameter on the kanban data fetch must NOT be changed

**What goes wrong:** Developer sees all `/org/${orgId}/...` calls in `usePurchasingKanban.ts`
and strips orgId from the kanban board fetch call too.
**Why it happens:** The fetch call at line 64-66 (`/org/${orgId}/purchasing/kanban`) is correct
because the kanban route IS `/org/:orgId/purchasing/kanban`.
**How to avoid:** Only remove orgId from the three `moveCard` action calls. The fetchBoard
call stays unchanged.

### Pitfall 2: RC_PENDENTE→RC_APROVADA requires body change, not just path change

**What goes wrong:** Developer fixes the URL to `/org/purchase-requests/${cardId}/transition`
but forgets to change the body from `{}` (empty — current `api.post(url)` with no body) to
`{ action: 'APPROVE' }`.
**Why it happens:** The original broken call was `api.post(url)` with no body. The transition
service function requires `{ action: ... }`.
**How to avoid:** `await api.post('/org/purchase-requests/${cardId}/transition', { action: 'APPROVE' })`.

### Pitfall 3: DAILY_DIGEST needs both union addition AND label addition

**What goes wrong:** Developer adds `DAILY_DIGEST` to `NotificationType` union but forgets
`NOTIFICATION_LABELS`. TypeScript will catch this because `NOTIFICATION_LABELS` is typed as
`Record<NotificationType, string>` — missing key causes TS error.
**Why it happens:** Two changes in the same file, easy to miss the second.
**How to avoid:** Add both in the same edit. TS compiler will flag if `NOTIFICATION_LABELS` is
incomplete.

### Pitfall 4: useAuth() hook must be called at hook root, not inside callbacks

**What goes wrong:** `useAuth()` called inside the `fetchPreferences` or `togglePreference`
callback — violates Rules of Hooks.
**How to avoid:** Call `useAuth()` at the top level of `useNotificationPreferences`, same as
`useState`/`useCallback` calls. Assign to a variable, use inside callbacks via closure.

---

## Code Examples

### Fix 1: usePurchasingKanban.ts — three broken paths in moveCard

```typescript
// Source: apps/frontend/src/hooks/usePurchasingKanban.ts lines 116-126
// BEFORE (broken):
if (fromCol === 'RC_PENDENTE' && toCol === 'RC_APROVADA') {
  await api.post(`/org/${orgId}/purchase-requests/${cardId}/approve`);
} else if (fromCol === 'RC_APROVADA' && toCol === 'EM_COTACAO') {
  await api.post(`/org/${orgId}/quotations`, { purchaseRequestId: cardId });
} else if (fromCol === 'OC_EMITIDA' && toCol === 'AGUARDANDO_ENTREGA') {
  await api.patch(`/org/${orgId}/purchase-orders/${cardId}/transition`, {
    status: 'EM_TRANSITO',
  });
}

// AFTER (correct):
if (fromCol === 'RC_PENDENTE' && toCol === 'RC_APROVADA') {
  await api.post(`/org/purchase-requests/${cardId}/transition`, { action: 'APPROVE' });
} else if (fromCol === 'RC_APROVADA' && toCol === 'EM_COTACAO') {
  await api.post('/org/quotations', { purchaseRequestId: cardId });
} else if (fromCol === 'OC_EMITIDA' && toCol === 'AGUARDANDO_ENTREGA') {
  await api.patch(`/org/purchase-orders/${cardId}/transition`, {
    status: 'EM_TRANSITO',
  });
}
```

The `orgId` variable is still available in `moveCard` closure (used for fetchBoard) — no
parameter changes needed in the hook's public interface.

### Fix 2: useNotificationPreferences.ts — inject orgId into GET/PUT paths

```typescript
// Source: apps/frontend/src/hooks/useNotificationPreferences.ts
// Add import at top:
import { useAuth } from '../stores/AuthContext';

// Inside useNotificationPreferences function, before useState declarations:
const { user } = useAuth();
const orgId = user?.organizationId ?? '';

// fetchPreferences:
const data = await api.get<NotificationPreference[]>(`/org/${orgId}/notification-preferences`);

// togglePreference:
await api.put(`/org/${orgId}/notification-preferences`, { eventType, channel, enabled });
```

Note: `orgId` is a stable string derived from the JWT — no extra dependency in `useCallback`
deps arrays needed if accessed via closure from the outer hook scope.

### Fix 3: useNotifications.ts — add DAILY_DIGEST

```typescript
// Source: apps/frontend/src/hooks/useNotifications.ts lines 4-35
// Add to NotificationType union:
| 'DAILY_DIGEST'

// Add to NOTIFICATION_LABELS Record:
DAILY_DIGEST: 'Resumo diario',
```

---

## State of the Art

| Old Pattern                                            | Correct Pattern                                                            | Impact             |
| ------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------ |
| `POST /org/${orgId}/purchase-requests/${id}/approve`   | `POST /org/purchase-requests/${id}/transition` + body `{action:'APPROVE'}` | 404 → 200          |
| `POST /org/${orgId}/quotations`                        | `POST /org/quotations`                                                     | 404 → 201          |
| `PATCH /org/${orgId}/purchase-orders/${id}/transition` | `PATCH /org/purchase-orders/${id}/transition`                              | 404 → 200          |
| `GET/PUT /org/notification-preferences`                | `GET/PUT /org/${orgId}/notification-preferences`                           | 404 → 200          |
| NotificationType without DAILY_DIGEST                  | Union includes DAILY_DIGEST                                                | bell renders label |

---

## Open Questions

1. **Does the optimistic rollback in moveCard correctly handle the new /approve→/transition path?**
   - What we know: The rollback logic is in the catch block after the API call — it restores `prevColumns` regardless of which transition failed.
   - What's unclear: Nothing — the rollback is path-agnostic, it works the same way for the corrected paths.
   - Recommendation: No change needed for rollback.

2. **Does RC_APROVADA→EM_COTACAO need to block the move if a quotation already exists?**
   - What we know: The Kanban query places RCs with existing quotations in EM_COTACAO, not RC_APROVADA (Phase 12 decision). So a card in RC_APROVADA by definition has no quotation yet.
   - What's unclear: Nothing — the backend createQuotation call is idempotent enough for this use case.
   - Recommendation: No guard needed beyond what already exists.

3. **Is `user?.organizationId` ever null when useNotificationPreferences is called?**
   - What we know: The NotificationPreferencesPage is behind a route that requires authentication. The `useAuth()` user object has `organizationId: string | null` type (from express.d.ts).
   - What's unclear: Whether an authenticated user can have `null` organizationId (SUPER_ADMIN scenario).
   - Recommendation: The `?? ''` fallback is safe — an empty orgId will get a 400 from the backend, same as today's 404. No additional guard needed.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                  |
| ------------------ | ------------------------------------------------------ |
| Frontend Framework | Vitest 3.0                                             |
| Config file        | `apps/frontend/vite.config.ts`                         |
| Quick run command  | `cd apps/frontend && pnpm test -- usePurchasingKanban` |
| Full suite command | `cd apps/frontend && pnpm test`                        |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                                              | Test Type        | Automated Command                                             | File Exists? |
| ------- | ----------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------- | ------------ |
| DASH-01 | RC_PENDENTE→RC_APROVADA calls `POST /org/purchase-requests/:id/transition` with `{action:'APPROVE'}`  | unit (hook spec) | `cd apps/frontend && pnpm test -- usePurchasingKanban`        | ✅ exists    |
| DASH-01 | RC_APROVADA→EM_COTACAO calls `POST /org/quotations` without orgId segment                             | unit (hook spec) | `cd apps/frontend && pnpm test -- usePurchasingKanban`        | ✅ exists    |
| DASH-01 | OC_EMITIDA→AGUARDANDO_ENTREGA calls `PATCH /org/purchase-orders/:id/transition` without orgId segment | unit (hook spec) | `cd apps/frontend && pnpm test -- usePurchasingKanban`        | ✅ exists    |
| DASH-03 | GET notification preferences calls `/org/${orgId}/notification-preferences`                           | unit (hook spec) | `cd apps/frontend && pnpm test -- useNotificationPreferences` | ❌ Wave 0    |
| DASH-03 | PUT notification preference calls `/org/${orgId}/notification-preferences`                            | unit (hook spec) | `cd apps/frontend && pnpm test -- useNotificationPreferences` | ❌ Wave 0    |
| DASH-03 | DAILY_DIGEST has a label in NOTIFICATION_LABELS                                                       | unit (hook spec) | `cd apps/frontend && pnpm test -- useNotifications`           | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** Run the spec for the modified hook only
- **Per wave merge:** `cd apps/frontend && pnpm test`
- **Phase gate:** Full frontend suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/frontend/src/hooks/useNotificationPreferences.spec.ts` — covers DASH-03 preference path with orgId
- [ ] `apps/frontend/src/hooks/useNotifications.spec.ts` — covers DASH-03 DAILY_DIGEST label presence

The `usePurchasingKanban.spec.ts` already exists from Phase 13 Wave 0. The three DnD path fixes
must update assertions in that existing spec to verify the corrected path strings.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection — all claims verified from source files
- `apps/frontend/src/hooks/usePurchasingKanban.ts` — moveCard broken paths confirmed (lines 117, 119, 124)
- `apps/frontend/src/hooks/useNotificationPreferences.ts` — wrong path confirmed (lines 35, 56)
- `apps/frontend/src/hooks/useNotifications.ts` — DAILY_DIGEST absent from union and labels (lines 4-35)
- `apps/backend/src/modules/purchase-requests/purchase-requests.routes.ts` — `POST /org/purchase-requests/:id/transition` (line 107), no `/approve` route
- `apps/backend/src/modules/purchase-requests/purchase-requests.types.ts` — `action: 'APPROVE'` in TransitionInput (line 104)
- `apps/backend/src/modules/quotations/quotations.routes.ts` — `POST /org/quotations` (lines 21, 63)
- `apps/backend/src/modules/purchase-orders/purchase-orders.routes.ts` — `PATCH /org/purchase-orders/:id/transition` (no `:orgId` in path)
- `apps/backend/src/modules/notification-preferences/notification-preferences.routes.ts` — `/org/:orgId/notification-preferences` (lines 10, 29)
- `apps/backend/src/modules/notifications/notifications.types.ts` — DAILY_DIGEST in NOTIFICATION_TYPES (line 18)
- `apps/frontend/src/stores/AuthContext.tsx` — `useAuth()` returns `user.organizationId` (line 8)
- `.planning/v1.1-MILESTONE-AUDIT.md` — INT-01, INT-02, INT-03 gap descriptions with evidence

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries confirmed from source imports
- Architecture: HIGH — all paths and patterns confirmed from direct source reading
- Pitfalls: HIGH — derived from direct code inspection, not speculation
- Open questions: HIGH — all three are resolved or trivially handled

**Research date:** 2026-03-19
**Valid until:** 2026-04-18 (stable codebase, 30 days)
