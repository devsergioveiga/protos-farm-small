---
phase: 11-devolu-o-or-amento-e-saving
plan: '05'
subsystem: frontend
tags: [goods-returns, devoluções, frontend, react, hooks]
dependency_graph:
  requires: [11-02]
  provides: [goods-returns-frontend, devolucoes-page, goods-return-modal]
  affects: [sidebar, app-routes]
tech_stack:
  added: []
  patterns:
    [useGoodsReturns-hook, expandable-inline-detail, status-transition-buttons, lazy-import-modal]
key_files:
  created:
    - apps/frontend/src/hooks/useGoodsReturns.ts
    - apps/frontend/src/pages/DevolucoesPage.tsx
    - apps/frontend/src/pages/DevolucoesPage.css
    - apps/frontend/src/components/goods-returns/GoodsReturnModal.tsx
    - apps/frontend/src/components/goods-returns/GoodsReturnModal.css
    - apps/frontend/src/pages/SavingAnalysisPage.tsx
  modified:
    - apps/frontend/src/components/layout/Sidebar.tsx
    - apps/frontend/src/App.tsx
decisions:
  - 'Lazy Suspense import for GoodsReturnModal in DevolucoesPage avoids circular dep while keeping TSC happy'
  - 'SavingAnalysisPage placeholder created to fix pre-existing TSC error from App.tsx modifications in previous plan run'
  - 'Wallet icon used for Orçamento sidebar entry instead of TrendingUp (better semantic fit)'
metrics:
  duration: 1052s
  completed: '2026-03-18'
  tasks: 2
  files: 8
---

# Phase 11 Plan 05: Goods Returns Frontend Summary

Goods returns frontend with list page, expandable inline detail, status transition buttons, creation modal with receipt item picker, and sidebar/route integration.

## What Was Built

**useGoodsReturns hook** (`src/hooks/useGoodsReturns.ts`) — Full API layer for goods returns: list hook with pagination and filters (status, supplierId, startDate, endDate, search), single-item hook, and standalone API functions for create, transition, photo upload, and delete.

**DevolucoesPage** (`src/pages/DevolucoesPage.tsx` + `.css`) — List page with filter bar (search, status dropdown, date range pickers), desktop table with 9 columns, mobile card layout, expandable inline detail rows showing item list with photos, metadata (receipt link, deadline, NF, notes), and status transition action buttons (Analisar, Aprovar, Concluir, Cancelar). Pagination and empty state included.

**GoodsReturnModal** (`src/components/goods-returns/GoodsReturnModal.tsx` + `.css`) — Creation modal with: searchable confirmed-receipts dropdown, motivo select (5 reasons), expectedAction radio group (Troca/Credito/Estorno with explanatory text), items table with select-all checkbox + per-item returnQty input (capped at receivedQty), optional resolution deadline, collapsible NF section, notes textarea. Full inline validation with field-level error messages.

**Sidebar + Routes** — Added Devoluções (Undo2 icon) after Recebimentos in COMPRAS group. Updated purchase-budgets to use Wallet icon. Added `/goods-returns` route in App.tsx with lazy DevolucoesPage.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] SavingAnalysisPage missing — pre-existing TSC error**

- **Found during:** Task 1 TSC verification
- **Issue:** App.tsx had `SavingAnalysisPage` lazy import from a previous plan run but the file didn't exist, causing `TS2307` error
- **Fix:** Created minimal placeholder `SavingAnalysisPage.tsx` with "Em construção" content
- **Files modified:** `apps/frontend/src/pages/SavingAnalysisPage.tsx`
- **Commit:** e40100a

**2. [Rule 2 - Missing Critical] GoodsReturnModal placeholder needed before Task 2**

- **Found during:** Task 1 TSC verification after DevolucoesPage uses lazy import of modal
- **Issue:** TypeScript import of `@/components/goods-returns/GoodsReturnModal` failed as file didn't exist yet
- **Fix:** Created minimal placeholder that Task 2 subsequently replaced with full implementation
- **Files modified:** `apps/frontend/src/components/goods-returns/GoodsReturnModal.tsx`
- **Commit:** e40100a (placeholder), 4df3eba (full implementation)

## Self-Check: PASSED

All files found on disk. Commits e40100a and 4df3eba exist in git log.
