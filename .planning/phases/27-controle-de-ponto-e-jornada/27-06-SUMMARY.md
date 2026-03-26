---
phase: 27-controle-de-ponto-e-jornada
plan: 06
status: complete
started: 2026-03-24
completed: 2026-03-24
---

## Summary

Frontend TimesheetPage (Espelho de Ponto) with monthly timesheet review, calendar grid, approval flow, inconsistency highlighting, corrections, and PDF export.

## Key Files

### Created
- apps/frontend/src/pages/TimesheetPage.tsx - Main page with filters, summary bar, two tabs
- apps/frontend/src/pages/TimesheetPage.css - Styles
- apps/frontend/src/components/attendance/TimesheetApprovalModal.tsx - Approve/reject flow
- apps/frontend/src/components/attendance/TimesheetApprovalModal.css - Styles
- apps/frontend/src/components/attendance/TimeEntryEditModal.tsx - Correction modal
- apps/frontend/src/components/attendance/TimeEntryEditModal.css - Styles

### Modified
- apps/frontend/src/App.tsx - Route /timesheets
- apps/frontend/src/components/layout/Sidebar.tsx - Espelho de Ponto under RH

## What Was Built

- TimesheetPage at /timesheets with month/year, employee, status filters
- Summary bar: total worked, HE 50%, HE 100%, noturno, absences
- Status chips for 7 states (DRAFT through LOCKED) with color-coded icons
- Espelho Mensal tab with corrections audit trail and action buttons
- Inconsistencias tab with red-highlighted rows, severity badges, Corrigir buttons
- TimesheetApprovalModal: approve (confirm) and reject (textarea min 20 chars)
- TimeEntryEditModal: read-only original, corrected value, justification
- PDF export via hook, JetBrains Mono for all time values

## Verification

- Task 2 (visual verification): Approved by user

## Deviations

None.
