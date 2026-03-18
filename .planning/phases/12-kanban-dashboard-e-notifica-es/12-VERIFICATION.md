---
phase: 12-kanban-dashboard-e-notifica-es
verified: 2026-03-18T12:00:00Z
status: gaps_found
score: 14/15 must-haves verified
re_verification: false
gaps:
  - truth: 'Filter bar above board allows filtering by farm, urgency, supplier, date range'
    status: partial
    reason: 'Farm and supplier filter controls are not rendered in PurchaseKanbanPage.tsx UI. The hook (usePurchaseKanban.ts) supports farmId and supplierId in its interface and builds query params for them, but no UI inputs exist in the page to let the user set these values.'
    artifacts:
      - path: 'apps/frontend/src/pages/PurchaseKanbanPage.tsx'
        issue: 'Only urgency and date range filter controls are rendered (lines 163-200). No farmId or supplierId <select> or <input> present.'
    missing:
      - 'Add a farm selector control bound to filters.farmId in the filter bar'
      - 'Add a supplier selector control bound to filters.supplierId in the filter bar'
human_verification:
  - test: 'Open /purchase-kanban and drag a card to another column'
    expected: 'ConfirmModal appears with card number, from-column and to-column labels. Confirming calls POST /api/org/purchase-kanban/transition. Success toast appears.'
    why_human: 'Drag-and-drop interaction and modal trigger cannot be verified programmatically from static analysis.'
  - test: 'Open /purchase-kanban with active P2P pipeline data — verify cards appear in correct column'
    expected: 'RC with status PENDENTE lands in RC_PENDENTE. RC with approved quotation but no PO lands in EM_COTACAO. Emergency PO without RC starts at OC_EMITIDA.'
    why_human: 'Column assignment logic depends on live database state across multiple joined tables.'
  - test: 'Open /purchase-dashboard and select each period preset (Mes atual, Trimestre, Safra, Ano)'
    expected: 'KPI values reload and comparison badge percentages update to reflect the selected period vs the immediately preceding same-length period.'
    why_human: 'Time-dependent data comparison requires live backend; cannot be verified from code alone.'
  - test: 'Open NotificationBell dropdown and click Preferencias gear icon'
    expected: 'NotificationPreferencesModal opens. Role sections (Solicitante, Aprovador, Comprador, Financeiro, Gerente) are visible with IN_APP and PUSH toggles per event type. Toggling and saving persists via PATCH /api/org/notifications/preferences.'
    why_human: 'Interactive modal behavior and persistence require browser testing.'
---

# Phase 12: Kanban Dashboard e Notificacoes — Verification Report

**Phase Goal:** Comprador e gerente tem visibilidade total do fluxo de compras via kanban e dashboard executivo, com notificacoes em cada etapa relevante do processo

