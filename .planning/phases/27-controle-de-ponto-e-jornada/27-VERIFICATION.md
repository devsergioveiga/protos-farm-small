---
phase: 27-controle-de-ponto-e-jornada
verified: 2026-03-24T16:00:00Z
status: passed
score: 4/4 must-haves verified
gaps: []
human_verification:
  - test: "Mobile time-punch GPS geofencing behavior with real device"
    expected: "Out-of-range modal appears when GPS coordinates are outside farm boundary polygon; punch still registers with outOfRange=true flag"
    why_human: "Requires a physical device with GPS and a farm with a boundary polygon configured in the database"
  - test: "Offline sync of time punches"
    expected: "Punches created offline appear in the local list immediately and sync to server when connectivity returns"
    why_human: "Requires toggling network connectivity on a real device or emulator; SQLite offline state cannot be simulated programmatically here"
  - test: "PDF espelho de ponto export"
    expected: "Clicking 'Exportar PDF' on TimesheetPage downloads a PDF with header, date table (data/entrada/intervalos/saída/horas/HE/noturno), totals row, and 3-column signature section"
    why_human: "PDF rendering and download trigger require a running browser session; pdfkit output quality requires visual inspection"
  - test: "Approval flow end-to-end on TimesheetPage"
    expected: "Manager can approve (PENDING_MANAGER -> PENDING_RH), RH can approve (PENDING_RH -> APPROVED), reject requires 20+ char justification, employee can accept via app"
    why_human: "Requires authenticated sessions as different roles and a timesheet in the correct state"
---

# Phase 27: Controle de Ponto e Jornada — Verification Report

