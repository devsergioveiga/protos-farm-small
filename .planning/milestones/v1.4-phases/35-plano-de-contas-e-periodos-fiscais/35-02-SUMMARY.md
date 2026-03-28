---
phase: 35-plano-de-contas-e-periodos-fiscais
plan: 02
subsystem: api
tags:
  [chart-of-accounts, coa, sped, prisma, postgresql, express5, rural, cfc-embrapa, recursive-cte]

# Dependency graph
requires:
  - phase: 35-01
    provides: ChartOfAccount model in schema.prisma, migrations applied (chart_of_accounts, fiscal_years, accounting_periods, account_balances tables)

provides:
  - COA CRUD API with 7 endpoints (GET tree, GET by id, POST create, PUT update, DELETE deactivate, GET unmapped-sped, POST seed)
  - Rural CFC/Embrapa chart of accounts template with 115 accounts and SPED L300R mapping
  - Recursive tree query using WITH RECURSIVE CTE
  - Idempotent seed function using prisma.chartOfAccount.upsert
  - Integration test suite (28 tests)

affects:
  - 35-03 (fiscal periods module needs COA context)
  - 35-04 (account balances and SPED export depend on this COA structure)
  - Phase 37 (accounting rules wiring will use these accounts)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'WITH RECURSIVE coa_tree CTE for hierarchical tree query in Prisma $queryRaw'
    - 'Upsert by organizationId_code composite unique key for idempotent seed'
    - "Level computed from code.split('.').length — max 5 levels enforced"
    - 'isSynthetic=true forces allowManualEntry=false at service layer'

key-files:
  created:
    - apps/backend/src/modules/chart-of-accounts/chart-of-accounts.types.ts
    - apps/backend/src/modules/chart-of-accounts/chart-of-accounts.service.ts
    - apps/backend/src/modules/chart-of-accounts/chart-of-accounts.routes.ts
    - apps/backend/src/modules/chart-of-accounts/coa-rural-template.ts
    - apps/backend/src/modules/chart-of-accounts/chart-of-accounts.routes.spec.ts
  modified:
    - apps/backend/src/app.ts

key-decisions:
  - 'Template co-located with module (src/modules/chart-of-accounts/coa-rural-template.ts) instead of prisma/fixtures/ — tsconfig rootDir is ./src, prisma/fixtures/ is outside compilation scope'
  - 'Legacy 6.x expense codes included in template alongside CFC standard 5.x codes — ACCOUNT_CODES in accounting-entries.types.ts uses 6.x; Phase 37 will update when wiring real GL rules'
  - '115 accounts created (>80 minimum) — includes all 5 AccountType groups, Ativo Biologico (CPC 29), FUNRURAL, fair value adjustment accounts'
  - 'financial:read and financial:manage permissions used — both exist in RBAC ALL_ACTIONS x modules matrix'

requirements-completed: [COA-01, COA-02, COA-03]

# Metrics
duration: 11min
completed: 2026-03-27
---

# Phase 35 Plan 02: Chart of Accounts Backend Summary

**COA CRUD API with WITH RECURSIVE tree query, 115-account CFC/Embrapa rural template with SPED L300R mapping, and idempotent upsert seed — 28 integration tests pass**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-27T09:58:14Z
- **Completed:** 2026-03-27T10:09:31Z
- **Tasks:** 2 of 2
- **Files modified:** 6

## Accomplishments

- COA service with 6 functions: getAccountTree (WITH RECURSIVE CTE), createAccount (level validation, code uniqueness, parent validation, synthetic/manual enforcement), updateAccount, deactivateAccount (HAS_CHILDREN/HAS_BALANCES guards), getUnmappedSpedAccounts, seedRuralTemplate
- 7 Express 5 routes following CLAUDE.md conventions (req.params.orgId as string, ChartOfAccountError mapped to HTTP codes)
- Rural CFC/Embrapa template with 115 accounts: 5 level-1 groups, sub-groups for Ativo Biologico, Culturas em Formacao, FUNRURAL, isFairValueAdj accounts, legacy 6.x codes for v1.3 payroll compatibility, SPED L300R spedRefCode on all analytic accounts
- 28 integration tests covering all CRUD operations, error codes, and template content validation