**Verified:** 2026-03-18T12:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                      | Status                 | Evidence                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | GET /api/org/purchase-kanban returns cards pre-assigned to 7 kanban columns                | VERIFIED               | `getKanbanCards` in purchase-kanban.service.ts (331 lines) joins RC->Quotation->PO->GR->Payable via `assignColumnFromRc` + `assignColumnFromEmergencyPo` helpers                              |
| 2   | POST /api/org/purchase-kanban/transition moves a card to a new column                      | VERIFIED               | `transitionCard` in service validates ALLOWED_TRANSITIONS, dispatches APPROVE for RC_PENDENTE->APROVADA, returns instructional 400 for other columns                                          |
| 3   | Cards include number, type, requester, value, urgency, daysInStage, isOverdue              | VERIFIED               | KanbanCard interface in purchase-kanban.types.ts (57 lines) + service maps all fields; KanbanCard.tsx renders all fields including UrgencyBadge, AlertTriangle for overdue, Zap for emergency |
| 4   | Emergency POs without RC appear starting at OC_EMITIDA column                              | VERIFIED               | `assignColumnFromEmergencyPo` handles isEmergency=true + quotationId=null POs, sets urgency EMERGENCIAL                                                                                       |
| 5   | Filter bar allows filtering by farm, urgency, supplier, date range                         | PARTIAL                | Hook supports all 4 filter params; page UI only renders urgency and date range — farm and supplier inputs are absent from PurchaseKanbanPage.tsx                                              |
| 6   | GET /api/org/purchase-dashboard returns 5 KPIs with current and previous period values     | VERIFIED               | `getDashboardMetrics` uses Promise.all comparison period pattern (same-length preceding period), returns DashboardMetrics with 5 KpiValue fields                                              |
| 7   | Dashboard returns chart data for purchases by category, saving evolution, budget vs actual | VERIFIED               | service returns DashboardCharts with purchasesByCategory, savingEvolution, budgetVsActual; 3 Recharts components (BarChart, LineChart, ComposedChart) lazy-loaded in PurchaseDashboardPage    |
| 8   | Dashboard returns alerts section with pending RCs aging, overdue POs, budget overages      | VERIFIED               | `getDashboardAlerts` returns DashboardAlert array with PENDING_RC_AGING/PO_OVERDUE/BUDGET_OVERAGE types; alerts panel renders with navigation links                                           |
| 9   | GET /api/org/notification-preferences returns user notification preferences                | VERIFIED               | GET route at `${base}/preferences` in notifications.routes.ts (line 84-95), backed by `getPreferences` in notification-preferences.service.ts                                                 |
| 10  | PATCH /api/org/notification-preferences updates user notification preferences              | VERIFIED               | PATCH route at `${base}/preferences` in notifications.routes.ts (line 96-115), backed by `updatePreferences` with upsert pattern                                                              |
| 11  | createNotification checks NotificationPreference before dispatching                        | VERIFIED               | `createNotificationIfEnabled` in notifications.service.ts (line 110) uses dynamic import of `isNotificationEnabled` to check preference before calling `createNotification`                   |
| 12  | NotificationPreference model exists in Prisma schema                                       | VERIFIED               | `model NotificationPreference` at schema line 6183 with `@@unique([organizationId, userId, eventType, channel])` and `@@map("notification_preferences")`                                      |
| 13  | User sees 7-column kanban board with cards in correct columns                              | VERIFIED (needs human) | PurchaseKanbanPage.tsx with DndContext, 7 KanbanColumn components via KANBAN_COLUMNS_CONFIG; wired to usePurchaseKanban hook                                                                  |
| 14  | Manager sees 5 KPI cards with current value and % change vs previous period                | VERIFIED               | PurchaseDashboardPage.tsx renders 5 KpiCard instances (totalVolume, requestCount, avgCycleTimeDays, onTimeDeliveryPct, accumulatedSaving) with ChangeBadge showing ArrowUp/ArrowDown          |
| 15  | User can open notification preferences from the bell dropdown                              | VERIFIED               | NotificationBell.tsx imports NotificationPreferencesModal, has showPrefs state, Settings icon button renders NotificationPreferencesModal on click                                            |

**Score:** 14/15 truths verified (1 partial)

---

## Required Artifacts

### Backend — Plan 01 (DASH-01)

| Artifact                                                                  | Status   | Lines           | Details                                                                                   |
| ------------------------------------------------------------------------- | -------- | --------------- | ----------------------------------------------------------------------------------------- |
| `apps/backend/src/modules/purchase-kanban/purchase-kanban.types.ts`       | VERIFIED | 57              | Exports KanbanColumn, KanbanCard, KanbanFilters, ALLOWED_TRANSITIONS, PurchaseKanbanError |
| `apps/backend/src/modules/purchase-kanban/purchase-kanban.service.ts`     | VERIFIED | 331             | Exports getKanbanCards (with withRlsContext + assignColumn logic) and transitionCard      |
| `apps/backend/src/modules/purchase-kanban/purchase-kanban.routes.ts`      | VERIFIED | 89              | Exports purchaseKanbanRouter with GET + POST handlers                                     |
| `apps/backend/src/modules/purchase-kanban/purchase-kanban.routes.spec.ts` | VERIFIED | 28 test clauses | Covers response shape, filtering, transitions                                             |

