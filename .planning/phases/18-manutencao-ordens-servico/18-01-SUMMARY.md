---
phase: 18-manutencao-ordens-servico
plan: '01'
subsystem: api
tags: [maintenance-plans, node-cron, redis, prisma, supertest, jest]

# Dependency graph
requires:
  - phase: 18-00
    provides: MaintenancePlan model, RBAC permissions, test stubs
provides:
  - maintenance plans CRUD API (5 endpoints)
  - computeNextDue function for HOURMETER/ODOMETER/CALENDAR triggers
  - processOverduePlans function for daily alert cron
  - daily cron at 06:00 BRT with Redis distributed lock
  - 28 integration tests covering all endpoints and pure function behavior
affects:
  - 18-02 (work orders can import computeNextDue for post-close recalculation)
  - 18-04 (frontend maintenance plans page)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - computeNextDue pure function exported for cross-module reuse
    - cron with Redis NX lock for distributed dedup (same as digest.cron.ts)

key-files:
  created:
    - apps/backend/src/modules/maintenance-plans/maintenance-plans.service.ts
    - apps/backend/src/modules/maintenance-plans/maintenance-plans.routes.ts
    - apps/backend/src/shared/cron/maintenance-alerts.cron.ts
  modified:
    - apps/backend/src/modules/maintenance-plans/maintenance-plans.routes.spec.ts

key-decisions:
  - "computeNextDue is exported from service so work-orders can reuse it on OS close without duplication"
  - "processOverduePlans notifies all ADMIN/MANAGER users in the org when plan is overdue"

patterns-established:
  - "Maintenance plan routes use /org/:orgId path prefix matching assets.routes.ts convention"
  - "RLS context uses organizationId from req.user injected by authenticate middleware"

requirements-completed:
  - MANU-01

# Metrics
duration: 15min
completed: 2026-03-21
---

# Phase 18 Plan 01: Maintenance Plans Backend Summary

**Preventive maintenance plan API with CRUD, trigger-based next-due calculation (HOURMETER/ODOMETER/CALENDAR), daily alert cron with Redis lock, and 28 integration tests**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-21T10:46:00Z
- **Completed:** 2026-03-21T11:01:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- CRUD service with 7 functions: createMaintenancePlan, listMaintenancePlans, getMaintenancePlan, updateMaintenancePlan, deleteMaintenancePlan, computeNextDue (exported), processOverduePlans
- Express router with 5 endpoints registered at `/api/org/:orgId/maintenance-plans`
- Daily cron at 06:00 BRT using node-cron with Redis distributed lock (EX 3600, NX)
- 28 passing integration tests replacing all it.todo stubs

## Task Commits

1. **Task 1: Maintenance plans service + routes** - `c603d471` (feat)
2. **Task 2: Daily alert cron + integration tests** - `c1085aae` (feat)

## Files Created/Modified

- `apps/backend/src/modules/maintenance-plans/maintenance-plans.service.ts` - CRUD + computeNextDue + processOverduePlans
- `apps/backend/src/modules/maintenance-plans/maintenance-plans.routes.ts` - 5-endpoint REST router with RBAC guards
- `apps/backend/src/shared/cron/maintenance-alerts.cron.ts` - Daily 06:00 BRT cron with Redis lock
- `apps/backend/src/modules/maintenance-plans/maintenance-plans.routes.spec.ts` - 28 integration tests

## Decisions Made

- `computeNextDue` is exported from the service so work-orders module can reuse it on OS close without duplicating the date arithmetic logic
- `processOverduePlans` queries both calendar (nextDueAt <= now) and meter-based plans (currentMeter >= nextDueMeter), filtering active plans only

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Maintenance plans API is complete and tested
- `computeNextDue` is ready for import in work-orders service (Plan 02) for post-OS-close recalculation
- `processOverduePlans` ready to be wired into app startup cron registration

---
*Phase: 18-manutencao-ordens-servico*
*Completed: 2026-03-21*

## Self-Check: PASSED

- FOUND: apps/backend/src/modules/maintenance-plans/maintenance-plans.service.ts
- FOUND: apps/backend/src/modules/maintenance-plans/maintenance-plans.routes.ts
- FOUND: apps/backend/src/shared/cron/maintenance-alerts.cron.ts
- FOUND: .planning/phases/18-manutencao-ordens-servico/18-01-SUMMARY.md
- FOUND: commit c603d471 (feat(18-01): maintenance plans CRUD service + routes)
- FOUND: commit c1085aae (feat(18-01): daily alert cron + 28 integration tests)
