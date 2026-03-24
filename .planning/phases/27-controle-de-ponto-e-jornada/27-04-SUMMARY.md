---
phase: 27-controle-de-ponto-e-jornada
plan: 04
status: complete
started: 2026-03-24
completed: 2026-03-24
---

## Summary

Frontend AttendancePage with three tabs: Apontamentos (time entries table), Banco de Horas (overtime bank cards), Vincular Operacoes (team bulk linking). ManualPunchModal, hooks, types, routing, and sidebar entry.

## Key Files

### Created
- `apps/frontend/src/pages/AttendancePage.tsx` — Main page with 3 tabs
- `apps/frontend/src/pages/AttendancePage.css` — Styles
- `apps/frontend/src/components/attendance/ManualPunchModal.tsx` — Manual punch registration
- `apps/frontend/src/components/attendance/LinkOperationModal.tsx` — Link hours to operation
- `apps/frontend/src/components/attendance/OvertimeBankCard.tsx` — Overtime bank per employee
- `apps/frontend/src/components/attendance/TeamLinkingTab.tsx` — Bulk team activity linking
- `apps/frontend/src/types/attendance.ts` — TypeScript types
- `apps/frontend/src/hooks/useTimeEntries.ts` — Time entries hook
- `apps/frontend/src/hooks/useTimesheet.ts` — Timesheet hook

### Modified
- `apps/frontend/src/App.tsx` — Route /attendance
- `apps/frontend/src/components/layout/Sidebar.tsx` — Controle de Ponto under RH group

## What Was Built

- Apontamentos tab with responsive table/card view, JetBrains Mono times, source chips
- Banco de Horas tab with expiry warnings (30d warning, 7d error)
- Vincular Operacoes tab with Por Equipe bulk mode (PONTO-02)
- ManualPunchModal with justificativa (min 10 chars)
- Sidebar entry with Clock icon under RH

## Verification

- Task 3 (visual verification): Approved by user

## Deviations

None.
