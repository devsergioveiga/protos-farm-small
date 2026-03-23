---
phase: 20-alienacao-baixa-ativos
verified: 2026-03-22T15:30:00Z
status: human_needed
score: 18/18 must-haves verified
human_verification:
  - test: "Open any asset in /assets, click 'Alienar' button in drawer header"
    expected: "AssetDisposalModal opens with 4 disposal type radio buttons (Venda, Descarte, Sinistro, Obsolescencia). Selecting Venda shows saleValue/buyerName/dueDate/installmentCount fields and a gain/loss preview card. Setting installmentCount > 1 shows InstallmentPreviewTable. Submitting shows ConfirmModal before proceeding."
    why_human: "Visual rendering, conditional field visibility, live gain/loss calculation, and modal chaining cannot be verified statically"
  - test: "Open any non-ALIENADO asset drawer, click 'Transferir'"
    expected: "AssetTransferModal opens showing farm selector (excluding current farm), transferDate (default today), notes. Buttons disabled for ALIENADO assets."
    why_human: "Farm selector population from org farms and disabled-state rendering require runtime verification"
  - test: "Navigate to /asset-inventories"
    expected: "Page loads with empty state (Calendar icon + 'Nenhum inventario realizado' + CTA). Clicking 'Novo Inventario' opens AssetInventoryModal. Creating one shows items auto-loaded. Setting physicalStatus values and clicking 'Salvar Contagem' transitions status to COUNTING. 'Conciliar' button appears; clicking it shows ConfirmModal."
    why_human: "Full DRAFT->COUNTING->RECONCILED flow requires interactive walkthrough"
  - test: "Navigate to /patrimony-dashboard"
    expected: "Page shows 4 KPI cards (Valor Total Ativos, Depreciacao Acumulada, Valor Contabil Liquido, Ganho/Perda), period acquisition/disposal summary, PieChart for type distribution, BarChart for status distribution, and year/month/farmId filters."
    why_human: "Chart rendering (Recharts PieChart + BarChart) and KPI number formatting require visual confirmation"
  - test: "Check sidebar PATRIMONIO group"
    expected: "Two entries visible: 'Inventario Patrimonial' (links to /asset-inventories) and 'Dashboard Patrimonial' (links to /patrimony-dashboard)"
    why_human: "Sidebar rendering and navigation require visual/interactive confirmation"
---

# Phase 20: Alienacao, Baixa e Controle Patrimonial de Ativos — Verification Report

