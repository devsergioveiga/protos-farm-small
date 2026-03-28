---
phase: 30
plan: 06
subsystem: frontend-safety
tags: [frontend, nr31, training, aso, medical-exams, compliance]
depends_on:
  requires: [30-03, 30-04, 30-05]
  provides: [training-types-ui, training-records-ui, medical-exams-ui]
  affects: [safety-dashboard]
tech-stack:
  added: []
  patterns: [multi-step-modal, combobox-dropdown, expandable-rows, compliance-status-badge]
key-files:
  created:
    - apps/frontend/src/types/training.ts
    - apps/frontend/src/types/medical-exam.ts
    - apps/frontend/src/types/epi.ts
    - apps/frontend/src/types/safety.ts
    - apps/frontend/src/hooks/useTrainingTypes.ts
    - apps/frontend/src/hooks/useTrainingRecords.ts
    - apps/frontend/src/hooks/useMedicalExams.ts
    - apps/frontend/src/hooks/useEpiProducts.ts
    - apps/frontend/src/hooks/useEpiDeliveries.ts
    - apps/frontend/src/components/shared/ComplianceStatusBadge.tsx
    - apps/frontend/src/components/training-types/TrainingTypeModal.tsx
    - apps/frontend/src/components/training-types/TrainingTypeModal.css
    - apps/frontend/src/components/training-types/PositionTrainingRequirementsModal.tsx
    - apps/frontend/src/components/training-types/PositionTrainingRequirementsModal.css
    - apps/frontend/src/components/training-records/TrainingRecordModal.tsx
    - apps/frontend/src/components/training-records/TrainingRecordModal.css
    - apps/frontend/src/components/medical-exams/MedicalExamModal.tsx
    - apps/frontend/src/components/medical-exams/MedicalExamModal.css
    - apps/frontend/src/pages/TrainingTypesPage.tsx
    - apps/frontend/src/pages/TrainingTypesPage.css
    - apps/frontend/src/pages/TrainingRecordsPage.tsx
    - apps/frontend/src/pages/TrainingRecordsPage.css
    - apps/frontend/src/pages/MedicalExamsPage.tsx
    - apps/frontend/src/pages/MedicalExamsPage.css
    - apps/frontend/src/pages/EpiProductsPage.tsx
    - apps/frontend/src/pages/EpiProductsPage.css
    - apps/frontend/src/pages/EpiDeliveriesPage.tsx
    - apps/frontend/src/pages/EpiDeliveriesPage.css
    - apps/frontend/src/pages/SafetyDashboardPage.tsx
    - apps/frontend/src/pages/SafetyDashboardPage.css
  modified:
    - apps/frontend/src/components/layout/Sidebar.tsx
    - apps/frontend/src/App.tsx
decisions:
  - ComplianceStatusBadge reusable for both training expiry and ASO expiry (shared component)
  - TrainingRecordModal uses multi-step pattern per UI-SPEC: Step 1 data, Step 2 participants
  - Hours below minHours shows warning (not error) — allows saving with acknowledgement
  - MOCK_EMPLOYEES stub in MedicalExamsPage and TrainingRecordModal — wired in plan 30-07 (useEmployees hook)
  - EPI foundation files created as Rule 3 deviation since plan 30-05 ran in a different worktree
metrics:
  duration: ~90min
  completed: '2026-03-26'
  tasks: 2
  files: 30
requirements: [SEGUR-02, SEGUR-03]
---

# Phase 30 Plan 06: Training and ASO Frontend Summary

Treinamentos NR-31 e ASOs (Atestados de Saúde Ocupacional) com rastreamento de conformidade, badges de resultado e modais completos de registro.

## What Was Built

### Task 1 — Training Types and Records

**ComplianceStatusBadge** (`components/shared/ComplianceStatusBadge.tsx`): reusable pill component for OK/YELLOW/RED/EXPIRED compliance states, used by both training and ASO expiry tracking.

**useTrainingTypes** hook: fetches training types with `seedNr31Types` (seeds the 7 mandatory NR-31 types via POST), CRUD operations, and position requirement management.

**useTrainingRecords** hook: fetches records with query filters (trainingTypeId, instructorType, dateFrom, dateTo), create/delete, and `downloadCertificatePdf(trainingRecordId, employeeId)` via `api.getBlob`.

**TrainingTypeModal**: form with name, description, minHours, defaultValidityMonths, nrReference, isGlobal. Validates on submit — minHours and defaultValidityMonths are numeric-required.

**PositionTrainingRequirementsModal**: shows global training types as non-removable chips ("Todos os cargos"), position-specific requirements with delete, and an add picker filtered to non-yet-assigned types.

**TrainingTypesPage**: tab strip with "Tipos de Treinamento" and "Requisitos por Cargo". Type table shows "Sistema" badge (sky-100/sky-500) for system types (read-only rows), edit/delete only for custom types. Seed button calls `seedNr31Types`. Requisitos tab lists all positions (stub — wired in plan 30-07).

**TrainingRecordModal** (multi-step):

- Step 1: training type select, instructor type radio (INTERNO/EXTERNO/PRESENCIAL/EAD), date, instructor name, hours + warning when `effectiveHours < minHours`
- Step 2: employee multi-select with checkbox, shows expiresAt preview calculated from trainingDate + defaultValidityMonths

