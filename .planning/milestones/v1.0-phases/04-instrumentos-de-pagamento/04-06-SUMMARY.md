---
phase: 04-instrumentos-de-pagamento
plan: 06
subsystem: frontend/checks
tags: [checks, frontend, modal, sidebar-badge, state-machine]
dependency_graph:
  requires: [04-05]
  provides: [checks-frontend, checks-sidebar-badge]
  affects: [Sidebar.tsx, App.tsx]
tech_stack:
  added: []
  patterns:
    [useCallback-state-machine, inline-cancel-confirm, conditional-row-actions, alert-count-badge]
key_files:
  created:
    - apps/frontend/src/hooks/useChecks.ts
    - apps/frontend/src/hooks/useCheckAlertCount.ts
    - apps/frontend/src/components/checks/CheckModal.tsx
    - apps/frontend/src/components/checks/CheckModal.css
    - apps/frontend/src/components/checks/CompensateCheckModal.tsx
    - apps/frontend/src/components/checks/CompensateCheckModal.css
    - apps/frontend/src/pages/ChecksPage.tsx
    - apps/frontend/src/pages/ChecksPage.css
  modified:
    - apps/frontend/src/App.tsx
    - apps/frontend/src/components/layout/Sidebar.tsx
decisions:
  - 'Inline cancel confirmation as table row expansion — proportional to risk without blocking full modal'
  - 'CheckAlertCount badge uses warning amber (not error red) — checks A_COMPENSAR/DEVOLVIDO need attention but are not failures'
  - 'useEffect depends on applyFilters (stable useCallback) to avoid stale filter captures'
metrics:
  duration: 7min
  completed_date: '2026-03-16'
  tasks: 2
  files: 10
requirements: [FN-09]
---

# Phase 4 Plan 06: Checks Frontend Summary

Checks frontend with state-machine-driven row actions, compensation modal, sidebar badge with alert count, and responsive table/cards.

## What Was Built

### Task 1: Hooks and Modals

**useChecks.ts** — Full CRUD hook for `/org/checks` with all 6 state transitions: `markACompensar`, `compensateCheck`, `returnCheck`, `resubmitCheck`, `cancelCheck`, `createCheck`. Each mutation refetches the list after success.

**useCheckAlertCount.ts** — Lightweight hook that polls `/org/checks/alert-count` once on mount. Returns `{ count, loading, refetch }` for sidebar badge.

**CheckModal.tsx** — Create-only check form with:

- Radio buttons for EMITIDO / RECEBIDO type selection
- Dynamic label switching: "Beneficiário" when EMITIDO, "Emitente" when RECEBIDO
- Bank account select (loads from `/org/bank-accounts`)
- Three date fields: emissão (required), entrega (optional, >= emissão), compensação prevista (optional)
- Full accessibility: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, Escape closes, `aria-required`

**CompensateCheckModal.tsx** — Compact compensation confirmation with:

- Check summary (number, value, payee) in a grid card
- Date picker defaulting to today (required)
- Balance update note with amber left-border styling

### Task 2: ChecksPage + Sidebar + Route

**ChecksPage.tsx** — Full checks management page with:

- Filter bar: status multiselect, type select, date range (start/end)
- Data table: N° Cheque, Tipo badge, Beneficiário/Emitente, Valor (mono), Data Emissão, Compensação Prevista, Status badge, Ações
- **Status badges** per spec: EMITIDO=gray, A_COMPENSAR=amber, COMPENSADO=green, DEVOLVIDO=red, CANCELADO=gray+strikethrough
- **Conditional row actions**: EMITIDO → Marcar A Compensar + Cancelar; A_COMPENSAR → Compensar + Devolver + Cancelar; DEVOLVIDO → Re-apresentar + Cancelar; COMPENSADO/CANCELADO → Ver detalhes (disabled)
- **Inline cancel confirmation**: expands as table row beneath target row — no full modal
- Empty state: CheckSquare 48px + "Nenhum cheque registrado" + description + CTA
- Skeleton loading rows (5 rows)
- Toast messages for all actions (5s auto-dismiss)
- Responsive: `<768px` → stacked cards with hidden thead

**ChecksPage.css** — Status badge colors via CSS custom properties, mobile card layout, skeleton pulse animation.

**App.tsx** — Added `const ChecksPage = lazy(() => import('@/pages/ChecksPage'))` and `<Route path="/checks" element={<ChecksPage />} />`.

**Sidebar.tsx** — Added `CheckSquare` import, `useCheckAlertCount` hook, Cheques nav item in FINANCEIRO group, amber warning badge when `checkAlertCount > 0`.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `apps/frontend/src/hooks/useChecks.ts` — created
- [x] `apps/frontend/src/hooks/useCheckAlertCount.ts` — created
- [x] `apps/frontend/src/components/checks/CheckModal.tsx` — created
- [x] `apps/frontend/src/components/checks/CheckModal.css` — created
- [x] `apps/frontend/src/components/checks/CompensateCheckModal.tsx` — created
- [x] `apps/frontend/src/components/checks/CompensateCheckModal.css` — created
- [x] `apps/frontend/src/pages/ChecksPage.tsx` — created
- [x] `apps/frontend/src/pages/ChecksPage.css` — created
- [x] `apps/frontend/src/App.tsx` — modified (route + lazy import)
- [x] `apps/frontend/src/components/layout/Sidebar.tsx` — modified (badge + nav item)
- [x] Task 1 commit: `2926e1d`
- [x] Task 2 commit: `e78355a`
- [x] TypeScript: passes with no errors

## Self-Check: PASSED