**Phase Goal:** Alienacao, baixa e controle patrimonial de ativos — disposal (venda/descarte/sinistro/obsolescencia), farm transfer, inventory reconciliation, patrimony dashboard
**Verified:** 2026-03-22T15:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | AssetDisposal, AssetFarmTransfer, AssetInventory, AssetInventoryItem models exist in Prisma schema | VERIFIED | All 4 models found in schema.prisma via grep |
| 2 | ReceivableCategory enum includes ASSET_SALE | VERIFIED | `ALTER TYPE "ReceivableCategory" ADD VALUE 'ASSET_SALE'` in migration SQL; `ASSET_SALE` in schema.prisma |
| 3 | AssetDisposalType enum has VENDA, DESCARTE, SINISTRO, OBSOLESCENCIA | VERIFIED | `enum AssetDisposalType` present in schema.prisma |
| 4 | Depreciation batch excludes ALIENADO assets | VERIFIED | `status: { notIn: ['EM_ANDAMENTO', 'ALIENADO'] as never[] }` in depreciation-batch.service.ts |
| 5 | Type files for all 3 new modules export input/output/error types | VERIFIED | All exports confirmed: AssetDisposalError + CreateDisposalInput + DisposalOutput; AssetTransferError + CreateTransferInput + TransferOutput; AssetInventoryError + PHYSICAL_STATUSES + InventoryOutput |
| 6 | Gerente pode registrar venda de ativo com ganho/perda calculado e CR gerado | VERIFIED | asset-disposals.service.ts: prisma.$transaction (2), tx.receivable.create (1), ASSET_SALE (1), ALIENADO (3); 14 integration tests passing |
| 7 | Gerente pode registrar baixa por descarte/sinistro/obsolescencia | VERIFIED | DESCARTE/SINISTRO/OBSOLESCENCIA covered in service; gainLoss = -netBookValue for non-VENDA; 14 tests |
| 8 | Gerente pode registrar venda parcelada com parcelas no CR | VERIFIED | generateInstallments (2 matches) in asset-disposals.service.ts |
| 9 | Disposal atomicamente cancela depreciacoes pendentes e asset fica ALIENADO | VERIFIED | `tx.depreciationEntry.updateMany` with reversedAt in transaction; status: 'ALIENADO' update present |
| 10 | Gerente pode transferir ativo entre fazendas da mesma org com historico | VERIFIED | asset-farm-transfers.service.ts: organizationId guard on destination farm (line 65), 7 integration tests |
| 11 | Transferencia rejeita fazenda destino de outra organizacao | VERIFIED | `where: { id: input.toFarmId, organizationId: ctx.organizationId }` — farm lookup scoped to org |
| 12 | Ativo alienado nao pode ser transferido | VERIFIED | ALIENADO guard (2 matches) in asset-farm-transfers.service.ts |
| 13 | Contador pode criar inventario, contar itens e reconciliar | VERIFIED | createInventory/countItems/reconcileInventory all implemented; 9 integration tests |
| 14 | Inventario segue fluxo DRAFT -> COUNTING -> RECONCILED | VERIFIED | State transitions confirmed in asset-inventory.service.ts lines 162-165 (DRAFT->COUNTING), 206 (->RECONCILED) |
| 15 | Gerente pode ver dashboard patrimonial com KPIs | VERIFIED | getPatrimonyDashboard with asset.aggregate + assetDisposal.aggregate in financial-dashboard.service.ts; GET /org/financial-dashboard/patrimony route; 22 tests |
| 16 | Gerente pode abrir modal de alienacao e registrar venda/descarte/sinistro | VERIFIED | AssetDisposalModal.tsx exists with disposalType (9 matches), ConfirmModal (2), InstallmentPreviewTable (2), gainLoss (5); wired in AssetDrawer + AssetsPage |
| 17 | Gerente pode transferir ativo entre fazendas via modal | VERIFIED | AssetTransferModal.tsx exists with toFarmId (6 matches); wired in AssetDrawer + AssetsPage |
| 18 | Sidebar tem links para inventario patrimonial e dashboard + routes wired | VERIFIED | Sidebar.tsx (2 matches: asset-inventories + patrimony-dashboard); App.tsx (4 lazy imports + 2 route paths) |

