---
phase: 30-seguranca-trabalho-nr31
plan: "03"
subsystem: backend
tags: [training, nr31, epi, safety, pdf, certificate, position-requirements]
dependency_graph:
  requires:
    - 30-01 (schema + types foundation)
  provides:
    - training-types CRUD with NR-31 seed + system type protection
    - position training requirements CRUD
    - training-records CRUD with collective participants + expiresAt calculation
    - certificate PDF generation per participant
  affects:
    - apps/backend/src/modules/training-types/
    - apps/backend/src/modules/training-records/
tech_stack:
  added: []
  patterns:
    - findFirst+create pattern for null-safe unique constraint seeding
    - withRlsContext for multi-step transactions (employee verify + record creation)
    - dynamic import('pdfkit') for certificate PDF generation
    - isSystem=true OR organizationId filter for hybrid system/org types
key_files:
  created:
    - apps/backend/src/modules/training-types/training-types.service.ts
    - apps/backend/src/modules/training-types/training-types.routes.spec.ts
    - apps/backend/src/modules/training-records/training-records.service.ts
    - apps/backend/src/modules/training-records/training-records.routes.spec.ts
  modified:
    - apps/backend/src/modules/training-types/training-types.routes.ts
    - apps/backend/src/modules/training-records/training-records.routes.ts
decisions:
  - "findFirst+create instead of upsert for NR-31 seed: Postgres null!=null in unique constraints"
  - "employees:read / employees:manage permissions for training routes (no hr: module exists)"
  - "expiresAt calculated via setMonth(d.getMonth() + validityMonths) inside withRlsContext transaction"
metrics:
  duration: "9 minutes"
  completed: "2026-03-26"
  tasks_completed: 2
  files_changed: 6
---

# Phase 30 Plan 03: Training Backend Modules Summary

JWT-authenticated training type CRUD with 7 NR-31 system types seeded via findFirst+create, system type immutability guard (SYSTEM_TYPE_READONLY), position-based training requirements, and collective training records with automatic expiry calculation + certificate PDF via pdfkit.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | training-types service + routes + tests + NR-31 seed | 74741d24 | training-types.service.ts, routes.ts, routes.spec.ts |
| 2 | training-records service + routes + tests + certificate PDF | c90990b0 | training-records.service.ts, routes.ts, routes.spec.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Used `employees:read`/`employees:manage` instead of `hr:read`/`hr:admin`**
- **Found during:** Task 1 implementation
- **Issue:** Plan specified `hr:read` and `hr:admin` permissions which do not exist in the PermissionModule type or DEFAULT_ROLE_PERMISSIONS matrix
- **Fix:** Mapped to existing `employees:read` (for read operations) and `employees:manage` (for write/admin operations), which are semantically correct and already granted to MANAGER role
- **Files modified:** training-types.routes.ts, training-records.routes.ts

## Verification Results

- All training tests pass: 30/30 (18 training-types + 12 training-records)
- NR-31 seed covers 7 system types (Integração, Agrotóxicos, Máquinas, Elétricas, Transporte, Altura, CIPA)
- System type protection: SYSTEM_TYPE_READONLY error on edit/delete
- Training records with 3 employees: each gets calculated expiresAt = date + defaultValidityMonths
- Certificate PDF returns application/pdf content-type

## Known Stubs

None — all functionality is fully implemented.

## Self-Check: PASSED
