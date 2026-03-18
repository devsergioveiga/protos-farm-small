# Phase 12: Kanban, Dashboard e Notificações - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver visibility and operational control over the entire purchase cycle (P2P). Three capabilities:

1. **Kanban board** — visual workflow with drag & drop that triggers real state transitions
2. **Executive dashboard** — KPIs, charts, and comparatives for purchase management
3. **Notification preferences** — user-configurable notification settings per event type and channel

Requirements: DASH-01, DASH-02, DASH-03

</domain>

<decisions>
## Implementation Decisions

### Kanban Board (DASH-01)

- **Columns:** RC Pendente → Aprovada → Em Cotação → OC Emitida → Aguardando Entrega → Recebido → Pago (7 columns per DASH-01)
- **Drag & drop:** Triggers confirmation modal before executing state transition — never silent transitions
- **DnD library:** @dnd-kit/sortable (modern, tree-shakeable, lighter than react-beautiful-dnd)
- **Card content:** Compact cards showing nº/tipo/solicitante/valor/urgência/dias no estágio
- **Card badges:** Urgency color coding (normal/urgente/emergencial) + overdue alert icon when SLA exceeded
- **Column counters:** Badge with item count per column in header
- **Filters:** Farm, category, urgency, supplier, date range — filter bar above board
- **Drill-down:** Click card opens detail modal for the relevant entity (RC, Quotation, PO, or GoodsReceipt depending on column)

### Executive Dashboard (DASH-02)

- **Layout:** Top row with 5 KPI cards, below 2-column grid with charts
- **Primary KPIs:** Volume total (R$), Nº requisições/pedidos, Prazo médio ciclo (dias), % entrega no prazo, Saving acumulado (R$)
- **Comparison:** Each KPI shows % change badge vs previous same-length period (green up / red down arrow)
- **Charts:** BarChart for purchases by category, LineChart for saving evolution, ComposedChart for budget vs actual
- **Period filter:** Preset buttons (Mês atual, Trimestre, Safra, Ano) + custom date range picker — consistent with SavingAnalysisPage pattern
- **Filters:** Farm, category (applied to all charts/KPIs simultaneously)
- **Alerts section:** Bottom panel with requisições pendentes aging, pedidos em atraso, budget overages
- **Chart library:** Recharts (already in use, lazy-loaded via React.lazy + Suspense)

### Notification Preferences (DASH-03)

- **Granularity:** Per-event-type toggle (on/off) grouped by role context (Solicitante, Aprovador, Comprador, Financeiro, Gerente)
- **Channels:** In-app badge + push mobile (email is placeholder — real SMTP deferred to v1.2)
- **Digest:** Daily digest toggle for managers — aggregated morning notification with all pending items
- **Storage:** New NotificationPreference model (userId, eventType, channel, enabled)
- **Default:** All notifications enabled on first use — user opts out of what they don't want
- **Events covered (per DASH-03):**
  - Solicitante: aprovação, rejeição, entrega confirmada
  - Aprovador: nova pendência, lembrete SLA
  - Comprador: RC aprovada, cotação recebida, prazo entrega
  - Financeiro: recebimento confirmado
  - Gerente: digest diário
- **Preferences page:** Settings sub-page or modal accessible from NotificationBell dropdown

### Cycle Metrics Aggregation

- **Backend:** Dedicated dashboard service that queries timestamps across RC→SC→OC→REC pipeline
- **Caching:** 5-minute TTL cache on dashboard endpoint — avoids heavy cross-entity joins on every page load
- **Metrics computed:** Avg cycle time (RC created → Payable paid), % on-time delivery, urgent vs planned ratio, top 10 products by spend, top 5 suppliers by volume
- **Comparison:** Current period vs previous same-length period with percentage change

### Claude's Discretion

