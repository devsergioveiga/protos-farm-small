---
phase: 41-sped-ecd-e-relat-rio-integrado
plan: 03
subsystem: financial-statements
tags: [sped-ecd, integrated-report, frontend, ui, react]
dependency_graph:
  requires:
    - 41-01 (sped-ecd backend endpoints: /validate, /download)
    - 41-02 (integrated-report backend endpoints: /download, /notes)
  provides:
    - SpedEcdPage (route /sped-ecd)
    - useSpedEcd hook
    - ValidationPanel component
    - NotesTextarea component
  affects:
    - App.tsx (new route)
    - Sidebar.tsx (new CONTABILIDADE item)
tech_stack:
  added: []
  patterns:
    - Tab hidden attribute pattern (same as Phase 37/40 decisions)
    - Debounced autosave (2s) with saved indicator fade-out
    - Blob download pattern reusing api.getBlob-compatible approach
    - BEM CSS classes following DrePage.css pattern
key_files:
  created:
    - apps/frontend/src/types/sped-ecd.ts
    - apps/frontend/src/hooks/useSpedEcd.ts
    - apps/frontend/src/components/sped-ecd/ValidationPanel.tsx
    - apps/frontend/src/components/sped-ecd/ValidationPanel.css
    - apps/frontend/src/components/sped-ecd/NotesTextarea.tsx
    - apps/frontend/src/pages/SpedEcdPage.tsx
    - apps/frontend/src/pages/SpedEcdPage.css
  modified:
    - apps/frontend/src/App.tsx (added SpedEcdPage lazy import + route)
    - apps/frontend/src/components/layout/Sidebar.tsx (added SPED / Relatorios item)
decisions:
  - 'useSpedEcd exposes toast state to parent page instead of using a global toast library — consistent with DrePage pattern (local toast state)'
  - 'orgId obtained via useAuth().user?.organizationId ?? undefined to satisfy string | undefined type in useSpedEcd'
  - 'Notes textarea CSS co-located in SpedEcdPage.css (not a separate file) — NotesTextarea is only used in this page'
metrics:
  duration_seconds: 321
  completed_date: '2026-03-28'
  tasks_completed: 2
  tasks_total: 3
  files_created: 7
  files_modified: 2
  tests_added: 0
---

# Phase 41 Plan 03: SPED ECD Frontend Summary

SpedEcdPage with two tabs (SPED ECD validation/download and Relatorio Integrado PDF), useSpedEcd hook, ValidationPanel with severity badges and correction links, NotesTextarea with 2s debounced autosave, sidebar entry, and route wired.

## What Was Built

**types/sped-ecd.ts** — SpedValidationItem (severity/code/message/navigateTo) and SpedValidationResult (items/hasErrors).

**hooks/useSpedEcd.ts** — Custom hook managing all SPED/report state:

- `validate(fiscalYearId)` — calls GET /sped-ecd/validate, sets validationResult
- `downloadSped(fiscalYearId)` — blob download of SPED .txt file
- `downloadPdf(fiscalYearId, costCenterId?)` — blob download of integrated report PDF
- `loadNotes()` — GET /integrated-report/notes
- `saveNotes(text)` — PATCH /integrated-report/notes (called by debounce in NotesTextarea)
- Local toast state exposed to parent page

**ValidationPanel.tsx** — Section with `role="alert"` and `aria-live="polite"`:

- Loading: 3 skeleton rows with CSS pulse animation
- All-clear: CheckCircle (green) + success message
- Issues: summary line with counts + per-item rows with ERRO/AVISO badges, icons, message, correction Link

**NotesTextarea.tsx** — Textarea with label/aria-describedby/helper text, 2s debounced autosave, "Notas salvas" indicator with CSS opacity transition.

**SpedEcdPage.tsx** — Main page:

- Breadcrumb nav with Links
- Page header with FileText icon and h1
- Fiscal year selector (shared, triggers auto-validate on change)
- Tab rail with `role="tablist"`, two `role="tab"` buttons with `id="tab-sped"` and `id="tab-report"`
- SPED ECD panel: empty state or ValidationPanel + disabled Gerar SPED ECD button when hasErrors
- Relatorio Integrado panel: empty state or farm selector + NotesTextarea + Gerar Relatorio PDF button
- Local toast display

**Sidebar.tsx** — `SPED / Relatorios` added as last item in CONTABILIDADE group with FileText icon.

**App.tsx** — `SpedEcdPage` lazy import and `/sped-ecd` route after `/accounting-dashboard`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] orgId type mismatch: `string | null | undefined` not assignable to `string | undefined`**

- **Found during:** Task 2 TypeScript check
- **Issue:** `user?.organizationId` returns `string | null | undefined` but useSpedEcd expects `string | undefined`
- **Fix:** Added `?? undefined` coercion: `user?.organizationId ?? undefined`
- **Files modified:** SpedEcdPage.tsx
- **Commit:** 781a5e45

## Checkpoint Pending

**Task 3: Visual verification of SPED ECD page** — Pending human review.

The page is wired and TypeScript-clean. To verify:

1. Start dev servers: `cd apps/backend && pnpm dev` and `cd apps/frontend && pnpm dev`
2. Navigate to `/sped-ecd` (or via "SPED / Relatorios" in sidebar under CONTABILIDADE)
3. Verify page shows "SPED ECD e Relatorios" heading with FileText icon
4. Select fiscal year — validation runs automatically
5. Verify ValidationPanel shows ERROs (red) or all-clear (green)
6. Click "Gerar SPED ECD" — verify .txt file downloads
7. Switch to "Relatorio Integrado" tab
8. Type in notes — verify "Notas salvas" appears after ~2s
9. Click "Gerar Relatorio PDF" — verify PDF downloads

## Known Stubs

None. All data flows from real API endpoints (from Plans 01 and 02). Empty state shows when no fiscal year is selected — this is by design, not a stub.

## Self-Check: PASSED
