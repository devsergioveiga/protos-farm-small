---
phase: 37-regras-e-lan-amentos-autom-ticos
plan: 03
subsystem: accounting-frontend
tags: [react, typescript, vite, frontend, auto-posting, tabs, accessibility]

# Dependency graph
requires:
  - phase: 37-01
    provides: AccountingRule + PendingJournalPosting REST API (8 endpoints at /api/org/:orgId/auto-posting/)
  - phase: 36-lan-amentos-manuais-raz-o-e-saldo-de-abertura
    provides: JournalEntriesPage, useJournalEntries, JournalEntryType
provides:
  - auto-posting.ts frontend types (AutoPostingSourceType, AccountingRule, PendingJournalPosting, SOURCE_TYPE_LABELS, SOURCE_TYPE_ROUTES, PENDING_STATUS_LABELS)
  - usePendingPostings, usePendingCounts, usePendingActions hooks
  - useAccountingRules, useAccountingRuleActions hooks
  - PendingPostingsTab: filters, status badges, accordion, retry, summary chips
  - AccountingRulesTab: rules table with isActive toggle
  - AccountingRuleModal: editable lines, searchable combobox, history template, preview
  - JournalEntriesPage: 3-tab layout, AUTOMATIC badge, tab badge counts, ?tab= URL sync
affects:
  - Users can now see, retry, and monitor auto-posting queue via Pendencias tab
  - Admins can edit accounting rules via Regras tab
  - AUTOMATIC entries visible with blue badge in Lancamentos tab

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Tab panel with hidden attribute: lancamentos panel stays mounted, others conditionally rendered'
    - 'Accordion row: ERROR rows expand on click with ChevronDown rotation (200ms ease-out)'
    - 'AccountCombobox: controlled input + role=combobox + role=listbox dropdown, client-side filter'
    - 'Toggle switch: role=switch + aria-checked, 40x22px, optimistic PATCH with revert on error'
    - 'URL tab sync: useEffect writes ?tab= on tab change, initial state reads from URL'

key-files:
  created:
    - apps/frontend/src/types/auto-posting.ts
    - apps/frontend/src/hooks/usePendingPostings.ts
    - apps/frontend/src/hooks/useAccountingRules.ts
    - apps/frontend/src/components/accounting/PendingPostingsTab.tsx
    - apps/frontend/src/components/accounting/PendingPostingsTab.css
    - apps/frontend/src/components/accounting/AccountingRulesTab.tsx
    - apps/frontend/src/components/accounting/AccountingRulesTab.css
    - apps/frontend/src/components/accounting/AccountingRuleModal.tsx
    - apps/frontend/src/components/accounting/AccountingRuleModal.css
  modified:
    - apps/frontend/src/types/journal-entries.ts
    - apps/frontend/src/pages/JournalEntriesPage.tsx
    - apps/frontend/src/pages/JournalEntriesPage.css

key-decisions:
  - 'Lancamentos panel uses hidden attribute (not conditional render) to preserve filter state when switching tabs'
  - 'AccountCombobox filters analytic accounts client-side (allAccounts already in memory from useChartOfAccounts)'
  - 'PendingPostingsTab has its own toast — avoids prop-drilling toast to sub-tab components'
  - 'ErrorRow tracks retried state locally so row updates optimistically without full refetch'
  - 'AUTOMATIC badge uses je-page__badge--automatic with --color-info-100/500 (blue) per UI-SPEC'

# Metrics
duration: 10min
completed: 2026-03-27
---

# Phase 37 Plan 03: Auto-Posting Frontend Summary

**Complete 3-tab JournalEntriesPage with Pendencias queue (accordion/retry/badges), Regras management (isActive toggle/edit modal), and AUTOMATIC entryType badge — TypeScript clean, Vite build succeeds**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-27T20:13:51Z
- **Completed:** 2026-03-27T20:23:20Z
- **Tasks:** 2 auto + 1 checkpoint (skipped per parallel executor instructions)
- **Files created:** 9, modified: 3

## Accomplishments

- Frontend types mirroring backend `auto-posting.types.ts`: all 12 AutoPostingSourceType values, PendingPostingStatus, AccountingRule, PendingJournalPosting, with SOURCE_TYPE_LABELS, SOURCE_TYPE_ROUTES, and PENDING_STATUS_LABELS label maps
- Three data hooks following project's `useState + useCallback + useEffect` pattern: `usePendingPostings` (with filters), `usePendingCounts`, `usePendingActions` (retryOne/retryBatch), `useAccountingRules`, `useAccountingRuleActions` (updateRule/getPreview)
- `PendingPostingsTab`: filter bar with status/sourceType selects, summary chips (red/yellow counts), table with status badges (4 variants), ERROR row accordion with chevron animation, retry button with loading state, batch retry, skeleton, empty state (two variants), responsive mobile cards
- `AccountingRulesTab`: rules table with Conta Débito/Crédito (first line of each side), CC flag, isActive toggle (role=switch, 40×22px), optimistic PATCH with toast on toggle, Editar button opens AccountingRuleModal
- `AccountingRuleModal`: editable lines table (Tipo/Conta/Histórico), searchable AccountCombobox (role=combobox, role=listbox, client-side filter on analytic accounts), add/remove lines with lineOrder auto-recalc, history template textarea with per-sourceType variable hints, requireCostCenter toggle, preview panel with 3-line skeleton, focus trap (Escape closes), 300ms open animation
- `JournalEntriesPage`: 3-tab nav (role=tablist), Pendencias tab badge counts (error=red, pending=yellow), URL ?tab= sync, AUTOMATIC entryType badge (Settings icon, blue info colors), "Automático" filter option in Tipo dropdown
- All components WCAG 2.1 AA: semantic HTML, focus-visible outlines, aria-expanded on accordion, role=alert on error messages, aria-label on icon-only buttons, prefers-reduced-motion respected

## Task Commits

1. **Task 1: Types + hooks** — `f933bb8a` (feat)
2. **Task 2: Components + JournalEntriesPage integration** — `2106da78` (feat)
3. **Task 3: Human verify checkpoint** — skipped (parallel executor, orchestrator handles post-completion review)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AUTOMATIC missing from ENTRY_TYPE_LABELS caused tsc error**

- **Found during:** Task 1 — after adding AUTOMATIC to JournalEntryType, JournalEntriesPage.tsx failed tsc because its `Record<JournalEntryType, string>` was incomplete
- **Fix:** Added `AUTOMATIC: 'Automático'` to ENTRY_TYPE_LABELS in JournalEntriesPage.tsx during Task 1 (before Task 2 was staged)
- **Files modified:** apps/frontend/src/pages/JournalEntriesPage.tsx
- **Commit:** f933bb8a

**2. [Rule 2 - Critical] api imported as `{ api }` not default export**

- **Found during:** Task 1 — checked useJournalEntries.ts and confirmed `import { api } from '@/services/api'` (named export), not `import api from '@/services/api'`
- **Fix:** Used `{ api }` named import in all new hooks — matches existing codebase pattern
- **Files modified:** usePendingPostings.ts, useAccountingRules.ts

## Known Stubs

None — all hooks call real API endpoints. The preview panel shows a "no data" info card if the `/preview` endpoint returns 404, which is the correct behavior (no operations of that type exist yet). This is documented behavior per D-18, not a stub.

## Self-Check: PASSED

All key files verified below.