**TrainingRecordsPage**: filter bar (type, instructor type radio group, date range), table with expandable rows per record showing participant list + ComplianceStatusBadge + "Baixar Certificado" download button.

### Task 2 — Medical Exams (ASO)

**useMedicalExams** hook: fetches with query params (employeeId, type, result, expiryStatus, farmId, page, limit), CRUD, `updateMedicalExam`.

**MedicalExamModal**:

- Employee picker: combobox with dropdown (max 8 results), closes on mousedown selection
- ASO type: select with ASO_TYPE_LABELS (ADMISSIONAL, PERIODICO, RETORNO, MUDANCA_FUNCAO, DEMISSIONAL)
- Date: max=today, validates no future dates
- Doctor name + CRM: CRM validated against `/^CRM\/[A-Z]{2}\s?\d{4,6}$/`, JetBrains Mono styling
- Result: radio group APTO/INAPTO/APTO_COM_RESTRICAO
- INAPTO banner (info-100/info-700): "Colaborador inapto para trabalho. O gestor será notificado via dashboard de conformidade."
- Restrictions textarea: only visible when APTO_COM_RESTRICAO, required
- nextExamDate: auto-calculated via `useEffect` from `date + asoPeriodicityMonths ?? 12`, user can override
- Validates: next exam date must be after exam date

**MedicalExamsPage**:

- `AsoResultBadge` inline component: APTO (success-100/500), INAPTO (error-100/500), APTO_COM_RESTRICAO (warning-100/500) with CheckCircle/XCircle/AlertTriangle icons
- Filter bar: employee name search, tipo ASO, resultado, status vencimento
- Client-side employee name filter; server-side filters for type/result/expiryStatus
- Table: COLABORADOR, FUNÇÃO, TIPO ASO, DATA, MÉDICO (CRM), RESULTADO, PRÓXIMO EXAME, AÇÕES
- PRÓXIMO EXAME: shows ComplianceStatusBadge when expiryStatus present, else formatted date
- Actions: download link (only when documentUrl present), delete with ConfirmModal variant="warning"

### Foundation (Rule 3 Deviation)

Plan 30-05 ran in a different worktree. Created all prerequisite files as Rule 3 auto-fix:

- 4 type files (epi.ts, training.ts, medical-exam.ts, safety.ts)
- 2 EPI hooks (useEpiProducts, useEpiDeliveries)
- 3 placeholder pages (EpiProductsPage, EpiDeliveriesPage, SafetyDashboardPage)
- ComplianceStatusBadge shared component
- Sidebar SEGURANÇA DO TRABALHO navigation group
- App.tsx lazy routes for all 6 safety pages

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan 30-05 prerequisites not in worktree**

- **Found during:** Task 1 start
- **Issue:** types/training.ts, types/medical-exam.ts, ComplianceStatusBadge, Sidebar safety group, App.tsx routes were all missing — plan 30-05 ran in a parallel worktree that hasn't been merged
- **Fix:** Created all prerequisite foundation files (30 files total including EPI placeholder pages) to unblock plan 30-06 execution
- **Files modified:** See "created" list above
- **Commit:** baecca43

### Known Stubs

**1. MOCK_EMPLOYEES in MedicalExamsPage and TrainingRecordModal**

- **File:** `apps/frontend/src/pages/MedicalExamsPage.tsx` line 67-72
- **File:** `apps/frontend/src/components/training-records/TrainingRecordModal.tsx` (employees prop receives empty array from page)
- **Reason:** useEmployees hook does not yet exist in this worktree. The employee combobox and multi-select render correctly but show no options.
- **Resolution:** Plan 30-07 (SafetyDashboardPage) or a shared useEmployees hook will wire the employee list.

**2. TrainingTypesPage Requisitos tab position list**

- **File:** `apps/frontend/src/pages/TrainingTypesPage.tsx` (Requisitos tab shows empty position list)
- **Reason:** usePositions or similar hook not yet available in this worktree.
- **Resolution:** Plan 30-07 or shared position hook wiring.

**3. SafetyDashboardPage placeholder**

- **File:** `apps/frontend/src/pages/SafetyDashboardPage.tsx`
- **Reason:** Planned for plan 30-07.

## Self-Check: PASSED

Files verified:

- apps/frontend/src/hooks/useTrainingTypes.ts — FOUND
- apps/frontend/src/hooks/useTrainingRecords.ts — FOUND
- apps/frontend/src/hooks/useMedicalExams.ts — FOUND
- apps/frontend/src/pages/TrainingTypesPage.tsx — FOUND
- apps/frontend/src/pages/TrainingRecordsPage.tsx — FOUND
- apps/frontend/src/pages/MedicalExamsPage.tsx — FOUND
- apps/frontend/src/components/shared/ComplianceStatusBadge.tsx — FOUND
- apps/frontend/src/components/training-types/TrainingTypeModal.tsx — FOUND
- apps/frontend/src/components/training-types/PositionTrainingRequirementsModal.tsx — FOUND
- apps/frontend/src/components/training-records/TrainingRecordModal.tsx — FOUND
- apps/frontend/src/components/medical-exams/MedicalExamModal.tsx — FOUND

Commits verified:

- baecca43 — Task 1 (training types & records)
- b43ffcdc — Task 2 (medical exams)

TypeScript: zero errors (`npx tsc --noEmit` clean output)