### Backend — Plan 02 (DASH-02, DASH-03)

| Artifact                                                                        | Status   | Lines           | Details                                                                                     |
| ------------------------------------------------------------------------------- | -------- | --------------- | ------------------------------------------------------------------------------------------- |
| `apps/backend/src/modules/purchase-dashboard/purchase-dashboard.types.ts`       | VERIFIED | 71              | Exports DashboardMetrics, KpiValue, DashboardCharts, DashboardAlert, PurchaseDashboardError |
| `apps/backend/src/modules/purchase-dashboard/purchase-dashboard.service.ts`     | VERIFIED | 562             | Exports getDashboardMetrics (5 KPIs + charts + cache) and getDashboardAlerts                |
| `apps/backend/src/modules/purchase-dashboard/purchase-dashboard.routes.ts`      | VERIFIED | present         | GET /org/purchase-dashboard and GET /org/purchase-dashboard/alerts                          |
| `apps/backend/src/modules/purchase-dashboard/purchase-dashboard.routes.spec.ts` | VERIFIED | 25 test clauses | Covers date validation, response shapes, alerts, preference routes                          |
| `apps/backend/src/modules/notifications/notification-preferences.service.ts`    | VERIFIED | 101             | Exports getPreferences, updatePreferences, isNotificationEnabled                            |
| `apps/backend/prisma/schema.prisma` (NotificationPreference model)              | VERIFIED | lines 6183-6198 | Model with unique constraint and table mapping                                              |

### Frontend — Plan 03 (DASH-01)

| Artifact                                                        | Status   | Lines   | Details                                                                                                           |
| --------------------------------------------------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `apps/frontend/src/hooks/usePurchaseKanban.ts`                  | VERIFIED | 154     | Fetches /org/purchase-kanban, builds cardsByColumn, exposes transitionCard                                        |
| `apps/frontend/src/components/purchase-kanban/KanbanColumn.tsx` | VERIFIED | 86      | useDroppable + SortableContext + count badge + empty state                                                        |
| `apps/frontend/src/components/purchase-kanban/KanbanCard.tsx`   | VERIFIED | 216     | useSortable + CSS.Transform + UrgencyBadge + AlertTriangle + "Emergencial direto" badge                           |
| `apps/frontend/src/pages/PurchaseKanbanPage.tsx`                | VERIFIED | 288     | DndContext + DragOverlay + ConfirmModal + filter bar (partial — no farm/supplier inputs) + skeleton + empty state |
| `apps/frontend/src/pages/PurchaseKanbanPage.css`                | VERIFIED | present | .kanban-board, .kanban-column, .kanban-card with design system tokens                                             |

### Frontend — Plan 04 (DASH-02, DASH-03)

| Artifact                                                                      | Status   | Lines   | Details                                                                   |
| ----------------------------------------------------------------------------- | -------- | ------- | ------------------------------------------------------------------------- |
| `apps/frontend/src/hooks/usePurchaseDashboard.ts`                             | VERIFIED | 129     | Promise.all fetch for metrics+charts + alerts                             |
| `apps/frontend/src/hooks/useNotificationPreferences.ts`                       | VERIFIED | present | GET/PATCH preferences, dirty tracking, NOTIFICATION_EVENT_GROUPS          |
| `apps/frontend/src/components/purchase-dashboard/PurchaseCategoryChart.tsx`   | VERIFIED | present | BarChart + ResponsiveContainer + pt-BR BRL tooltip                        |
| `apps/frontend/src/components/purchase-dashboard/PurchaseSavingChart.tsx`     | VERIFIED | present | LineChart + ResponsiveContainer + pt-BR BRL tooltip                       |
| `apps/frontend/src/components/purchase-dashboard/BudgetVsActualChart.tsx`     | VERIFIED | present | ComposedChart + dual Bar (green budget, orange actual)                    |
| `apps/frontend/src/components/notifications/NotificationPreferencesModal.tsx` | VERIFIED | 504     | Grouped role sections + IN_APP/PUSH toggles + isDirty save guard          |
| `apps/frontend/src/pages/PurchaseDashboardPage.tsx`                           | VERIFIED | 473     | 5 KpiCard, 3 lazy Recharts charts, period presets, alerts panel, skeleton |
| `apps/frontend/src/pages/PurchaseDashboardPage.css`                           | VERIFIED | present | .kpi-grid responsive, @keyframes pulse, chart and alert styles            |

