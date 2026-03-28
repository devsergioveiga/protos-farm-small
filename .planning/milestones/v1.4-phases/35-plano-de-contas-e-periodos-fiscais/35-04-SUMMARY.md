---
phase: 35
plan: 04
subsystem: frontend/accounting
tags: [frontend, chart-of-accounts, fiscal-periods, react, typescript]
dependency_graph:
  requires: [35-02, 35-03]
  provides: [coa-frontend, fiscal-periods-frontend]
  affects: [accounting-entries-frontend]
tech_stack:
  added: []
  patterns: [expandable-tree, period-grid, preset-buttons, confirm-modal-deactivation]
key_files:
  created:
    - apps/frontend/src/types/accounting.ts
    - apps/frontend/src/hooks/useChartOfAccounts.ts
    - apps/frontend/src/hooks/useFiscalPeriods.ts
    - apps/frontend/src/components/accounting/CoaTreeNode.tsx
    - apps/frontend/src/components/accounting/CoaTreeNode.css
    - apps/frontend/src/components/accounting/CoaModal.tsx
    - apps/frontend/src/components/accounting/CoaModal.css
    - apps/frontend/src/components/accounting/FiscalYearModal.tsx
    - apps/frontend/src/components/accounting/FiscalYearModal.css
    - apps/frontend/src/pages/ChartOfAccountsPage.tsx
    - apps/frontend/src/pages/ChartOfAccountsPage.css
    - apps/frontend/src/pages/FiscalPeriodsPage.tsx
    - apps/frontend/src/pages/FiscalPeriodsPage.css
  modified:
    - apps/frontend/src/components/layout/Sidebar.tsx
    - apps/frontend/src/App.tsx
decisions:
  - 'Period close uses ConfirmModal (variant=warning) per CLAUDE.md — never window.confirm'
  - 'Reopen period requires inline textarea for reason before confirming'
  - 'FiscalYearCard renders PeriodPanel inline (not a separate modal) to show audit info'
  - 'COA tree built client-side from flat array via buildTree() helper — avoids extra API call'
  - 'isSynthetic checkbox programmatically disables allowManualEntry to enforce data integrity'
metrics:
  duration_minutes: 22
  completed_date: '2026-03-27'
  tasks_completed: 2
  tasks_total: 3
  files_created: 13
  files_modified: 2
---

# Phase 35 Plan 04: Frontend Plano de Contas e Períodos Fiscais Summary

**One-liner:** COA expandable tree with CRUD modal and rural template seed + fiscal year cards with 12-month period grid and OPEN/CLOSED/BLOCKED status management.

## What Was Built

Two new pages under the CONTABILIDADE sidebar group, backed by typed hooks and components:

### Chart of Accounts Page (`/chart-of-accounts`)

- Breadcrumb, header with "Carregar Template Rural" and "Nova Conta" buttons
- SPED unmapped accounts alert bar (yellow warning if count > 0)
- Client-side search/filter on code or name
- Recursive expandable tree via `CoaTreeNode` with chevron expand/collapse
- Level-based indent: `paddingLeft = level * 24px`
- Type badges (ATIVO=blue, PASSIVO=orange, PL=purple, RECEITA=green, DESPESA=red) using `var(--color-*)` tokens
- Nature D/C indicator badge, synthetic accounts labeled "Grupo"
- Inactive accounts: opacity 0.5 + strikethrough on name
- All actions use `<button>` with `aria-label` — no `div onClick`
- `aria-expanded` on expand/collapse buttons
- Deactivation via `ConfirmModal` with `variant="warning"` (never `window.confirm`)
- Empty state: GitBranch icon + description + "Carregar Template Rural" CTA
- Skeleton loading (8 rows with pulse animation)

### Chart of Accounts Modal (`CoaModal`)

- Create and edit modes (edit mode pre-fills form)
- Fields: code, name, parentId (select synthetic accounts), accountType, nature, isSynthetic, allowManualEntry, isFairValueAdj, spedRefCode
- `isSynthetic` checkbox disables `allowManualEntry` checkbox automatically
- Inline validation onBlur for required fields
- Visible labels on all fields, `aria-required`, errors with `role="alert"`