- Exact KPI card styling and iconography
- Dashboard skeleton loading layout
- Chart color palette (should follow design system tokens)
- Kanban column width and card height
- Notification preference UI layout details
- Caching implementation (in-memory vs Redis)
- Whether to add WebSocket for real-time kanban updates or keep polling

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` — DASH-01 (Kanban), DASH-02 (Dashboard executivo), DASH-03 (Notificações)

### Design System

- `docs/design-system/04-componentes.md` — Component specs (modals, cards, badges, empty states)
- `docs/design-system/05-padroes-ux.md` — UX patterns (breadcrumbs, navigation depth, loading)
- `docs/design-system/01-cores.md` — Color tokens for status badges and chart palette

### Prior Phase Context

- `.planning/phases/08-requisi-o-e-aprova-o/08-CONTEXT.md` — Notification system foundation, approval workflow, SLA patterns
- `.planning/phases/11-devolu-o-or-amento-e-saving/11-CONTEXT.md` — Saving analysis patterns, budget execution dashboard, Recharts usage

### Existing Code Patterns

- `apps/frontend/src/pages/FinancialDashboardPage.tsx` — Dashboard layout pattern with KPI cards + charts
- `apps/frontend/src/pages/SavingAnalysisPage.tsx` — Period filter pattern, Recharts chart components
- `apps/frontend/src/hooks/useNotifications.ts` — Notification hook pattern to extend
- `apps/backend/src/modules/notifications/notifications.types.ts` — Existing notification types to extend

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `useNotifications` hook: Extend with preference-aware filtering (already has mark-read, poll, refresh)
- `FinancialDashboardPage`: KPI card grid pattern, chart lazy-loading, period selector — reuse layout structure
- `SavingAnalysisPage`: Recharts chart components (BarChart, LineChart), period preset buttons, filter pattern
- `STATUS_CONFIG` pattern from PurchaseRequestsPage: Status badge with icon+className — extend to kanban cards
- `ConfirmModal`: Reuse for drag-drop transition confirmations
- Recharts v3.7.0: Already installed, lazy-loaded pattern established
- Alert count hooks (useOverdueCount pattern): Reuse for kanban column counters

### Established Patterns

- Dashboard pages: hook fetches metrics → skeleton loading → KPI cards top → charts bottom → period filter
- Chart components: lazy-loaded via React.lazy + Suspense, ResponsiveContainer wrapper, pt-BR locale formatting
- State machines: VALID_TRANSITIONS map + canTransition() per entity — kanban drag validates against these
- Sidebar: COMPRAS group already has 9 items — kanban and dashboard add 2 more
- Modal forms: key-remount pattern for edit mode, onSuccess callback, no useState in useEffect
- HTML5 drag events: Used in Phase 8 for approval rule reorder (lightweight precedent)

### Integration Points

- Backend app.ts: Add kanban + dashboard routes (line ~207, after savingAnalysisRouter)
- Frontend App.tsx: Add lazy routes for /purchase-kanban and /purchase-dashboard
- Sidebar.tsx: Add Kanban and Dashboard items to COMPRAS group
- Notification types: Extend enum with new event types for digest
- Prisma schema: Add NotificationPreference model

</code_context>

<specifics>
## Specific Ideas

- Kanban should aggregate entities across the entire P2P pipeline — a single card represents the flow from RC through to payment, not separate cards per entity
- Dashboard comparison badges should match the existing financial dashboard pattern (arrow + % + green/red)
- Notification preferences should be accessible from the bell dropdown with a gear icon link
- Daily digest notification for managers should summarize: X pendências aprovação, Y pedidos em atraso, Z recebimentos para confirmar

</specifics>

<deferred>
## Deferred Ideas

- **Email notifications (SMTP/SES):** Real email delivery deferred to v1.2 — continue using in-app + push only
- **WebSocket real-time updates:** Consider for v1.2 if polling proves insufficient for kanban freshness
- **Supplier performance report with charts:** Noted in Phase 7, can be added as sub-page of suppliers
- **NF-e XML import:** Out of scope, requires separate fiscal module

</deferred>

---

_Phase: 12-kanban-dashboard-e-notifica-es_
_Context gathered: 2026-03-18_