---

## Key Link Verification

| From                                | To                                               | Via                                                   | Status | Details                                                                                                      |
| ----------------------------------- | ------------------------------------------------ | ----------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| purchase-kanban.service.ts          | PurchaseRequest, Quotation, PO, GR, Payable      | tx.purchaseRequest.findMany with nested includes      | WIRED  | Line 200 confirms Prisma query with pipeline includes                                                        |
| purchase-kanban.routes.ts           | app.ts                                           | purchaseKanbanRouter import + app.use('/api', ...)    | WIRED  | app.ts line 105 import, line 216 registration                                                                |
| PurchaseKanbanPage.tsx              | /api/org/purchase-kanban                         | usePurchaseKanban hook                                | WIRED  | Hook line 93: api.get(`/org/purchase-kanban...`)                                                             |
| PurchaseKanbanPage.tsx              | App.tsx                                          | lazy route /purchase-kanban                           | WIRED  | App.tsx line 106 lazy import, line 212 route                                                                 |
| Sidebar.tsx                         | /purchase-kanban                                 | COMPRAS group item                                    | WIRED  | Sidebar line 207: `{ to: '/purchase-kanban', icon: Kanban, label: 'Kanban' }`                                |
| purchase-dashboard.service.ts       | PurchaseRequest, PO, GR, Payable, PurchaseBudget | Promise.all parallel queries                          | WIRED  | Service line 291: `const [current, previous] = await Promise.all(...)`                                       |
| purchase-dashboard.routes.ts        | app.ts                                           | purchaseDashboardRouter import + app.use('/api', ...) | WIRED  | app.ts line 106 import, line 217 registration                                                                |
| PurchaseDashboardPage.tsx           | /api/org/purchase-dashboard                      | usePurchaseDashboard hook                             | WIRED  | Hook lines 99-103: api.get calls to /org/purchase-dashboard and /org/purchase-dashboard/alerts               |
| PurchaseDashboardPage.tsx           | App.tsx                                          | lazy route /purchase-dashboard                        | WIRED  | App.tsx line 107 lazy import, line 213 route                                                                 |
| Sidebar.tsx                         | /purchase-dashboard                              | COMPRAS group item                                    | WIRED  | Sidebar line 217: `{ to: '/purchase-dashboard', icon: LayoutDashboard, label: 'Dashboard' }`                 |
| notification-preferences.service.ts | notifications.service.ts createNotification      | isNotificationEnabled check before dispatch           | WIRED  | notifications.service.ts line 115: dynamic import of isNotificationEnabled before calling createNotification |
| NotificationBell.tsx                | NotificationPreferencesModal.tsx                 | Settings gear icon opening modal                      | WIRED  | NotificationBell.tsx imports NotificationPreferencesModal, showPrefs state controls it (lines 6, 62, 202)    |
| useNotificationPreferences.ts       | /api/org/notifications/preferences               | GET + PATCH                                           | WIRED  | Lines 79 (GET) and 143 (PATCH)                                                                               |
| notifications.routes.ts             | preference routes BEFORE /:id/read               | Express route ordering                                | WIRED  | GET/PATCH preferences at lines 84 and 96, before /:id/read                                                   |

---

## Requirements Coverage

