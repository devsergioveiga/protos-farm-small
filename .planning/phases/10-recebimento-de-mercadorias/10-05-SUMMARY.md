---
phase: 10-recebimento-de-mercadorias
plan: '05'
subsystem: frontend
tags: [goods-receipt, modal, wizard, inspection, divergence, receiving-workflow]
dependency_graph:
  requires: [10-02, 10-03, 10-04]
  provides: [goods-receipt-creation-ui, goods-receipt-detail-ui]
  affects: [GoodsReceiptsPage]
tech_stack:
  added: []
  patterns:
    - 4-step wizard modal with StepIndicator component
    - Key-remount pattern for modal reset (key=existingId or new-isOpen)
    - Divergence detection threshold 5% with auto-expand divergence registration row
    - ConfirmModal used for post-creation confirmation flow
    - Detail view mode inside same modal component via existingId prop
key_files:
  created:
    - apps/frontend/src/components/goods-receipts/GoodsReceiptModal.tsx
    - apps/frontend/src/components/goods-receipts/GoodsReceiptModal.css
  modified:
    - apps/frontend/src/pages/GoodsReceiptsPage.tsx
decisions:
  - GoodsReceiptModal handles both wizard (create) and detail (view) modes via existingId prop
  - RefetchKey pattern on RecebimentosTab key prop triggers remount/refetch on modal success
  - Emergency mode uses inline supplier select; divergence rows auto-expand when >5% threshold detected
metrics:
  duration: 506s
  completed: '2026-03-17'
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 10 Plan 05: Goods Receipt Modal Summary

**One-liner:** 4-step wizard modal for goods receipt creation (PO selection, NF entry, item inspection with divergence detection, confirmation) plus detail view with drill-down links to OC/CP.

## What Was Built

### Task 1: GoodsReceiptModal — 4-step wizard

Created `GoodsReceiptModal.tsx` (1949 lines) with:

**Step 1 — Selecionar Pedido:**

- PO search with debounced input, selectable PO cards
- Emergency mode toggle with supplier select + justification textarea
- receivingType dropdown (6 options) when PO selected
- Auto-loads preselected PO when `preselectedPurchaseOrderId` prop provided

**Step 2 — Dados da Nota Fiscal:**

- Full NF form: invoiceNumber, invoiceSerie, invoiceCfop, invoiceDate, invoiceTotal, invoiceKey (44-digit), storageFarmId, notes
- Info banners for MERCADORIA_ANTECIPADA and NF_ANTECIPADA types
- Validation: required fields for STANDARD/PARCIAL/NF_FRACIONADA, invoiceKey length check

**Step 3 — Conferencia de Itens:**

- Inspection table: productName, unitName, orderedQty (readonly), invoiceQty, receivedQty, unitPrice, visualOk checkbox, batchNumber, expirationDate, qualityNotes
- Auto-detects divergence >5%: shows yellow AlertTriangle badge with percentage
- Divergence registration row: type select, action select, observation input
- Alert banner at top when any item has >5% divergence
- Emergency mode: editable productName/unitName/orderedQty/unitPrice + Add item button

**Step 4 — Resumo e Confirmacao:**

- Readonly summary: general info, NF data, items table with divergence badges
- Type-specific warnings for MERCADORIA_ANTECIPADA and NF_ANTECIPADA
- "Registrar Recebimento" calls `createGoodsReceiptApi` then shows ConfirmModal
- ConfirmModal offers "Confirmar agora" (calls `confirmGoodsReceiptApi`) or "Confirmar depois"

**Detail view mode** (when `existingId` prop provided):

- Loads receipt via `getGoodsReceiptApi`
- Shows all data readonly with divergence badges
- Drill-down links to OC (navigate to /purchase-orders?id=...) and CP (navigate to /payables?id=...)
- "Confirmar Recebimento" button when status=CONFERIDO

**StepIndicator:** 4 circles with connecting lines, active=primary-600, completed=primary-100 with checkmark, inactive=neutral-100.

Created `GoodsReceiptModal.css` with all required classes: `.gr-modal__stepper`, `.gr-modal__inspection-table`, `.gr-modal__divergence-badge`, `.gr-modal__divergence-banner`, `.gr-modal__info-banner`, `.gr-modal__summary`, responsive full-screen on mobile.

### Task 2: Wire modal to GoodsReceiptsPage

Updated `GoodsReceiptsPage.tsx`:

- Imported `GoodsReceiptModal`
- Added state: `showCreateModal`, `selectedReceiptId`, `preselectedPOId`, `refetchKey`
- "Novo Recebimento" button: `setShowCreateModal(true)`
- Eye icon in table row and card: `setSelectedReceiptId(item.id)`
- "Registrar Recebimento" in Pendencias tab: `setPreselectedPOId(delivery.purchaseOrderId); setShowCreateModal(true)`
- Two modal instances: one for create (with preselectedPurchaseOrderId), one for detail (with existingId)
- `refetchKey` increments on success, passed as `key` to RecebimentosTab to trigger remount/refetch

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

- [x] `apps/frontend/src/components/goods-receipts/GoodsReceiptModal.tsx` — 1949 lines (requirement: 300+)
- [x] `apps/frontend/src/components/goods-receipts/GoodsReceiptModal.css` exists
- [x] `GoodsReceiptsPage.tsx` imports GoodsReceiptModal and has showCreateModal, selectedReceiptId state
- [x] `npx tsc --noEmit` exits 0
- [x] Commits e72d91c and 43be3dc exist
