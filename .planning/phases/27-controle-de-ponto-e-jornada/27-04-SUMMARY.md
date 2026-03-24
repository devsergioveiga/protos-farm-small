---
phase: 27-controle-de-ponto-e-jornada
plan: "04"
subsystem: frontend
tags: [attendance, time-tracking, frontend, rh, banco-de-horas, team-linking]
dependency_graph:
  requires: [27-03]
  provides: [AttendancePage, attendance-types, time-entries-hooks, team-linking]
  affects: [App.tsx, Sidebar.tsx]
tech_stack:
  added: []
  patterns: [useState+useCallback hooks, tab pattern, modal pattern, JetBrains Mono for time values]
key_files:
  created:
    - apps/frontend/src/types/attendance.ts
    - apps/frontend/src/hooks/useTimeEntries.ts
    - apps/frontend/src/hooks/useTimesheet.ts
    - apps/frontend/src/pages/AttendancePage.tsx
    - apps/frontend/src/pages/AttendancePage.css
    - apps/frontend/src/components/attendance/ManualPunchModal.tsx
    - apps/frontend/src/components/attendance/LinkOperationModal.tsx
    - apps/frontend/src/components/attendance/OvertimeBankCard.tsx
    - apps/frontend/src/components/attendance/TeamLinkingTab.tsx
  modified:
    - apps/frontend/src/App.tsx
    - apps/frontend/src/components/layout/Sidebar.tsx
decisions:
  - api.getBlob used for PDF export instead of api.get with responseType blob (api.get only takes one argument)
  - TeamLinkingTab uses inline fetch for field teams (simple scope, no separate hook)
metrics:
  duration_minutes: 25
  completed_date: "2026-03-24"
  tasks_completed: 2
  tasks_total: 3
  files_created: 9
  files_modified: 2
---

# Phase 27 Plan 04: Frontend AttendancePage Summary

Frontend web AttendancePage with 3 tabs (Apontamentos, Banco de Horas, Vincular Operacoes), ManualPunchModal for manager punch entry, TeamLinkingTab for PONTO-02 bulk team activity linking, OvertimeBankCard with expiry warnings, and all hooks/types registered.

## What Was Built

### Task 1: Types + Hooks + AttendancePage + Modals + Routes

**attendance.ts** — Complete frontend types mirroring backend:
- `TimeEntry`, `TimeEntryActivity`, `Timesheet`, `TimesheetCorrection`, `TimesheetInconsistency`, `OvertimeBankSummary`, `OvertimeBankEntry`, `CreateTimeEntryInput`, `AddActivityInput`
- Types use `null` for DB-nullable fields per CLAUDE.md (Prisma pattern)

**useTimeEntries.ts** — useState+useCallback pattern (no SWR per Phase 25 decision):
- `fetchTimeEntries(query)` → GET `/api/org/:orgId/time-entries`
- `createTimeEntry(employeeId, data)` → POST `/api/org/:orgId/employees/:id/time-entries`
- `addActivity(timeEntryId, data)` → POST `/api/org/:orgId/time-entries/:id/activities`

**useTimesheet.ts** — Same pattern:
- `fetchTimesheets`, `fetchTimesheet`, `calculateTimesheet`, `approveTimesheet`, `addCorrection`, `exportPdf` (uses `api.getBlob`)

**AttendancePage.tsx** — 3-tab page at `/attendance`:
- Breadcrumb: RH > Controle de Ponto
- Filters: employee select (from useEmployees), date range pickers
- Tab 1 (Apontamentos): table with all punch columns, source chips (Mobile/Web/Gerente), mobile card view
- Tab 2 (Banco de Horas): OvertimeBankCard grid per employee
- Tab 3 (Vincular Operacoes): TeamLinkingTab

**ManualPunchModal.tsx** — Manager manual punch form:
- Fields: Colaborador (select from employees), Data, Tipo (ENTRADA/SAIDA/INTERVALO_INICIO/INTERVALO_FIM), Horario, Justificativa (min 10 chars)
- Inline validation onBlur, source='MANAGER'

**LinkOperationModal.tsx** — Individual entry linking:
- Fields: Tipo de Operacao (select + common types), Talhao/Pasto, Centro de Custo, Minutos, Observacoes
- Preview: estimated hours from minutes

**OvertimeBankCard.tsx** — Read-only card per employee:
- Balance in JetBrains Mono, expiry warnings ≤30 days (warning) / ≤7 days (error)
- Entries list via `<details>` expandable

**AttendancePage.css** — Full styling:
- JetBrains Mono for all time cells
- Source chips with semantic colors
- Mobile card layout at <768px (table hidden)
- Overtime grid, modal animations, team-linking styles

**App.tsx** — `/attendance` route registered
**Sidebar.tsx** — "Controle de Ponto" (Clock icon) added to RH group

### Task 2: TeamLinkingTab (PONTO-02)

**TeamLinkingTab.tsx** — Bulk team activity linking:
- "Por Equipe" section: team select (fetches `/field-teams`), date, operation type, talhao, cost center (pre-filled from team), minutes, notes
- POST `/org/:orgId/time-entries/team/:teamId/activities` on submit
- Response: shows "Vinculado para N de M membros" + skipped count
- "Individual" section: table of time entries with "Vincular" button → opens LinkOperationModal from parent
- Empty state when no teams on selected farm

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed api.getBlob usage in useTimesheet.ts**
- **Found during:** Task 1 TypeScript verification
- **Issue:** `api.get<Blob>` was called with two arguments but api.get only accepts one (path). This caused TS error TS2554.
- **Fix:** Changed to `api.getBlob(path)` which is the correct blob download method
- **Files modified:** apps/frontend/src/hooks/useTimesheet.ts
- **Commit:** 25ea0941

## Known Stubs

None — all data flows from real API endpoints. The page displays empty states when no data is returned.

## Self-Check: PASSED

Files created:
- apps/frontend/src/types/attendance.ts ✓
- apps/frontend/src/hooks/useTimeEntries.ts ✓
- apps/frontend/src/hooks/useTimesheet.ts ✓
- apps/frontend/src/pages/AttendancePage.tsx ✓
- apps/frontend/src/pages/AttendancePage.css ✓
- apps/frontend/src/components/attendance/ManualPunchModal.tsx ✓
- apps/frontend/src/components/attendance/LinkOperationModal.tsx ✓
- apps/frontend/src/components/attendance/OvertimeBankCard.tsx ✓
- apps/frontend/src/components/attendance/TeamLinkingTab.tsx ✓

Commits:
- 25ea0941: feat(27-04): add AttendancePage... ✓
- d1f6e6af: feat(27-04): add TeamLinkingTab... ✓

TypeScript: npx tsc --noEmit exits 0 ✓
