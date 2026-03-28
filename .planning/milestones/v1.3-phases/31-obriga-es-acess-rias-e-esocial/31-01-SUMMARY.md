---
phase: 31-obriga-es-acess-rias-e-esocial
plan: 01
subsystem: esocial-foundation
tags: [prisma, schema, types, esocial, tax-guides, income-statements]
dependency_graph:
  requires: []
  provides:
    - TaxGuide Prisma model (tax_guides table)
    - EsocialEvent Prisma model (esocial_events table)
    - IncomeStatement Prisma model (income_statements table)
    - TaxGuideType, TaxGuideStatus, EsocialGroup, EsocialStatus, FunruralBasis enums
    - funruralBasis field on Organization model
    - Backend type definitions for all three modules
    - Frontend type definitions for all three modules
    - xmlbuilder2 installed in backend
  affects:
    - Organization model (funruralBasis field added)
    - Employee model (incomeStatements relation added)
tech_stack:
  added:
    - xmlbuilder2@^4.0.3 (XML builder for eSocial XML generation)
  patterns:
    - Prisma model with @@unique + @@index per established pattern
    - Module collocated types file (controller+service+routes+types)
    - Frontend types mirroring backend output shapes
key_files:
  created:
    - apps/backend/src/modules/tax-guides/tax-guides.types.ts
    - apps/backend/src/modules/esocial-events/esocial-events.types.ts
    - apps/backend/src/modules/income-statements/income-statements.types.ts
    - apps/frontend/src/types/tax-guide.ts
    - apps/frontend/src/types/esocial-event.ts
    - apps/frontend/src/types/income-statement.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/package.json
    - pnpm-lock.yaml
decisions:
  - 'xmlbuilder2 chosen over @xmldom/xmldom (already present) — xmlbuilder2 provides fluent builder API suited for generating eSocial XML documents'
  - 'FunruralBasis defaults to PAYROLL on Organization — rural employers who opted for payroll-based FUNRURAL (more common in small farms)'
  - 'EsocialStatus uses Portuguese values (PENDENTE/EXPORTADO/ACEITO/REJEITADO) per eSocial specification naming'
metrics:
  duration: 6min
  completed_date: 2026-03-26
  tasks_completed: 3
  tasks_total: 3
  files_created: 6
  files_modified: 3
---

# Phase 31 Plan 01: eSocial Foundation — Prisma Models, Enums, and Type Definitions Summary

**One-liner:** Three new Prisma models (TaxGuide, EsocialEvent, IncomeStatement) with 5 enums, funruralBasis on Organization, xmlbuilder2 installed, and complete backend + frontend type definitions for Phase 31 modules.

## Tasks Completed

| Task | Name                                                         | Commit   | Files                                                                    |
| ---- | ------------------------------------------------------------ | -------- | ------------------------------------------------------------------------ |
| 1    | Prisma schema models, enums, migration + install xmlbuilder2 | b5483f91 | schema.prisma, package.json, pnpm-lock.yaml                              |
| 2    | Backend type definitions for all three modules               | 45c7fc22 | tax-guides.types.ts, esocial-events.types.ts, income-statements.types.ts |
| 3    | Frontend type definitions for all three modules              | 1bf85228 | tax-guide.ts, esocial-event.ts, income-statement.ts                      |

## What Was Built

### Prisma Schema Changes

Added to `apps/backend/prisma/schema.prisma`:

**5 New Enums:**

- `TaxGuideType` — FGTS, INSS, IRRF, FUNRURAL
- `TaxGuideStatus` — PENDING, GENERATED, PAID, OVERDUE
- `EsocialGroup` — TABELA, NAO_PERIODICO, PERIODICO, SST
- `EsocialStatus` — PENDENTE, EXPORTADO, ACEITO, REJEITADO
- `FunruralBasis` — GROSS_REVENUE, PAYROLL

**3 New Models:**

- `TaxGuide` — stores FGTS/INSS/IRRF/FUNRURAL tax guides; unique on (organizationId, guideType, referenceMonth)
- `EsocialEvent` — stores eSocial XML events with state machine (PENDENTE→EXPORTADO→ACEITO/REJEITADO→PENDENTE); indexed by group/status, referenceMonth, sourceType/sourceId
- `IncomeStatement` — annual income statements per employee; unique on (organizationId, employeeId, yearBase)

**Model Updates:**

- `Organization` — added `funruralBasis FunruralBasis @default(PAYROLL)` + 3 new relations
- `Employee` — added `incomeStatements IncomeStatement[]` relation

### Backend Type Files

Each module under `apps/backend/src/modules/{domain}/` has a `types.ts` with:

- Output interface (for API responses)
- Input interfaces (for create/generate operations)
- Query interface (for list endpoints with filtering)
- Error class (extends Error with statusCode)
- Constants (due days, receita codes, state machine transitions, event type mappings)

Key exports per module:

- **tax-guides**: `TaxGuideOutput`, `TAX_GUIDE_DUE_DAYS` (FGTS=7, others=20), `TAX_GUIDE_RECEITA_CODES`
- **esocial-events**: `EsocialEventOutput`, `VALID_ESOCIAL_TRANSITIONS`, `ESOCIAL_EVENT_TYPES`, `EVENT_GROUP_MAP`, `SOURCE_TYPE_MAP`, `EsocialDashboardOutput`
- **income-statements**: `IncomeStatementOutput`, `RaisConsistencyOutput`, `SendIncomeStatementsInput`

### Frontend Type Files

Mirror backend output shapes with pt-BR label constants:

- `apps/frontend/src/types/tax-guide.ts` — `TaxGuide`, `TAX_GUIDE_TYPE_LABELS`, `TAX_GUIDE_STATUS_LABELS`
- `apps/frontend/src/types/esocial-event.ts` — `EsocialEvent`, `EsocialDashboard`, `ESOCIAL_GROUP_LABELS`, `ESOCIAL_STATUS_LABELS`, `ESOCIAL_EVENT_TYPE_LABELS`
- `apps/frontend/src/types/income-statement.ts` — `IncomeStatement`, `RaisConsistency`, `GenerateIncomeStatementsInput`

## Verification Results

- `npx prisma validate` — PASSED (schema valid)
- `npx prisma db push` — PASSED (database in sync)
- `npx prisma generate` — PASSED (Prisma client generated)
- Frontend `tsc --noEmit` — PASSED (0 errors)
- Backend `tsc --noEmit` — Pre-existing errors only (employee-movements spec, employees routes, epi-deliveries service); no errors in new modules

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan creates pure type/schema definitions. No UI components or data fetching wired yet. Plans 02-05 will implement services, controllers, routes, and frontend pages.

## Self-Check: PASSED

Files verified:

- apps/backend/prisma/schema.prisma contains `model TaxGuide` — FOUND
- apps/backend/prisma/schema.prisma contains `model EsocialEvent` — FOUND
- apps/backend/prisma/schema.prisma contains `model IncomeStatement` — FOUND
- apps/backend/src/modules/tax-guides/tax-guides.types.ts — FOUND
- apps/backend/src/modules/esocial-events/esocial-events.types.ts — FOUND
- apps/backend/src/modules/income-statements/income-statements.types.ts — FOUND
- apps/frontend/src/types/tax-guide.ts — FOUND
- apps/frontend/src/types/esocial-event.ts — FOUND
- apps/frontend/src/types/income-statement.ts — FOUND

Commits verified:

- b5483f91 — FOUND
- 45c7fc22 — FOUND
- 1bf85228 — FOUND
