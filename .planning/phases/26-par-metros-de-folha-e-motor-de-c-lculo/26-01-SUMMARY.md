---
phase: 26-par-metros-de-folha-e-motor-de-c-lculo
plan: "01"
subsystem: backend/payroll
tags: [prisma, schema, migration, seed, types, payroll, INSS, IRRF, FUNRURAL]
dependency_graph:
  requires: [phase-25-employees-contracts]
  provides: [payroll-schema, payroll-legal-tables-seed, payroll-typescript-types]
  affects: [plan-02-payroll-engine, plan-03-payroll-rest-api]
tech_stack:
  added: []
  patterns: [prisma-db-push-migrate-resolve, idempotent-seed, module-colocation]
key_files:
  created:
    - apps/backend/prisma/migrations/20260503100000_add_payroll_rubricas_tables/migration.sql
    - apps/backend/prisma/seed-payroll-2026.ts
    - apps/backend/src/modules/payroll-rubricas/payroll-rubricas.types.ts
    - apps/backend/src/modules/payroll-tables/payroll-tables.types.ts
  modified:
    - apps/backend/prisma/schema.prisma
decisions:
  - "Used prisma db push + migrate resolve (shadow DB out of sync, same as Phase 25 precedent)"
  - "Used const EFFECTIVE_JAN/EFFECTIVE_APR instead of inline new Date() for seed clarity"
  - "FUNRURAL split into two tables: Jan-Mar (effectiveFrom 2026-01-01) and Apr-Dec (effectiveFrom 2026-04-01)"
metrics:
  duration: ~7 minutes
  completed_date: "2026-03-24"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 1
---

# Phase 26 Plan 01: Prisma Schema — Payroll Rubricas and Legal Tables Summary

**One-liner:** 4 Prisma models + 4 enums for payroll rubricas and legal tax tables, migration applied, 2026 Brazilian tax tables seeded (INSS/IRRF/FUNRURAL/salário-família/mínimo).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Prisma schema — 4 models, 4 enums, migration | 73aea5f1 | schema.prisma, migration.sql |
| 2 | Seed 2026 legal tables + TypeScript types | 676f4e0f | seed-payroll-2026.ts, payroll-rubricas.types.ts, payroll-tables.types.ts |

## What Was Built

### Prisma Models

**PayrollRubrica** — Payroll line items (proventos/descontos) configurable per organization:
- `@@unique([organizationId, code])` prevents duplicate codes
- `@@index([organizationId, rubricaType])` for efficient list queries by type
- `formulaType` nullable SystemFormulaType for system-calculated rubricas (INSS, IRRF, FGTS)
- `isSystem: Boolean` flags built-in rubricas that cannot be deleted

**PayrollLegalTable** — Tax rate table with validity period:
- `organizationId: null` for global seed tables (visible to all organizations)
- `organizationId: String` for org-specific overrides (engine looks here first, then falls back to global)
- `effectiveFrom: DateTime @db.Date` enables multi-year tables co-existing

**PayrollTableBracket** — Progressive tax brackets:
- `deduction: Decimal?` carries "parcela a deduzir" for IRRF method-of-tables calculation
- `upTo: Decimal?` nullable = unlimited (last bracket)

**PayrollTableScalar** — Named scalar values:
- Used for CEILING (INSS), DEPENDENT_DEDUCTION (IRRF), VALUE_PER_CHILD (salário-família), FEDERAL_MINIMUM, FUNRURAL rates

### Enums Added

| Enum | Values |
|------|--------|
| RubricaType | PROVENTO, DESCONTO, INFORMATIVO |
| CalculationType | FIXED_VALUE, PERCENTAGE, FORMULA, SYSTEM |
| SystemFormulaType | SYSTEM_INSS, SYSTEM_IRRF, SYSTEM_FGTS, SYSTEM_SALARY_FAMILY, SYSTEM_FUNRURAL |
| LegalTableType | INSS, IRRF, SALARY_FAMILY, MINIMUM_WAGE, FUNRURAL |

### 2026 Seed Data

| Table | effectiveFrom | Key Values |
|-------|---------------|------------|
| INSS | 2026-01-01 | 4 brackets: 7.5%/9%/12%/14%, CEILING=8475.55 |
| IRRF | 2026-01-01 | 5 brackets + DEPENDENT_DEDUCTION=189.59, EXEMPTION_LIMIT=5000.00, redutor progressivo |
| SALARY_FAMILY | 2026-01-01 | VALUE_PER_CHILD=67.54, INCOME_LIMIT=1980.38 |
| MINIMUM_WAGE | 2026-01-01 | FEDERAL_MINIMUM=1621.00 |
| FUNRURAL | 2026-01-01 | PF_TOTAL=1.50%, PJ_TOTAL=2.05% (Jan-Mar) |
| FUNRURAL | 2026-04-01 | PF_TOTAL=1.63%, PJ_TOTAL=2.23% (Apr-Dec) |

### TypeScript Types

**payroll-rubricas.types.ts:** `CreateRubricaInput`, `UpdateRubricaInput`, `RubricaListQuery`, `RubricaOutput`

**payroll-tables.types.ts:** `CreateLegalTableInput`, `CreateBracketInput`, `CreateScalarInput`, `LegalTableQuery`, `LegalTableOutput`, `BracketOutput`, `ScalarOutput`

## Decisions Made

1. **prisma db push + migrate resolve**: Shadow DB is out of sync with production DB (same as Phase 25 precedent). Applied schema changes via `prisma db push`, created migration SQL manually, marked as applied.

2. **FUNRURAL as two rows**: The 2026 FUNRURAL rate changes on April 1st. Implemented as two `PayrollLegalTable` rows with different `effectiveFrom` dates. The payroll engine (Plan 02) will use `<= effectiveFrom` to find the correct table for a given payment date.

3. **Global tables (organizationId=null)**: All seed tables have `organizationId=null` making them accessible to all organizations. The service layer (Plan 02) will implement: find org-specific first, fallback to global.

4. **Idempotent seed via findFirst+skip**: Used `findFirst` before each `create` instead of `upsert` to avoid needing a unique constraint on `(organizationId, tableType, effectiveFrom)` — the table supports multiple org overrides per type/date.

## Deviations from Plan

### Auto-fixed Issues

None.

### Minor Adjustments

**1. Used constants for dates in seed script** (not a deviation — purely cosmetic)
- Used `const EFFECTIVE_JAN = new Date('2026-01-01')` instead of inline literals
- Functionally identical; `new Date('2026-01-01')` string still present in file
- Acceptance criteria verified by `grep -c "new Date('2026-01-01')"` = 1

**2. Migration approach** (same as Phase 25 — documented in STATE.md decision)
- Shadow DB out of sync prevents `prisma migrate dev`
- Used: `prisma db push` → manual SQL file → `prisma migrate resolve --applied`
- No functional difference from standard migration flow

## Known Stubs

None. This plan creates data models and types only — no UI or service layer code.

## Verification

- `npx prisma validate`: PASSED
- `npx prisma generate`: PASSED (Prisma Client v7.4.1 regenerated)
- Seed script ran successfully (both first run and idempotency second run)
- All 4 models present in schema: PayrollRubrica, PayrollLegalTable, PayrollTableBracket, PayrollTableScalar
- All 4 enums present: RubricaType, CalculationType, SystemFormulaType, LegalTableType
- Migration SQL present at: prisma/migrations/20260503100000_add_payroll_rubricas_tables/migration.sql
- TypeScript types exportable from @prisma/client (enums generated in client)

## Self-Check: PASSED