| Requirement | Source Plan                       | Description                                                                                        | Status    | Evidence                                                                                                                  |
| ----------- | --------------------------------- | -------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------- |
| DASH-01     | 12-01 (backend), 12-03 (frontend) | Kanban do fluxo de compras com 7 colunas, cards, drag & drop, filtros, alertas visuais, contadores | PARTIAL   | All features implemented except farm/supplier filter controls missing from page UI                                        |
| DASH-02     | 12-02 (backend), 12-04 (frontend) | Dashboard executivo com 5 KPIs, graficos por categoria, comparativo periodo anterior, filtros      | SATISFIED | Backend 5 KPIs + comparison period + 3 chart datasets; frontend 5 KpiCard + 3 lazy Recharts + period presets              |
| DASH-03     | 12-02 (backend), 12-04 (frontend) | Notificacoes por etapa com configuracao de preferencias por canal                                  | SATISFIED | NotificationPreference model + preference CRUD + createNotificationIfEnabled + modal with grouped toggles by role context |

---

## Anti-Patterns Found

No blockers or significant anti-patterns detected.

| File                          | Line   | Pattern                       | Severity | Impact                                      |
| ----------------------------- | ------ | ----------------------------- | -------- | ------------------------------------------- |
| purchase-dashboard.service.ts | 23, 26 | `return null` in cache helper | Info     | Intentional cache miss returns — not a stub |

---

## Human Verification Required

### 1. Drag-and-Drop Transition with ConfirmModal

**Test:** Open /purchase-kanban with at least one active RC, drag a card to an adjacent allowed column.
**Expected:** ConfirmModal appears showing the card number and from/to column labels. Confirming executes POST /api/org/purchase-kanban/transition. A success toast "Transicao realizada com sucesso" appears and the card moves visually.
**Why human:** Drag-and-drop interaction sequence and modal trigger timing cannot be verified from static code analysis.

### 2. Kanban Column Assignment Accuracy

**Test:** Seed the database with RCs at each stage of the pipeline (pending, approved, in-quotation, PO issued, goods received, paid) plus an emergency PO with no RC. Load /purchase-kanban.
**Expected:** Each card appears in the correct column. Emergency PO card shows "Emergencial direto" badge and lands in OC_EMITIDA or deeper.
**Why human:** Column assignment correctness depends on actual join results across 5 related tables.

### 3. Dashboard Period Filter and Comparison Badges

**Test:** Open /purchase-dashboard, click "Mes atual" then "Trimestre" presets. Observe KPI values and comparison badges update.
**Expected:** Values change between presets. Comparison badge shows arrow + percentage. Ciclo Medio shows green badge for negative change (lower cycle time is better) due to invertColors prop.
**Why human:** Time-dependent data requires live backend; period comparison accuracy requires actual data.

### 4. Notification Preferences Persistence

**Test:** Open NotificationBell, click Preferencias. Toggle off "RC_REJECTED" for IN_APP. Click Salvar. Reload page, reopen modal.
**Expected:** RC_REJECTED IN_APP toggle remains off. Subsequent notifications of that type are suppressed for the user via createNotificationIfEnabled.
**Why human:** Preference opt-out behavior requires full end-to-end test with notification dispatch.

---

## Gaps Summary

One gap found affecting DASH-01 partial satisfaction:

**Missing farm and supplier filter controls in PurchaseKanbanPage.tsx**

The plan truth "Filter bar above board allows filtering by farm, urgency, supplier, date range" is only partially met. The filter bar renders urgency and date range controls, but farmId and supplierId inputs are absent. The hook already supports these parameters and passes them to the API, so adding the UI controls is a small, self-contained fix. This does not block the core kanban visibility goal but reduces filter utility for multi-farm organizations.

The DASH-01 requirement text says "filtros" generically — filters exist (urgency + dates work). However the plan explicitly listed farm and supplier as required filter dimensions.

---

_Verified: 2026-03-18T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