### Fiscal Periods Page (`/fiscal-periods`)

- Breadcrumb, header with "Novo Exercício Fiscal" button
- Fiscal year cards: name, date range, active badge, 12-column period grid
- Period cells: month abbreviation + year + status badge
- Status badges: OPEN = green outline, CLOSED = gray filled, BLOCKED = red filled
- Click on OPEN period → `ConfirmModal` with `variant="warning"` to confirm close
- Click on CLOSED/BLOCKED period → inline `PeriodPanel` with audit info and action buttons
- Reopen requires textarea for reason (validated before confirming)
- Blocked periods show info text, no reopen action
- Empty state with "Criar Exercício" CTA
- Skeleton: 2 year cards with pulse grid

### FiscalYearModal

- Fields: name, startDate, endDate
- Preset buttons: "Calendário (Jan–Dez)" fills Jan 1 – Dec 31 current year; "Safra (Jul–Jun)" fills Jul 1 – Jun 30 next year
- Cross-field validation: endDate must be after startDate

### Sidebar + Routes

- Added `Plano de Contas` (GitBranch icon) and `Períodos Fiscais` (Calendar icon) before Lançamentos Contábeis in CONTABILIDADE group
- Lazy routes `/chart-of-accounts` and `/fiscal-periods` in `App.tsx`

### Hooks

- `useChartOfAccounts`: 6 exports (useChartOfAccounts, useCreateAccount, useUpdateAccount, useDeactivateAccount, useSeedTemplate, useUnmappedSped)
- `useFiscalPeriods`: 5 exports (useFiscalYears, useCreateFiscalYear, useClosePeriod, useReopenPeriod, useBlockPeriod)
- All hooks read `orgId` from `useAuth()` and use `/org/${orgId}/...` API paths

## Deviations from Plan

None — plan executed exactly as written.

## Task 3: Checkpoint Awaiting Human Verification

Task 3 is a `checkpoint:human-verify` gate. The automated check (`tsc --noEmit`) passes with zero errors.

**Verification steps for human:**

1. Start frontend dev server: `cd apps/frontend && pnpm dev`
2. Navigate to sidebar → CONTABILIDADE → "Plano de Contas"
3. Verify empty state with "Carregar Template Rural" CTA
4. Click "Carregar Template Rural" — verify tree populates with ~80+ accounts
5. Expand tree nodes — verify indent increases per level, chevron toggles
6. Click "Nova Conta" — verify modal opens with all fields, isSynthetic disables allowManualEntry
7. Navigate to "Períodos Fiscais"
8. Click "Novo Exercício Fiscal" — verify preset buttons (Calendário/Safra)
9. Create a calendar year — verify 12 monthly period cells with OPEN status
10. Click a period cell — verify close/reopen/block actions
11. Verify responsive layout on mobile width

## Known Stubs

None — all data flows through real API hooks. The pages will show their empty state when backend returns no data (expected before seeding).

## Self-Check: PASSED

All files confirmed present:

- apps/frontend/src/types/accounting.ts ✓
- apps/frontend/src/hooks/useChartOfAccounts.ts ✓
- apps/frontend/src/hooks/useFiscalPeriods.ts ✓
- apps/frontend/src/components/accounting/CoaTreeNode.tsx ✓
- apps/frontend/src/components/accounting/CoaModal.tsx ✓
- apps/frontend/src/components/accounting/FiscalYearModal.tsx ✓
- apps/frontend/src/pages/ChartOfAccountsPage.tsx ✓
- apps/frontend/src/pages/FiscalPeriodsPage.tsx ✓

Commits:

- 3ca1b309: feat(35-04): add COA types, hooks, tree node, modal and page
- 50a13012: feat(35-04): add fiscal periods page, modal, hooks, sidebar links and routes

TypeScript: `npx tsc --noEmit` — 0 errors (verified twice, once per task)
