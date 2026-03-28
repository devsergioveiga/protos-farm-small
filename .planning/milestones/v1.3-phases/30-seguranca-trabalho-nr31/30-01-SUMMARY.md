---
phase: 30-seguranca-trabalho-nr31
plan: '01'
subsystem: backend
tags: [prisma, schema, types, nr31, epi, training, medical-exams, safety]
dependency_graph:
  requires: []
  provides:
    - schema.prisma with all Phase 30 NR-31 models and enums
    - TypeScript interfaces for all 6 safety modules
    - app.ts wired with 6 stub routers
  affects:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/app.ts
    - all subsequent 30-0x plans (consume these types and models)
tech_stack:
  added: []
  patterns:
    - collocated modules pattern (types + routes + stub)
    - Prisma db push + migrate resolve for schema-first migrations
key_files:
  created:
    - apps/backend/prisma/migrations/20260507100000_add_safety_nr31_models/migration.sql
    - apps/backend/src/modules/epi-products/epi-products.types.ts
    - apps/backend/src/modules/epi-products/epi-products.routes.ts
    - apps/backend/src/modules/epi-deliveries/epi-deliveries.types.ts
    - apps/backend/src/modules/epi-deliveries/epi-deliveries.routes.ts
    - apps/backend/src/modules/training-types/training-types.types.ts
    - apps/backend/src/modules/training-types/training-types.routes.ts
    - apps/backend/src/modules/training-records/training-records.types.ts
    - apps/backend/src/modules/training-records/training-records.routes.ts
    - apps/backend/src/modules/medical-exams/medical-exams.types.ts
    - apps/backend/src/modules/medical-exams/medical-exams.routes.ts
    - apps/backend/src/modules/safety-compliance/safety-compliance.types.ts
    - apps/backend/src/modules/safety-compliance/safety-compliance.routes.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/app.ts
decisions:
  - 'Used prisma db push + migrate resolve pattern (same as prior phases) — avoids shadow DB sync issues'
  - 'TrainingType.organizationId is nullable to support system-global types (isSystem=true) without org binding'
  - 'classifyExpiryAlert() placed in safety-compliance.types.ts as shared pure function, no service dependencies'
  - 'Pre-existing TypeScript errors in employees/payroll modules are out-of-scope — not introduced by this plan'
metrics:
  duration: '8 minutes'
  completed: '2026-03-26'
  tasks_completed: 2
  files_changed: 15
---

# Phase 30 Plan 01: Schema Migration + Types Foundation Summary

Schema migration and TypeScript types foundation for all Phase 30 NR-31 safety compliance modules. 8 new tables, 5 enums, 1 column addition to Position, and 6 collocated modules wired into app.ts.

## Tasks Completed

| Task | Name                                      | Commit   | Files                        |
| ---- | ----------------------------------------- | -------- | ---------------------------- |
| 1    | Prisma schema migration                   | ee8858d9 | schema.prisma, migration.sql |
| 2    | Types files + stub routes + app.ts wiring | e4ee1c55 | 12 new files, app.ts         |

## What Was Built

### Database Models (8 new tables)

- **EpiProduct** — links a Product to NR-31 EPI metadata (CA number, expiry, EPI type)
- **EpiDelivery** — records each EPI delivery to an employee with signature and reason
- **PositionEpiRequirement** — defines which EPIs each Position requires
- **TrainingType** — catalog of NR-31 training types (supports system-global types for seeding)
- **TrainingRecord** — a training session with instructor details and effective hours
- **EmployeeTrainingRecord** — links employees to training sessions with expiry date
- **PositionTrainingRequirement** — defines which trainings each Position requires
- **MedicalExam** — ASO exams (ADMISSIONAL, PERIODICO, RETORNO_TRABALHO, MUDANCA_RISCO, DEMISSIONAL)

### Enums (5 new)

- `EpiType`: CAPACETE, LUVA, BOTA, OCULOS, PROTETOR_AURICULAR, MASCARA, AVENTAL, CINTO, PERNEIRA, OUTROS
- `EpiDeliveryReason`: NOVO, TROCA, DANIFICADO, EXTRAVIO
- `InstructorType`: INTERNO, EXTERNO
- `AsoType`: ADMISSIONAL, PERIODICO, RETORNO_TRABALHO, MUDANCA_RISCO, DEMISSIONAL
- `AsoResult`: APTO, INAPTO, APTO_COM_RESTRICAO

### Column Addition

- `Position.asoPeriodicityMonths Int @default(12)` — ASO exam periodicity per position

### TypeScript Types (6 files)

Each module has Input/Output interfaces, error class, and constants. Notable additions:

- `NR31_TRAINING_TYPES` seed constant in training-types.types.ts (7 mandatory NR-31 trainings)
- `classifyExpiryAlert()` pure helper function in safety-compliance.types.ts
- `ComplianceSummary` and `EmployeeComplianceOutput` dashboard types

## Deviations from Plan

None — plan executed exactly as written. The only observation is that TypeScript reports pre-existing errors in employees/payroll-provisions/payroll-rubricas modules; these are unrelated to Phase 30 and were present before this plan.

## Known Stubs

All 6 route files are stubs (`const router = Router(); export default router;`). They will be filled in plans 30-02 through 30-06. The stub pattern is intentional — this plan's goal is the schema/types foundation only.

## Self-Check: PASSED

Files created:

- apps/backend/prisma/migrations/20260507100000_add_safety_nr31_models/migration.sql — FOUND
- apps/backend/src/modules/epi-products/epi-products.types.ts — FOUND
- apps/backend/src/modules/safety-compliance/safety-compliance.types.ts — FOUND
- apps/backend/src/app.ts contains epiProductsRouter — FOUND
- apps/backend/src/app.ts contains safetyComplianceRouter — FOUND

Commits:

- ee8858d9 — Task 1 schema migration
- e4ee1c55 — Task 2 types + routes + app.ts