## Task Commits

1. **Task 1: COA service, types, routes, and mount router** - `b5e3abbe` (feat)
2. **Task 2: Integration tests** - `d262db30` (test)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `apps/backend/src/modules/chart-of-accounts/chart-of-accounts.types.ts` - ChartOfAccountNode, CreateAccountInput, UpdateAccountInput, ChartOfAccountError with 7 error codes
- `apps/backend/src/modules/chart-of-accounts/chart-of-accounts.service.ts` - CRUD service with WITH RECURSIVE CTE tree query and seedRuralTemplate
- `apps/backend/src/modules/chart-of-accounts/chart-of-accounts.routes.ts` - 7 Express 5 routes with ChartOfAccountError handling
- `apps/backend/src/modules/chart-of-accounts/coa-rural-template.ts` - 115-account CFC/Embrapa rural template with SPED L300R mapping
- `apps/backend/src/modules/chart-of-accounts/chart-of-accounts.routes.spec.ts` - 28 integration tests
- `apps/backend/src/app.ts` - chartOfAccountsRouter mounted

## Decisions Made

- Template placed at `src/modules/chart-of-accounts/coa-rural-template.ts` (co-located with module) rather than `prisma/fixtures/` because `tsconfig.json` has `rootDir: ./src` and `include: src/**/*` — files outside `src/` cannot be imported from service files without changing `rootDir`.
- Legacy 6.x expense codes (6.1.01–6.1.05) and corresponding liability codes (2.1.01, 2.1.02, 2.1.03, 2.2.01, 2.2.02) included in template to match the hardcoded `ACCOUNT_CODES` constants in `accounting-entries.types.ts`. Phase 37 will update those constants when real GL rules are wired.
- Used `financial:manage` permission for write operations and `financial:read` for reads — both are valid in the RBAC `ALL_ACTIONS x financial` matrix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Template placed in src/ instead of prisma/fixtures/**

- **Found during:** Task 1 (compilation check)
- **Issue:** `prisma/fixtures/` is outside `rootDir: ./src` — TypeScript compilation would fail with "Cannot find module"
- **Fix:** Created `coa-rural-template.ts` co-located in `src/modules/chart-of-accounts/` instead
- **Files modified:** `apps/backend/src/modules/chart-of-accounts/coa-rural-template.ts`
- **Verification:** `npx tsc --noEmit` passes with no errors in chart-of-accounts module
- **Committed in:** `b5e3abbe` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — path outside rootDir)
**Impact on plan:** Template content is identical to plan spec; only storage location changed. All acceptance criteria met.

## Issues Encountered

- TypeScript heap out of memory on first `tsc --noEmit` run — resolved by adding `NODE_OPTIONS="--max-old-space-size=4096"`. Pre-existing project-level issue unrelated to this plan.

## Known Stubs

None — all service functions fully implemented. Seed template has actual CFC/Embrapa data. No placeholder values.

## Next Phase Readiness

- COA module fully operational — Phase 35-03 (fiscal periods) can use ChartOfAccount model for AccountBalance references
- `seedRuralTemplate` endpoint ready for Phase 37 (accounting rules) to call during org onboarding
- SPED L300R codes on analytic accounts ready for Phase 35-04 (SPED ECD export)

---

_Phase: 35-plano-de-contas-e-periodos-fiscais_
_Completed: 2026-03-27_

## Self-Check: PASSED

- FOUND: apps/backend/src/modules/chart-of-accounts/chart-of-accounts.types.ts
- FOUND: apps/backend/src/modules/chart-of-accounts/chart-of-accounts.service.ts
- FOUND: apps/backend/src/modules/chart-of-accounts/chart-of-accounts.routes.ts
- FOUND: apps/backend/src/modules/chart-of-accounts/coa-rural-template.ts
- FOUND: apps/backend/src/modules/chart-of-accounts/chart-of-accounts.routes.spec.ts
- FOUND commit: b5e3abbe (feat(35-02): COA service, types, routes and rural template)
- FOUND commit: d262db30 (test(35-02): integration tests for COA routes and rural template validation)
