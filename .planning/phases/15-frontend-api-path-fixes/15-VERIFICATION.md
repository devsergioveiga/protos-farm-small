---
phase: 15-frontend-api-path-fixes
verified: 2026-03-19T12:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 15: Frontend API Path Fixes Verification Report

**Phase Goal:** Fix 5 frontend API path mismatches causing 404s in Kanban DnD transitions and notification preferences
**Verified:** 2026-03-19T12:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                               | Status   | Evidence                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Kanban DnD RC_PENDENTE to RC_APROVADA calls POST /org/purchase-requests/:id/transition with body {action:'APPROVE'} | VERIFIED | `usePurchasingKanban.ts` line 117: `api.post('/org/purchase-requests/${cardId}/transition', { action: 'APPROVE' })`                       |
| 2   | Kanban DnD RC_APROVADA to EM_COTACAO calls POST /org/quotations (no orgId segment)                                  | VERIFIED | `usePurchasingKanban.ts` line 119: `api.post('/org/quotations', { purchaseRequestId: cardId })`                                           |
| 3   | Kanban DnD OC_EMITIDA to AGUARDANDO_ENTREGA calls PATCH /org/purchase-orders/:id/transition (no orgId segment)      | VERIFIED | `usePurchasingKanban.ts` line 124: `api.patch('/org/purchase-orders/${cardId}/transition', { status: 'EM_TRANSITO' })`                    |
| 4   | Notification preferences GET and PUT include orgId in path segment                                                  | VERIFIED | `useNotificationPreferences.ts` lines 39+61: both use `/org/${orgId}/notification-preferences`; `useAuth()` called at hook root (line 26) |
| 5   | DAILY_DIGEST appears in NotificationType union and NOTIFICATION_LABELS map                                          | VERIFIED | `useNotifications.ts` line 19: `\| 'DAILY_DIGEST'`; line 36: `DAILY_DIGEST: 'Resumo diario'`                                              |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact                                                     | Expected                                          | Status   | Details                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| `apps/frontend/src/hooks/usePurchasingKanban.ts`             | Corrected DnD API paths without orgId for actions | VERIFIED | Contains `/org/purchase-requests/` at line 117; all 3 action paths fixed |
| `apps/frontend/src/hooks/useNotificationPreferences.ts`      | orgId-injected notification preferences paths     | VERIFIED | Contains `useAuth` import (line 3) and `useAuth()` call (line 26)        |
| `apps/frontend/src/hooks/useNotifications.ts`                | DAILY_DIGEST in type union and label map          | VERIFIED | Contains `DAILY_DIGEST` at lines 19 and 36                               |
| `apps/frontend/src/hooks/useNotificationPreferences.spec.ts` | Tests for notification preferences orgId path     | VERIFIED | New file; 2 tests asserting `/org/org-123/notification-preferences`      |
| `apps/frontend/src/hooks/useNotifications.spec.ts`           | Tests for DAILY_DIGEST label presence             | VERIFIED | New file; 2 tests asserting DAILY_DIGEST key and value                   |

All artifacts exist, are substantive (not stubs), and are wired through test coverage.

---

### Key Link Verification

| From                                     | To                                                         | Via                                       | Status   | Details                                                                               |
| ---------------------------------------- | ---------------------------------------------------------- | ----------------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| `usePurchasingKanban.ts`                 | `purchase-requests.routes.ts` (POST /transition)           | `api.post.*purchase-requests.*transition` | VERIFIED | Line 117 contains correct path; no orgId segment; body `{action:'APPROVE'}` confirmed |
| `useNotificationPreferences.ts`          | `notification-preferences.routes.ts` (GET/PUT /:orgId/...) | `org/${orgId}/notification-preferences`   | VERIFIED | Lines 39 and 61 both contain `org/${orgId}/notification-preferences`                  |
| `usePurchasingKanban.ts` fetch (line 65) | kanban board endpoint (path-param convention)              | `/org/${orgId}/purchasing/kanban`         | VERIFIED | Line 65 unchanged — still carries orgId as required by path-param convention          |

---

### Requirements Coverage

| Requirement | Source Plan   | Description                                                                  | Status    | Evidence                                                                          |
| ----------- | ------------- | ---------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------- |
| DASH-01     | 15-01-PLAN.md | Kanban drag & drop with actions (RC_PENDENTE, RC_APROVADA, OC_EMITIDA flows) | SATISFIED | All 3 DnD action paths corrected; spec tests for all 3 transitions passing        |
| DASH-03     | 15-01-PLAN.md | Notifications with preferences by channel; digest type label                 | SATISFIED | orgId injected into GET/PUT preference paths; DAILY_DIGEST in union and label map |

**Notes on requirement mapping:** Both DASH-01 and DASH-03 are attributed to Phase 13 in the requirements matrix. Phase 15 is a gap-closure phase repairing the broken integration paths that Phase 13 introduced. This is correct — Phase 15 does not own new requirements; it fixes the broken fulfillment of Phase 13 requirements. No orphaned requirements found.

---

### Anti-Patterns Found

| File                     | Line          | Pattern       | Severity | Impact                                                                                                                                                    |
| ------------------------ | ------------- | ------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `usePurchasingKanban.ts` | 122, 129, 131 | `return null` | Info     | These are intentional: lines 122+129 are navigation-delegated transitions (no API call needed), line 131 is success return from real API call. Not stubs. |

No blockers or warnings found.

---

### Human Verification Required

None. All 5 fixes are verifiable programmatically through code inspection and test coverage.

---

### Commits Verified

| Commit     | Description                                                     | Files Changed                                                                                                    |
| ---------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `7ffa3547` | test(15-01): add failing tests for 5 API path fixes (RED phase) | useNotificationPreferences.spec.ts (new), useNotifications.spec.ts (new), usePurchasingKanban.spec.ts (+3 tests) |
| `51a3e165` | feat(15-01): fix 5 frontend API path mismatches (GREEN phase)   | usePurchasingKanban.ts, useNotificationPreferences.ts, useNotifications.ts                                       |

Both commits confirmed present in repository.

---

### Verification Summary

Phase 15 goal is fully achieved. All 5 API path mismatches are corrected in the actual codebase:

1. **RC_PENDENTE to RC_APROVADA** — path changed from `/org/${orgId}/purchase-requests/${cardId}/approve` to `/org/purchase-requests/${cardId}/transition` with body `{action:'APPROVE'}`. Eliminates 404 on the DnD transition.

2. **RC_APROVADA to EM_COTACAO** — path changed from `/org/${orgId}/quotations` to `/org/quotations` (orgId removed). Eliminates 404 on quotation creation from drag.

3. **OC_EMITIDA to AGUARDANDO_ENTREGA** — path changed from `/org/${orgId}/purchase-orders/${cardId}/transition` to `/org/purchase-orders/${cardId}/transition` (orgId removed). Eliminates 404 on order transition.

4. **Notification preferences** — `useAuth()` added to hook, orgId injected into both GET and PUT calls, resolving the `/org/notification-preferences` → `/org/${orgId}/notification-preferences` mismatch.

5. **DAILY_DIGEST label** — type added to `NotificationType` union and label `'Resumo diario'` added to `NOTIFICATION_LABELS`, ensuring the notification bell renders the type correctly.

The kanban board fetch path (`/org/${orgId}/purchasing/kanban`) was correctly left unchanged — it uses the path-param convention and requires orgId.

---

_Verified: 2026-03-19T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
