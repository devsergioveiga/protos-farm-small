---
phase: 20-alienacao-baixa-ativos
plan: "04"
subsystem: frontend-assets
tags: [frontend, patrimony, disposal, transfer, inventory, dashboard, recharts]
dependency_graph:
  requires: ["20-01", "20-02", "20-03"]
  provides: ["DISP-01", "DISP-02", "DISP-03", "DISP-04", "DISP-05", "DISP-06"]
  affects: [AssetsPage, AssetDrawer, Sidebar, App]
tech_stack:
  added: []
  patterns:
    - useAssetDisposal hook follows useAssetAcquisition pattern
    - usePatrimonyDashboard auto-fetches on mount with year/month/farmId state
    - AssetInventoryPage uses inline detail expand (not a separate route)
    - PatrimonyDashboardPage uses Recharts PieChart + BarChart (already installed)
key_files:
  created:
    - apps/frontend/src/types/asset.ts (extended with Disposal/Transfer/Inventory/Dashboard types)
    - apps/frontend/src/hooks/useAssetDisposal.ts
    - apps/frontend/src/hooks/useAssetTransfer.ts
    - apps/frontend/src/hooks/useAssetInventory.ts
    - apps/frontend/src/hooks/usePatrimonyDashboard.ts
    - apps/frontend/src/components/assets/AssetDisposalModal.tsx
    - apps/frontend/src/components/assets/AssetDisposalModal.css
    - apps/frontend/src/components/assets/AssetTransferModal.tsx
    - apps/frontend/src/components/assets/AssetTransferModal.css
    - apps/frontend/src/components/assets/AssetInventoryModal.tsx
    - apps/frontend/src/components/assets/AssetInventoryModal.css
    - apps/frontend/src/pages/AssetInventoryPage.tsx
    - apps/frontend/src/pages/AssetInventoryPage.css
    - apps/frontend/src/pages/PatrimonyDashboardPage.tsx
    - apps/frontend/src/pages/PatrimonyDashboardPage.css
  modified:
    - apps/frontend/src/components/assets/AssetDrawer.tsx
    - apps/frontend/src/components/assets/AssetDrawer.css
    - apps/frontend/src/pages/AssetsPage.tsx
    - apps/frontend/src/components/layout/Sidebar.tsx
    - apps/frontend/src/App.tsx
decisions:
  - Disposal modal uses ConfirmModal wrapper for destructive action guard (CLAUDE.md requirement)
  - Transfer modal filters farms client-side to exclude current farm (UX clarity)
  - AssetInventoryPage uses inline detail (not separate route) for simpler navigation
  - PatrimonyDashboardPage Pie label removed (recharts typing incompatibility with strict TS)
  - usePatrimonyDashboard auto-fetches on mount — consistent with useFinancialDashboard pattern
metrics:
  duration: 670s
  completed: "2026-03-22T15:04:22Z"
  tasks: 2
  files: 20
---

# Phase 20 Plan 04: Frontend Assets Alienacao/Baixa Summary

Frontend disposal modal, transfer modal, inventory page, patrimony dashboard, hooks, types, sidebar/routing wiring for complete Phase 20 DISP-01 through DISP-06 requirements.

## What Was Built

### Task 1: Types, hooks, disposal + transfer modals, drawer wiring

**New types in `types/asset.ts`:**
- `DisposalType` enum + `DISPOSAL_TYPE_LABELS`
- `CreateDisposalInput`, `DisposalOutput`
- `CreateTransferInput`, `TransferOutput`
- `PhysicalStatus` enum + `PHYSICAL_STATUS_LABELS`
- `InventoryItemOutput`, `InventoryOutput`
- `PatrimonyDashboardOutput`

**New hooks:**
- `useAssetDisposal.ts`: `createDisposal` (POST `/asset-disposals/:assetId/dispose`) + `getDisposal`
- `useAssetTransfer.ts`: `createTransfer` (POST `/asset-farm-transfers/:assetId/transfer`) + `listTransfers`

