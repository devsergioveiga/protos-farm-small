---
phase: 19-integrao-financeira-aquisio
plan: '03'
subsystem: ui
tags: [react, frontend, nfe-import, modal, wizard, assets, file-upload, drag-drop]

dependency_graph:
  requires:
    - phase: 19-integrao-financeira-aquisio/19-01
      provides: 'POST /asset-acquisitions/parse-nfe and /from-nfe backend endpoints'
    - phase: 19-integrao-financeira-aquisio/19-02
      provides: 'useAssetAcquisition hook with parseNfe and createFromNfe methods, NF-e types in asset.ts'
  provides:
    - apps/frontend/src/components/assets/AssetNfeImportModal.tsx — 3-step NF-e import wizard modal
    - apps/frontend/src/components/assets/AssetNfeImportModal.css — styling for wizard
  affects:
    - apps/frontend/src/components/assets/AssetModal.tsx — adds Importar NF-e button in create mode
    - apps/frontend/src/pages/AssetsPage.tsx — adds Importar NF-e button in header actions

tech-stack:
  added: []
  patterns:
    - 'display:none/display:block for step transitions (no CSS animation) per STATE.md locked decision'
    - 'React Fragment wrapper for modal + nested modal pattern in AssetModal'
    - '3-step wizard with stepper header dots (active/completed/inactive) using display conditionals'

key-files:
  created:
    - apps/frontend/src/components/assets/AssetNfeImportModal.tsx
    - apps/frontend/src/components/assets/AssetNfeImportModal.css
  modified:
    - apps/frontend/src/components/assets/AssetModal.tsx
    - apps/frontend/src/components/assets/AssetModal.css
    - apps/frontend/src/pages/AssetsPage.tsx

key-decisions:
  - 'AssetNfeImportModal rendered inline inside AssetModal return using React Fragment — avoids portal complexity and keeps wiring simple'
  - 'Item assignment uses three modes (none/new/existing) instead of boolean new flag — cleaner UX with single select to choose assignment type'
  - 'useAssetAcquisition hook already had types from plan 19-02 commit 23bd6635 — no extra hook work needed'

patterns-established:
  - 'Multi-step wizard: stepper header with dots, display:none/block for step bodies, sticky footer with context-aware buttons'
  - 'File upload zone: drag-and-drop with dragover state, hidden input, immediate parse on select'

requirements-completed:
  - AQUI-03
  - AQUI-04

duration: '603s'
completed: '2026-03-22'
---

# Phase 19 Plan 03: NF-e Import Wizard Summary

**AssetNfeImportModal 3-step wizard for NF-e XML upload, item-to-asset assignment, and CP-generating confirmation with proportional rateio of accessory expenses**

## Performance

- **Duration:** 603s (~10 min)
- **Started:** 2026-03-22T13:38:38Z
- **Completed:** 2026-03-22T13:48:41Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- AssetNfeImportModal 3-step wizard: XML upload with drag-and-drop and immediate parse, item preview with mapped/unmapped color coding, confirmation with CP banner and success state
- File validation: .xml MIME/extension check + 2MB size limit with user-friendly error messages
- Stepper header with numbered dots (active: primary-600, completed: success-500, inactive: neutral-300)
- Item assignment per NF-e item: "Criar novo ativo" (name + type) or "Ativo existente" (select from existing)
- Accessory expenses section (freight/insurance/other) with proportional rateio note, expandable
- Payment type (AVISTA/FINANCIADO), classification, and CP auto-generation info banner in step 3
- Success state with CheckCircle2 64px icon and asset count + CP confirmation message
- "Importar NF-e" button wired from AssetModal header (create mode only) and AssetsPage header actions
- All CSS uses var(--\*) design tokens, responsive at 639px breakpoint (full-screen on mobile)

## Task Commits

Each task was committed atomically:

1. **Task 1: AssetNfeImportModal 3-step wizard** - `1f7c5ab3` (feat)
2. **Task 2: Wire AssetNfeImportModal from AssetModal and AssetsPage** - `885a8d71` (feat)

## Files Created/Modified

- `apps/frontend/src/components/assets/AssetNfeImportModal.tsx` - 3-step NF-e import wizard (450+ lines), step 1 file upload, step 2 item assignment, step 3 payment + confirm + success
- `apps/frontend/src/components/assets/AssetNfeImportModal.css` - Full styling with stepper, upload zone, item cards, info banner, success state, responsive breakpoint at 639px
- `apps/frontend/src/components/assets/AssetModal.tsx` - Added FileUp import, AssetNfeImportModal import, showNfeModal state, header-actions container, conditional "Importar NF-e" button, React Fragment wrapper, AssetNfeImportModal render
- `apps/frontend/src/components/assets/AssetModal.css` - Added header-actions, nfe-btn, header-actions flex container styles
- `apps/frontend/src/pages/AssetsPage.tsx` - Added FileUp import, AssetNfeImportModal import, showNfeImport state, "Importar NF-e" button in header, AssetNfeImportModal render with success callback

## Decisions Made

- Used React Fragment in AssetModal to render `AssetNfeImportModal` alongside the main modal overlay — avoids portal complexity and keeps the NF-e modal at correct z-index
- Item assignment uses `mode: 'none' | 'new' | 'existing'` state per item instead of a boolean — cleaner select-based UX that avoids ambiguous button toggling
- Step transitions use `display:none/display:block` as specified in STATE.md locked decision (no CSS animation)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated useAssetAcquisition hook to use canonical types from asset.ts**

- **Found during:** Task 1 (AssetNfeImportModal creation)
- **Issue:** The hook at commit 23bd6635 had its own local `NfeParsedData` interface with different field names than the backend API (`totalValue` vs `totalNf`, `unitPrice/totalPrice` vs `value`). Also sent `{ ...nfeParsed, ...input }` instead of `{ ...input, nfeParsed }` to the from-nfe endpoint.
- **Fix:** Updated hook to import types from `@/types/asset` (NfeParsedData, CreateFromNfeInput, NfeAcquisitionOutput which were already in asset.ts from plan 19-02). Fixed `createFromNfe` body to send `{ ...input, nfeParsed }` matching backend's `CreateFromNfeInput` which includes `nfeParsed` as a nested field.
- **Files modified:** apps/frontend/src/hooks/useAssetAcquisition.ts
- **Verification:** TypeScript compilation succeeds, hook types match backend contract
- **Committed in:** 1f7c5ab3 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (blocking — type mismatch between hook and backend API)
**Impact on plan:** Essential fix for API contract correctness. No scope creep.

## Issues Encountered

- Plan 19-02 had been executed (commit 23bd6635) but had a type inconsistency in the hook — the NF-e types in the hook didn't match the backend. Fixed automatically per Rule 3.
- TypeScript showed 11 pre-existing errors in maintenance-related files (AssetMaintenanceTab, WorkOrderCloseWizard, MaintenanceDashboardPage, MaintenanceProvisionModal) — all pre-existing, none introduced by this plan.

## Next Phase Readiness

- NF-e import wizard complete and wired — users can import assets from NF-e XML via either AssetModal (create mode) or AssetsPage header
- AQUI-03 and AQUI-04 requirements fulfilled
- Phase 19 wave 2 plans complete — ready for phase completion

---

_Phase: 19-integrao-financeira-aquisio_
_Completed: 2026-03-22_