**Phase Goal:** Colaborador pode registrar ponto via mobile ou web, gerente pode vincular horas a atividades e operações de campo, o sistema calcula automaticamente horas extras, adicional noturno rural e banco de horas, e o gerente pode revisar e aprovar o espelho de ponto mensal antes do processamento da folha
**Verified:** 2026-03-24T16:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Colaborador pode registrar ponto (entrada, intervalos, saída) via app mobile com geolocalização validada contra perímetro da fazenda (PostGIS), funcionando offline com sincronização automática, e gerente pode registrar manualmente para equipes sem celular | VERIFIED | `apps/mobile/app/(app)/time-punch.tsx` (776L) — GPS via expo-location, ST_Contains check wired via backend endpoint, SQLite offline storage in `time-punch-repository.ts`, `time_punches` in `OperationEntity` with CRITICAL priority; backend `POST /org/:orgId/employees/:employeeId/time-entries` with MANAGER source and managerNote validation |
| 2 | Gerente pode vincular horas a atividades/operações por talhão ou pasto com modo rápido por equipe, e custo/hora é calculado automaticamente | VERIFIED | `addTeamActivity` in `time-entries.service.ts` iterates FieldTeam.members, finds each TimeEntry for the date, calls `addActivity` per member; `addActivity` derives hourlyRate from EmployeeContract.salary; `POST /org/:orgId/time-entries/team/:teamId/activities` endpoint; `TeamLinkingTab.tsx` calls `/org/${orgId}/time-entries/team/${teamId}/activities` |
| 3 | Sistema calcula automaticamente HE (50%/100%), banco de horas com alerta de vencimento 6 meses, adicional noturno rural (21h-5h, 25%, hora reduzida 52m30s), alerta de interjornada < 11h | VERIFIED | `time-calculations.service.ts` (153L): `calcDailyWork`, `calcRuralNightPremium` (60/52.5 factor), `isHolidayOrSunday` (date-holidays BR), `calcInterjornada` (<660min alert), `calcMonthlyTotals`; `timesheets.service.ts` calls all 5 functions at `calculateTimesheet`; `overtime-bank.service.ts` expiry 6-month logic; 23 tests passing |
| 4 | Gerente pode revisar espelho de ponto mensal com inconsistências visuais, corrigir com justificativa, fluxo gerente → RH, colaborador aceita via app, exportação PDF, prazo configurável | VERIFIED | `TimesheetPage.tsx` (560L) — Inconsistencias tab with severity badges, `TimesheetApprovalModal.tsx` with APPROVE_MANAGER/APPROVE_RH/REJECT (min 20 chars), `TimeEntryEditModal.tsx` for corrections; `timesheets.service.ts` state machine with VALID_TRANSITIONS; PDF via pdfkit in `generateTimesheetPdf`; `closingDeadline` field on Timesheet model |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/backend/prisma/schema.prisma` | 5 models + 3 enums for time tracking | VERIFIED | TimeEntry, TimeEntryActivity, OvertimeBankEntry, Timesheet, TimesheetCorrection at lines 8054-8174; TimeEntrySource, OvertimeBankType, TimesheetStatus enums at lines 8024-8052 |
| `apps/backend/prisma/migrations/20260504100000_add_time_tracking_models/migration.sql` | Migration DDL for all time tracking tables | VERIFIED | Directory confirmed present |
| `apps/backend/src/modules/time-entries/time-entries.types.ts` | CreateTimeEntryInput, TimeEntryOutput, TimeEntryListQuery | VERIFIED | All 3 interfaces exported (96L) |
| `apps/backend/src/modules/time-calculations/time-calculations.types.ts` | DailyWorkInput, DailyWorkResult, RuralNightResult | VERIFIED | All interfaces exported including MonthlyTotals (69L) |
| `apps/backend/src/modules/overtime-bank/overtime-bank.types.ts` | OvertimeBankSummary, OvertimeBankOutput | VERIFIED | Present (44L) |
| `apps/backend/src/modules/timesheets/timesheets.types.ts` | TimesheetOutput, TimesheetApprovalInput | VERIFIED | Both interfaces exported (87L) |
| `apps/backend/src/modules/time-calculations/time-calculations.service.ts` | 5 pure calculation functions | VERIFIED | 153L; all 5 functions exported: calcDailyWork, calcRuralNightPremium, calcInterjornada, calcMonthlyTotals, isHolidayOrSunday |
| `apps/backend/src/modules/time-calculations/time-calculations.spec.ts` | Unit tests, min 150 lines | VERIFIED | 210L; 23 tests across all calculation functions |
| `apps/backend/src/modules/time-entries/time-entries.service.ts` | createTimeEntry, addActivity, addTeamActivity | VERIFIED | 541L; all functions present including PostGIS ST_Contains geofencing |
| `apps/backend/src/modules/time-entries/time-entries.routes.ts` | 6 REST endpoints | VERIFIED | Registered in app.ts at line 287 |
| `apps/backend/src/modules/overtime-bank/overtime-bank.service.ts` | getOvertimeBankSummary, listOvertimeBankEntries | VERIFIED | Present with expiry alert logic |
| `apps/backend/src/modules/overtime-bank/overtime-bank.routes.ts` | 3 endpoints | VERIFIED | Registered in app.ts at line 288 |
| `apps/backend/src/modules/timesheets/timesheets.service.ts` | 7 functions including generateTimesheetPdf | VERIFIED | 771L; pdfkit dynamic import confirmed; state machine present |
| `apps/backend/src/modules/timesheets/timesheets.routes.ts` | 7 endpoints including PDF | VERIFIED | Registered in app.ts at line 289 |
| `apps/frontend/src/pages/AttendancePage.tsx` | 3 tabs: Apontamentos, Banco de Horas, Vincular Operacoes | VERIFIED | 470L; imports useTimeEntries, ManualPunchModal, TeamLinkingTab, OvertimeBankCard |
| `apps/frontend/src/components/attendance/ManualPunchModal.tsx` | Manual punch with justification | VERIFIED | Present |
| `apps/frontend/src/components/attendance/TeamLinkingTab.tsx` | Bulk team activity linking | VERIFIED | Calls `/org/${orgId}/time-entries/team/${teamId}/activities` |
| `apps/frontend/src/hooks/useTimeEntries.ts` | Hooks wired to backend API | VERIFIED | api.get/post calls to correct endpoints |
| `apps/frontend/src/hooks/useTimesheet.ts` | Timesheet hook with approve, correct, exportPdf | VERIFIED | All API calls present including getBlob for PDF |
| `apps/frontend/src/pages/TimesheetPage.tsx` | Espelho de Ponto with inconsistency highlighting | VERIFIED | 560L; Inconsistencias tab, severity badges, approval and correction modals |
| `apps/frontend/src/components/attendance/TimesheetApprovalModal.tsx` | Approve/reject with justification | VERIFIED | APPROVE_MANAGER, APPROVE_RH, REJECT with 20-char minimum enforced |
| `apps/frontend/src/components/attendance/TimeEntryEditModal.tsx` | Correction modal with justification | VERIFIED | Present |
| `apps/mobile/app/(app)/time-punch.tsx` | Clock-in/out with GPS, offline, haptics | VERIFIED | 776L; expo-location, TimePunchRepository, offline-queue integration |
| `apps/mobile/services/db/time-punch-repository.ts` | SQLite CRUD for offline punches | VERIFIED | 94L; TimePunchRepository class with getTodayPunches, getPendingCount |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| schema.prisma TimeEntry | Employee model | employeeId FK | WIRED | `employeeId String` + `employee Employee @relation` at line 7750 |
| schema.prisma Timesheet | TimeEntry[] | timeEntries relation | WIRED | `timeEntries TimeEntry[]` at line 8153 |
| timesheets.service.ts | time-calculations.service.ts | calcDailyWork, calcMonthlyTotals, isHolidayOrSunday imports | WIRED | Lines 5-7 of timesheets.service.ts; called at lines 292 and 351 |
| time-calculations.service.ts | decimal.js | Decimal arithmetic | WIRED | `import Decimal from 'decimal.js'` confirmed |
| time-calculations.service.ts | date-holidays | Holiday detection | WIRED | `import Holidays from 'date-holidays'` confirmed |
| time-entries.service.ts | PostGIS | ST_Contains geofence | WIRED | `ST_Contains(boundary::geometry, ST_SetSRID(ST_MakePoint(...), 4326))` at line 208 |
| timesheets.service.ts | pdfkit | PDF generation | WIRED | `const PDFDocument = (await import('pdfkit')).default` at line 771 |
| app.ts | timeEntriesRouter, overtimeBankRouter, timesheetsRouter | app.use('/api', ...) | WIRED | Lines 139-141 (imports), 287-289 (registration) |
| AttendancePage.tsx | useTimeEntries hook | import + usage | WIRED | Imported at line 12; destructured and called at line 82+ |
| TimesheetPage.tsx | useTimesheet hook | import + usage | WIRED | Imported at line 13; destructured and called at line 115+ |
| TeamLinkingTab.tsx | /org/:orgId/time-entries/team/:teamId/activities | api.post | WIRED | Lines 134-135 |
| mobile time-punch.tsx | TimePunchRepository | SQLite offline storage | WIRED | Lines 166-167; `repository.getTodayPunches` called in loadPunches |
| mobile time-punch.tsx | offline-queue (OperationEntity: time_punches) | createOfflineQueue | WIRED | Line 31 import; `time_punches` in OperationEntity with CRITICAL priority |
| mobile database.ts | migrationV12 | time_punches table DDL | WIRED | V12 migration creates `time_punches` table at line 611; registered at line 79 |
| permissions.ts | attendance module | MANAGER read/write/delete | WIRED | `attendance` at lines 25, 53, 123, 151 |
| App.tsx | AttendancePage | /attendance route | WIRED | lazy import line 127; Route at line 244 |
| App.tsx | TimesheetPage | /timesheets route | WIRED | lazy import line 128; Route at line 245 |
| Sidebar.tsx | /attendance, /timesheets | Clock, CalendarCheck icons | WIRED | Lines 257-258 |
| mobile more.tsx | /(app)/time-punch | router.push | WIRED | Lines 134-137 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| AttendancePage.tsx | timeEntries | useTimeEntries.fetchTimeEntries → api.get `/org/:orgId/time-entries` → time-entries.service listTimeEntries → prisma.timeEntry.findMany | Yes — Prisma query with pagination, filters | FLOWING |
| AttendancePage.tsx | overtimeBankSummaries | api.get `/org/:orgId/overtime-bank` → overtime-bank.service getOvertimeBankSummary → prisma aggregation | Yes — real aggregation from DB | FLOWING |
| TimesheetPage.tsx | timesheets | useTimesheet.fetchTimesheets → api.get `/org/:orgId/timesheets` → timesheets.service listTimesheets → prisma.timesheet.findMany | Yes | FLOWING |
| TimesheetPage.tsx | inconsistencies | selectedTimesheet?.inconsistencies (from useTimesheet.fetchTimesheet → GET /:id with inconsistency calculation) | Yes — calculated at getTimesheet time | FLOWING |
| time-punch.tsx (mobile) | todayPunches | repository.getTodayPunches → SQLite SELECT WHERE date = today AND synced=false | Yes — real SQLite query | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 5 calculation functions exported | `node -e "..." check on service file` | All 5 FOUND | PASS |
| Type files exist and are non-trivial | `node -e "..."` check on 4 type files | All FOUND (44-96L each) | PASS |
| 3 routers registered in app.ts | grep app.ts | Lines 287-289 confirmed | PASS |
| date-holidays in package.json | grep package.json | `"date-holidays": "^3.26.11"` confirmed | PASS |
| Commits exist for all 6 plans | git log | All 6 plan commits found | PASS |
| Mobile migrationV12 creates time_punches | grep database.ts | CREATE TABLE IF NOT EXISTS time_punches at line 613 | PASS |
| time_punches in OperationEntity with CRITICAL priority | grep pending-operations-repository.ts | Line 27 and 45 confirmed | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PONTO-01 | 27-01 through 27-05 | Colaborador registra ponto via mobile com geolocalização, offline sync, ou web, ou apontamento do gerente | SATISFIED | Mobile: time-punch.tsx + TimePunchRepository + V12 migration; Web: ManualPunchModal + AttendancePage; Backend: createTimeEntry with MANAGER source + managerNote validation; Geofencing: ST_Contains in service |
| PONTO-02 | 27-03, 27-04 | Gerente vincula horas a atividades/operações com modo rápido por equipe, custo/hora automático | SATISFIED | addTeamActivity in time-entries.service.ts; TeamLinkingTab.tsx calling team activities endpoint; hourlyRate derived from EmployeeContract.salary |
| PONTO-03 | 27-02, 27-03 | HE 50%/100%, banco de horas, adicional noturno rural, interjornada, DSR, feriados | SATISFIED | time-calculations.service.ts with all 5 functions; 23 tests passing; calculateTimesheet in timesheets.service creates OvertimeBankEntry CREDIT; isHolidayOrSunday uses date-holidays BR |
| PONTO-04 | 27-03, 27-06 | Gerente revisa e aprova espelho, inconsistências visuais, correção com justificativa, gerente→RH→folha, colaborador aceita, PDF, prazo fechamento | SATISFIED | TimesheetPage.tsx with Inconsistencias tab + severity badges; TimesheetApprovalModal with state machine; TimeEntryEditModal for corrections; generateTimesheetPdf with pdfkit; closingDeadline on Timesheet; EMPLOYEE_ACCEPT action in approveTimesheet |

No orphaned requirements — all 4 PONTO IDs appear in plan frontmatter and are covered by implementation.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO, FIXME, placeholder, or empty return stubs found across all 8 backend service/route files and the 2 frontend pages.

### Human Verification Required

#### 1. Mobile GPS Geofencing

**Test:** On a physical device with GPS enabled, open the time-punch screen and attempt to clock in while outside the farm boundary polygon configured for your test farm.
**Expected:** Out-of-range modal appears warning the user they are outside farm boundaries; punch still registers with `outOfRange=true`; if farm has no boundary polygon, `noBoundary=true` is set and no modal appears.
**Why human:** Requires GPS hardware, a farm record with a valid PostGIS boundary polygon, and network connectivity to the backend for the ST_Contains check.

#### 2. Offline Sync of Time Punches

**Test:** Put the mobile device in airplane mode, clock in and out, then restore connectivity.
**Expected:** Punches appear immediately in today's list from SQLite; sync dot changes from pending (orange) to syncing to synced (green) after reconnection; punches appear in the backend time-entries list.
**Why human:** Offline behavior requires toggling device network state; SQLite state cannot be injected programmatically in this environment.

#### 3. PDF Espelho de Ponto

**Test:** With a Timesheet that has been calculated (status PENDING_MANAGER or later), click the PDF export button on TimesheetPage.
**Expected:** PDF downloads; contains: header with employee name and reference month; table with columns data/entrada/intervalos/saída/horas/HE/noturno; totals row; 3-column signature section (Colaborador, Gerente, RH).
**Why human:** PDF download and content quality require a running browser session and pdfkit rendering.

#### 4. Full Approval Flow

**Test:** With a timesheet in DRAFT status: (1) click Calcular to run calculations; (2) as MANAGER approve — status advances to PENDING_RH; (3) as RH user approve — status advances to APPROVED; (4) test that REJECT with fewer than 20 characters is blocked; (5) on mobile, accept the timesheet as employee.
**Expected:** Each transition works with correct role authorization; status chips update accordingly; LOCKED status appears after payroll run processes the timesheet.
**Why human:** Requires authenticated sessions as different roles (MANAGER, RH) and a properly configured org with employees and time entries.

### Gaps Summary

No gaps found. All 4 observable truths are fully verified across all 4 levels (exists, substantive, wired, data flowing). All 6 plans delivered their artifacts:

- Plan 27-01: Prisma schema (5 models, 3 enums), migration, date-holidays, TypeScript types — all verified in schema.prisma and type files
- Plan 27-02: Time calculations engine with 5 functions and 23 tests — verified in time-calculations.service.ts and spec
- Plan 27-03: Backend REST API (16 endpoints across 3 modules) — verified in service/route files and app.ts registration
- Plan 27-04: Frontend AttendancePage with 3 tabs, hooks, manual punch and team linking — verified with data-flow to real API
- Plan 27-05: Mobile time-punch screen with GPS, offline SQLite, sync queue — verified including V12 migration and OperationEntity
- Plan 27-06: TimesheetPage with approval flow, inconsistency highlighting, PDF export — verified with hooks wired to real endpoints

Items flagged for human verification are behavioral/UX checks that require a running application: GPS on device, offline toggling, PDF rendering, and multi-role approval flow.

---

_Verified: 2026-03-24T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
