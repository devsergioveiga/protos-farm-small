---
phase: 19-integrao-financeira-aquisio
plan: "02"
subsystem: frontend
tags: [assets, asset-acquisitions, payables, installments, financial-ui]
dependency_graph:
  requires: ["19-01"]
  provides: [AssetModal financial section, InstallmentPreviewTable, useAssetAcquisition hook]
  affects: [PayablesPage, PayableModal, AssetModal]
tech_stack:
  added: []
  patterns: [radio card UI, collapsible section display:none/block, client-side installment preview]
key_files:
  created:
    - apps/frontend/src/hooks/useAssetAcquisition.ts
    - apps/frontend/src/components/assets/InstallmentPreviewTable.tsx
    - apps/frontend/src/components/assets/InstallmentPreviewTable.css
  modified:
    - apps/frontend/src/types/asset.ts
    - apps/frontend/src/hooks/usePayables.ts
    - apps/frontend/src/pages/PayablesPage.tsx
    - apps/frontend/src/components/payables/PayableModal.tsx
    - apps/frontend/src/components/assets/AssetModal.tsx
    - apps/frontend/src/components/assets/AssetModal.css
key_decisions:
  - "Payment type radio cards use label-wrapping-hidden-input pattern for accessible card UI"
  - "InstallmentPreviewTable shows first 6 rows with expand/collapse via display:none (per STATE.md zero-animation decision)"
  - "ASSET_ACQUISITION excluded from PayableModal manual category dropdown (generated-only via asset-acquisitions endpoint)"
  - "onSuccess() called with no args after createAcquisition (preserves AssetModalProps interface)"
metrics:
  duration: 420s
  completed: "2026-03-22"
  tasks: 2
  files: 9
---

# Phase 19 Plan 02: AssetModal Financial Section and InstallmentPreviewTable Summary

Extended AssetModal with a collapsible "Dados Financeiros" section supporting AVISTA (single due date) and FINANCIADO (installment schedule with live preview) payment types, plus created the InstallmentPreviewTable component and useAssetAcquisition hook wiring the frontend to POST /asset-acquisitions for automatic CP generation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Types, hook, InstallmentPreviewTable, PayableCategory updates | 23bd6635 | 7 files |
| 2 | Extend AssetModal with Dados Financeiros collapsible section | f4bdc1b3 | 2 files |

## What Was Built

### Task 1 — Foundation

**types/asset.ts additions:**
- `PaymentType = 'AVISTA' | 'FINANCIADO'`
- `AssetAcquisitionInput` extending `CreateAssetInput` with payment fields
- `AssetAcquisitionOutput` with asset tag + payableId + installmentCount
- `InstallmentPreview` with number, dueDate (Date), amount
- NF-e types were already added by the linter from Plan 01 — preserved as-is

**useAssetAcquisition hook:**
- `createAcquisition(input)` — POST `/org/:orgId/asset-acquisitions`
- `parseNfe(file)` — POST FormData to `/org/:orgId/asset-acquisitions/parse-nfe`
- `createFromNfe(nfeParsed, input)` — POST to `/org/:orgId/asset-acquisitions/from-nfe`
- `isLoading`, `error` state with pt-BR error messages

**InstallmentPreviewTable component:**
- Table with `<caption>Parcelas geradas</caption>` and `<th scope="col">` headers
- Shows first 6 rows; expand/collapse button for more (display:none toggle, no animation)
- Footer row with "Total" label and sum in JetBrains Mono
- Loading state: 3 skeleton rows with `skeleton-pulse` animation (opacity 0.4–0.7, 1.5s)
- All CSS uses `var(--*)` tokens exclusively

**PayableCategory updates:**
- `usePayables.ts`: added `ASSET_ACQUISITION` to PayableCategory union
- `PayablesPage.tsx`: added `ASSET_ACQUISITION: 'Aquisicao de Ativo'` to CATEGORY_LABELS
- `PayableModal.tsx`: added type + label, created `MANUAL_CATEGORIES` filter, excluded from dropdown

### Task 2 — AssetModal Extension

**New state variables:** `financialExpanded`, `paymentType`, `dueDate`, `installmentCount`, `firstDueDate`, `interestRate`, `installmentPreviews`, `previewLoading`, `infoBannerDismissed`, `installmentError`

**recalculateInstallments:** Client-side calculation — divides total by count, residual on first installment, monthly dates from firstDueDate

**"Dados Financeiros" section (shown when acquisitionValue > 0 and not editing):**
- Collapsible header with ChevronDown/ChevronUp, aria-expanded, hover background
- Payment type radio cards (`<fieldset>/<legend>`) — AVISTA and FINANCIADO with accessible hidden radio inputs
- AVISTA: single due date field (display:none when not selected)
- FINANCIADO: installmentCount (min 2, inline validation), firstDueDate, interestRate (comma-decimal, formats on blur), InstallmentPreviewTable
- Classification chip (read-only informational badge)
- CP info banner with `role="status"`, dismissible X button — shown when supplierId + paymentType set
- Form submission routes to `createAcquisition()` when paymentType set; existing `handleSubmit()` otherwise
- Footer CTA changes to "Registrar Ativo" when financial data present

**CSS additions (AssetModal.css):**
- `.asset-modal__financial-section`, `.asset-modal__financial-header`, `.asset-modal__financial-body`
- `.asset-modal__payment-cards`, `.asset-modal__payment-card` variants for selected states
- `.asset-modal__financing-fields` (2-col grid)
- `.asset-modal__info-banner`, `.asset-modal__info-banner-close`
- `.asset-modal__classification-chip`
- Responsive `@media (max-width: 639px)`: payment cards stack vertically, financing fields single column

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compilation: no errors in any plan-02 files
- Pre-existing errors in maintenance module (AssetMaintenanceTab, WorkOrderCloseWizard, MaintenanceProvision) are out of scope from Phase 18

## Self-Check: PASSED

All 9 files found on disk. Both task commits (23bd6635, f4bdc1b3) verified in git log.
