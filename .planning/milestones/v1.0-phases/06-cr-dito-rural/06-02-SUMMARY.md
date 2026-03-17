---
phase: 06-cr-dito-rural
plan: '02'
subsystem: rural-credit-schema
tags: [prisma, migration, rural-credit, schema]
dependency_graph:
  requires: []
  provides:
    [
      RuralCreditContract,
      RuralCreditInstallment,
      RuralCreditLine,
      AmortizationSystem,
      RuralCreditStatus,
    ]
  affects: [Organization, Farm, BankAccount, Payable]
tech_stack:
  added: []
  patterns:
    [manually-applied migration with migrate resolve due to shadow database stale cultivar issue]
key_files:
  created:
    - apps/backend/prisma/migrations/20260403110000_add_rural_credit/migration.sql
  modified:
    - apps/backend/prisma/schema.prisma
decisions:
  - 'Migration applied manually via psql + migrate resolve — shadow database fails on stale cultivar migration (known pattern from Phase 01)'
  - 'RuralCreditInstallment uses payableId @unique — one installment record per Payable, enabling atomic balance tracking on settlement'
  - 'outstandingBalance stored on contract and outstandingBalanceAfter on each installment — enables fast balance queries without aggregation'
metrics:
  duration: 4min
  completed_date: '2026-03-17'
  tasks_completed: 2
  files_changed: 2
---

# Phase 6 Plan 02: Rural Credit Schema Summary

Prisma schema models and migration for rural credit contracts: SAC/PRICE/BULLET amortization, principal/interest split per installment, and atomic balance tracking on settlement.

## What Was Built

### Models Added

**RuralCreditContract** — contract-level data: credit line (PRONAF/PRONAMP/FUNCAFE/CPR/CREDITO_LIVRE), amortization system (SAC/PRICE/BULLET), principal amount, annual rate, term in months, grace period, first payment date, IOF/TAC fees, guarantee description, alert threshold, outstanding balance, and totals for principal/interest paid.

**RuralCreditInstallment** — join model linking each contract installment to a Payable with principal/interest split and outstandingBalanceAfter. The `payableId @unique` constraint ensures one installment record per Payable, enabling atomic balance updates on settlement without parsing string fields.

### Enums Added

- `RuralCreditLine`: PRONAF, PRONAMP, FUNCAFE, CPR, CREDITO_LIVRE
- `AmortizationSystem`: SAC, PRICE, BULLET
- `RuralCreditStatus`: ATIVO, QUITADO, INADIMPLENTE, CANCELADO

### Back-relations Added

- `Organization.ruralCreditContracts RuralCreditContract[]`
- `Farm.ruralCreditContracts RuralCreditContract[]`
- `BankAccount.ruralCreditContracts RuralCreditContract[]`
- `Payable.ruralCreditInstallment RuralCreditInstallment?`

### Indexes

- `@@index([organizationId])` — list all contracts for an org
- `@@index([organizationId, status])` — filter by status (ATIVO, INADIMPLENTE)
- `@@index([organizationId, farmId])` — contracts per farm
- `@@index([contractId])` on RuralCreditInstallment — all installments for a contract

## Task Summary

| Task | Name                                            | Commit  | Files                                                                        |
| ---- | ----------------------------------------------- | ------- | ---------------------------------------------------------------------------- |
| 1    | Add RuralCreditContract schema models and enums | 3096ac5 | apps/backend/prisma/schema.prisma                                            |
| 2    | Generate and apply migration                    | f1ef046 | apps/backend/prisma/migrations/20260403110000_add_rural_credit/migration.sql |

## Verification Results

- `npx prisma validate` — schema valid
- `npx prisma migrate status` — 108 migrations found, database schema up to date
- `npx prisma generate` — Prisma Client v7.4.1 generated with new types

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Shadow database stale migration prevents `migrate dev`**

- **Found during:** Task 2
- **Issue:** `npx prisma migrate dev --name add_rural_credit` failed: migration `20260311080000_add_grain_harvests` fails on shadow database because cultivar table does not exist there
- **Fix:** Used `prisma migrate diff --from-config-datasource --to-schema` to generate clean SQL, created migration directory manually, applied SQL via psql, then ran `npx prisma migrate resolve --applied` — same pattern documented in STATE.md decisions from Phase 01
- **Files modified:** None extra — migration.sql created as planned
- **Commit:** f1ef046

## Self-Check: PASSED

- `apps/backend/prisma/schema.prisma` — FOUND, contains `model RuralCreditContract` and `model RuralCreditInstallment`
- `apps/backend/prisma/migrations/20260403110000_add_rural_credit/migration.sql` — FOUND, contains CREATE TABLE statements
- Commit 3096ac5 — FOUND
- Commit f1ef046 — FOUND