**Score:** 18/18 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/backend/prisma/migrations/20260427100000_add_asset_disposal_models/migration.sql` | Migration creating 4 tables + 2 enums + enum ALTER | VERIFIED | 5 CREATE/ALTER statements; all 4 tables present |
| `apps/backend/src/modules/asset-disposals/asset-disposals.types.ts` | Error class, input/output types for disposal | VERIFIED | AssetDisposalError + CreateDisposalInput + DisposalOutput + DISPOSAL_TYPE_LABELS all exported |
| `apps/backend/src/modules/asset-farm-transfers/asset-farm-transfers.types.ts` | Error class, input/output types for transfer | VERIFIED | AssetTransferError + CreateTransferInput + TransferOutput all exported |
| `apps/backend/src/modules/asset-inventory/asset-inventory.types.ts` | Error class, input/output types for inventory | VERIFIED | AssetInventoryError + PHYSICAL_STATUSES + InventoryOutput + full type set exported |
| `apps/backend/src/modules/asset-disposals/asset-disposals.service.ts` | createDisposal, getDisposal service functions | VERIFIED | Exists; prisma.$transaction (2), tx.receivable.create, generateInstallments (2), ALIENADO (3) |
| `apps/backend/src/modules/asset-disposals/asset-disposals.routes.ts` | POST /:assetId/dispose and GET /:assetId/disposal routes | VERIFIED | Exists; wired in app.ts (2 matches) |
| `apps/backend/src/modules/asset-disposals/asset-disposals.routes.spec.ts` | 14 integration tests | VERIFIED | Exactly 14 `it(` blocks confirmed |
| `apps/backend/src/modules/asset-farm-transfers/asset-farm-transfers.service.ts` | createTransfer, listTransfers | VERIFIED | Exists; org guard on farm lookup; 7 spec tests |
| `apps/backend/src/modules/asset-farm-transfers/asset-farm-transfers.routes.ts` | POST transfer, GET history | VERIFIED | Exists; wired in app.ts (2 matches for assetFarmTransfersRouter) |
| `apps/backend/src/modules/asset-inventory/asset-inventory.service.ts` | createInventory, countItems, reconcileInventory, listInventories, getInventory | VERIFIED | Full implementation — NOT a stub; DRAFT/COUNTING/RECONCILED state machine confirmed |
| `apps/backend/src/modules/asset-inventory/asset-inventory.routes.ts` | 5 CRUD + reconcile routes | VERIFIED | Exists; wired in app.ts (2 matches) |
| `apps/backend/src/modules/asset-inventory/asset-inventory.routes.spec.ts` | 9 integration tests | VERIFIED | 9 `it(` blocks confirmed |
| `apps/backend/src/modules/financial-dashboard/financial-dashboard.service.ts` | getPatrimonyDashboard function | VERIFIED | 2 matches for function; aggregate queries: asset.aggregate + assetDisposal.aggregate (3 aggregate matches) |
| `apps/backend/src/modules/financial-dashboard/financial-dashboard.routes.ts` | GET /org/financial-dashboard/patrimony | VERIFIED | 2 matches for 'patrimony' in routes file |
| `apps/backend/src/modules/receivables/receivables.types.ts` | ASSET_SALE in ReceivableCategory union | VERIFIED | 1 match confirmed |
| `apps/frontend/src/types/asset.ts` | DisposalType, PatrimonyDashboardOutput, PhysicalStatus, InventoryOutput | VERIFIED | All 4 types exported |
| `apps/frontend/src/hooks/useAssetDisposal.ts` | POST to asset-disposals endpoint | VERIFIED | 1 match for 'asset-disposals.*dispose' |
| `apps/frontend/src/hooks/useAssetTransfer.ts` | POST to asset-farm-transfers endpoint | VERIFIED | 2 matches for 'asset-farm-transfers.*transfer' |
| `apps/frontend/src/hooks/useAssetInventory.ts` | CRUD + reconcile for asset-inventories | VERIFIED | 5 matches for 'asset-inventories' |
| `apps/frontend/src/hooks/usePatrimonyDashboard.ts` | GET financial-dashboard/patrimony | VERIFIED | 1 match for 'financial-dashboard/patrimony' |
| `apps/frontend/src/components/assets/AssetDisposalModal.tsx` | Disposal form with type selector, gain/loss preview, installment config | VERIFIED | disposalType (9), ConfirmModal (2), InstallmentPreviewTable (2), gainLoss (5) |
| `apps/frontend/src/components/assets/AssetTransferModal.tsx` | Transfer form with destination farm selector | VERIFIED | toFarmId (6 matches) |
| `apps/frontend/src/components/assets/AssetInventoryModal.tsx` | Create inventory form | VERIFIED | Exists |
| `apps/frontend/src/pages/AssetInventoryPage.tsx` | Inventory list + detail with count form and reconcile | VERIFIED | physicalStatus/ENCONTRADO (10), Conciliar (2), ConfirmModal (2), COUNTING/RECONCILED (6) |
| `apps/frontend/src/pages/PatrimonyDashboardPage.tsx` | KPI cards + charts for patrimony overview | VERIFIED | totalActiveValue (1), PieChart/BarChart (8 Recharts matches) |
| `apps/frontend/src/components/assets/AssetDrawer.tsx` | Alienar + Transferir buttons wired | VERIFIED | AssetDisposalModal (2), AssetTransferModal (2), ALIENADO (3) |
| `apps/frontend/src/pages/AssetsPage.tsx` | Alienar action in table rows | VERIFIED | 4 matches for 'Alienar'/'alienar' |
| `apps/frontend/src/components/layout/Sidebar.tsx` | asset-inventories + patrimony-dashboard links | VERIFIED | 2 matches |
| `apps/frontend/src/App.tsx` | Lazy routes for both new pages | VERIFIED | 4 import matches + 2 route path matches |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| depreciation-batch.service.ts | AssetStatus enum | notIn filter | VERIFIED | `notIn: ['EM_ANDAMENTO', 'ALIENADO']` confirmed |
| asset-disposals.service.ts | prisma.$transaction | atomic disposal | VERIFIED | 2 matches for prisma.$transaction |
| asset-disposals.service.ts | tx.receivable.create | CR generation for VENDA | VERIFIED | 1 match confirmed |
| asset-disposals.service.ts | generateInstallments | installment sale parcels | VERIFIED | 2 matches confirmed |
| app.ts | assetDisposalsRouter | Express registration | VERIFIED | 2 matches in app.ts |
| asset-farm-transfers.service.ts | tx.farm.findFirst | same-org guard | VERIFIED | organizationId: ctx.organizationId in farm lookup (line 65) |
| asset-inventory.service.ts | tx.assetInventoryItem | DRAFT->COUNTING->RECONCILED | VERIFIED | State transitions lines 162-165, 193-206 |
| app.ts | assetFarmTransfersRouter + assetInventoryRouter | Express registration | VERIFIED | 2 matches each in app.ts |
| financial-dashboard.service.ts | prisma.asset.aggregate + prisma.assetDisposal.aggregate | patrimony metrics | VERIFIED | 3 aggregate query matches confirmed |
| financial-dashboard.routes.ts | /org/financial-dashboard/patrimony | GET endpoint | VERIFIED | 2 matches for 'patrimony' in routes |
| AssetDisposalModal.tsx | /api/org/:orgId/asset-disposals/:assetId/dispose | useAssetDisposal hook POST | VERIFIED | Hook path pattern confirmed; modal imports hook |
| AssetTransferModal.tsx | /api/org/:orgId/asset-farm-transfers/:assetId/transfer | useAssetTransfer hook POST | VERIFIED | Hook path pattern confirmed; modal imports hook |
| PatrimonyDashboardPage.tsx | /api/org/financial-dashboard/patrimony | usePatrimonyDashboard hook GET | VERIFIED | Hook path pattern confirmed |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| DISP-01 | 20-00, 20-01, 20-04 | Venda de ativo com ganho/perda e CR | SATISFIED | createDisposal: tx.receivable.create + gainLoss computation; DisposalModal: VENDA form section |
| DISP-02 | 20-00, 20-01, 20-04 | Baixa por sinistro/descarte/obsolescencia | SATISFIED | DESCARTE/SINISTRO/OBSOLESCENCIA cases in service; Baixa section in modal |
| DISP-03 | 20-00, 20-01, 20-04 | Venda parcelada com parcelas no CR | SATISFIED | generateInstallments + ReceivableInstallment creation; installmentCount field in modal |
| DISP-04 | 20-00, 20-02, 20-04 | Transferencia entre fazendas da mesma org | SATISFIED | same-org guard in service; AssetTransferModal wired in drawer and page |
| DISP-05 | 20-00, 20-02, 20-04 | Conciliacao inventario fisico vs contabil | SATISFIED | Full DRAFT->COUNTING->RECONCILED state machine; AssetInventoryPage with count/reconcile flow |
| DISP-06 | 20-03, 20-04 | Dashboard patrimonial com KPIs | SATISFIED | getPatrimonyDashboard with aggregate queries; PatrimonyDashboardPage with KPI cards + charts |

**Orphaned requirements:** None — all 6 DISP requirements from REQUIREMENTS.md are claimed by plans and verified.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| AssetDisposalModal.tsx | 259, 274, 348, 363 | `placeholder` HTML attribute | Info | Standard form placeholders — not implementation stubs |
| AssetTransferModal.tsx | 193 | `placeholder` HTML attribute | Info | Standard form placeholder — not a stub |
| AssetInventoryPage.tsx | 397 | `placeholder` HTML attribute | Info | Standard form placeholder — not a stub |

No blocking or warning-level anti-patterns found. All `placeholder` matches are HTML input/textarea placeholder text, not implementation stubs.

### Human Verification Required

All automated checks passed. The following 5 items require human verification because they involve visual rendering, interactive flows, and chart output that cannot be confirmed statically:

#### 1. Disposal Modal Flow

**Test:** Open any asset in /assets, click 'Alienar' button in drawer header
**Expected:** Modal opens with 4 disposal type radio buttons. Selecting Venda reveals saleValue/buyerName/dueDate/installmentCount fields and a gain/loss preview card (green for gain, red for loss). Setting installmentCount > 1 shows InstallmentPreviewTable. Submitting shows ConfirmModal before proceeding.
**Why human:** Visual conditional field visibility, live gain/loss calculation, and multi-modal chaining cannot be verified statically

#### 2. Transfer Modal Flow

**Test:** Open any non-ALIENADO asset drawer, click 'Transferir'
**Expected:** Modal opens with farm selector showing only org farms (excluding current farm), transferDate defaulting to today, notes textarea. Buttons disabled for ALIENADO assets.
**Why human:** Farm selector population from org context and disabled-state rendering require runtime verification

#### 3. Inventory Page Full Flow

**Test:** Navigate to /asset-inventories
**Expected:** Page shows empty state with Calendar icon + 'Nenhum inventario realizado' + CTA. Creating an inventory shows auto-loaded asset items. Setting physicalStatus on items and clicking 'Salvar Contagem' transitions to COUNTING status. 'Conciliar' button appears; clicking shows ConfirmModal; confirming marks inventory RECONCILED.
**Why human:** DRAFT->COUNTING->RECONCILED interactive flow requires walkthrough; mobile card layout requires device test

#### 4. Patrimony Dashboard Charts

**Test:** Navigate to /patrimony-dashboard
**Expected:** 4 KPI cards show numeric values (Valor Total Ativos, Depreciacao Acumulada, Valor Contabil Liquido, Ganho/Perda with color coding). PieChart renders for asset type distribution. BarChart renders for status distribution. Year/month/farmId filters change displayed data.
**Why human:** Recharts chart rendering (note: PieChart label prop removed due to TypeScript incompatibility — default Recharts labeling used) and KPI number formatting require visual confirmation

#### 5. Sidebar Navigation

**Test:** Check sidebar PATRIMONIO group
**Expected:** Two new entries visible: 'Inventario Patrimonial' (navigates to /asset-inventories) and 'Dashboard Patrimonial' (navigates to /patrimony-dashboard)
**Why human:** Sidebar group rendering and active-state behavior require visual confirmation

---

## Summary

Phase 20 goal is fully achieved at the code level. All 6 DISP requirements are implemented across 4 plans:

- **Plan 00:** Prisma schema (4 models, 2 enums, ASSET_SALE), migration, type files, depreciation fix
- **Plan 01:** Asset disposals backend — atomic transaction, CR generation, installments (14 tests)
- **Plan 02:** Farm transfers + inventory reconciliation backend (16 tests total)
- **Plan 03:** Patrimony dashboard endpoint + ReceivableCategory ASSET_SALE (10 new tests)
- **Plan 04:** Complete frontend — 4 hooks, 3 modals, 2 pages, sidebar + routing

No stubs or orphaned code found. The only noted deviation was the Recharts PieChart label prop removal (TypeScript incompatibility) which used default labeling — acceptable functional compromise.

Automated verification passes 18/18 must-haves. Five items are flagged for human visual/interactive verification due to rendering and flow requirements that cannot be confirmed statically.

---

_Verified: 2026-03-22T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