**AssetDisposalModal:**
- 4 disposal types via radio buttons (VENDA, DESCARTE, SINISTRO, OBSOLESCENCIA)
- Venda section: saleValue, buyerName, dueDate, installmentCount (1-120), firstDueDate
- Baixa section: motivation (required), documentUrl (optional)
- Gain/loss preview card (gain = green, loss = red)
- InstallmentPreviewTable when installmentCount > 1
- ConfirmModal wrapper before submit
- Full accessibility (aria-required, role=alert, focus management)

**AssetTransferModal:**
- Farm selector filtered to exclude current farm
- transferDate (default today), notes textarea
- Error state with role=alert

**AssetDrawer wiring:**
- Alienar (PackageMinus icon) + Transferir (ArrowRightLeft icon) buttons in header
- Buttons disabled when asset.status === 'ALIENADO'
- `onRefresh` prop added to notify parent

**AssetsPage wiring:**
- Alienar + Transferir in table row actions (only for non-ALIENADO assets)
- Disposal + Transfer modals with toast notifications

### Task 2: Inventory page, patrimony dashboard, hooks, sidebar + routing

**New hooks:**
- `useAssetInventory.ts`: create/list/get/countItems/reconcile via `/asset-inventories` endpoints
- `usePatrimonyDashboard.ts`: auto-fetches `GET /financial-dashboard/patrimony` with year/month/farmId state

**AssetInventoryModal:** farm select + notes, creates inventory

**AssetInventoryPage:**
- List view: table (desktop) + cards (mobile) with status badge, counts, divergence highlight
- DRAFT -> COUNTING -> RECONCILED state flow
- Inline detail section: editable physicalStatus select + notes per item
- Salvar Contagem button (DRAFT/COUNTING states)
- Conciliar button (COUNTING state only) with ConfirmModal
- Empty state with Calendar icon + CTA

**PatrimonyDashboardPage:**
- 4 KPI cards: Valor Total Ativos, Depreciacao Acumulada, Valor Contabil Liquido, Ganho/Perda
- Period summary: acquisitions + disposals count + values
- PieChart (type distribution) + BarChart horizontal (status distribution) via Recharts
- Year/month/farmId filter controls

**Sidebar + routing:**
- PATRIMONIO group: Inventario Patrimonial (`/asset-inventories`) + Dashboard Patrimonial (`/patrimony-dashboard`)
- App.tsx: lazy imports + routes registered

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Recharts PieChart label typing incompatibility**
- **Found during:** Task 2 TypeScript check
- **Issue:** Recharts 3.x label prop type doesn't accept typed function with `{ name, percent }` destructuring in strict TypeScript
- **Fix:** Removed label prop from Pie (uses default Recharts labeling)
- **Files modified:** `apps/frontend/src/pages/PatrimonyDashboardPage.tsx`
- **Commit:** f7d32e32

**2. [Rule 1 - Bug] Recharts Tooltip formatter type mismatch**
- **Found during:** Task 2 TypeScript check
- **Issue:** `formatter={(value: number) => [value, 'Ativos']}` is not assignable to Recharts Formatter type
- **Fix:** Removed formatter prop, uses default Recharts tooltip
- **Files modified:** `apps/frontend/src/pages/PatrimonyDashboardPage.tsx`
- **Commit:** f7d32e32

## Checkpoint Status

Task 3 (human visual verification) is pending. Backend servers must be running for verification.

## Self-Check: PASSED

Files created:
- apps/frontend/src/hooks/useAssetDisposal.ts ✓
- apps/frontend/src/hooks/useAssetTransfer.ts ✓
- apps/frontend/src/hooks/useAssetInventory.ts ✓
- apps/frontend/src/hooks/usePatrimonyDashboard.ts ✓
- apps/frontend/src/components/assets/AssetDisposalModal.tsx ✓
- apps/frontend/src/components/assets/AssetTransferModal.tsx ✓
- apps/frontend/src/components/assets/AssetInventoryModal.tsx ✓
- apps/frontend/src/pages/AssetInventoryPage.tsx ✓
- apps/frontend/src/pages/PatrimonyDashboardPage.tsx ✓

Commits: 2a80e6b3, f7d32e32 ✓
