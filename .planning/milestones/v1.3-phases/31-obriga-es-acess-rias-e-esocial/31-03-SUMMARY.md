---
phase: 31-obriga-es-acess-rias-e-esocial
plan: 03
subsystem: esocial-events
tags: [esocial, xml, xmlbuilder2, xsd-validation, state-machine, auto-triggers, tdd]
dependency_graph:
  requires: [31-01, esocial-events.types, EsocialEvent prisma model]
  provides:
    [
      15-event-xml-builders,
      pre-generation-validators,
      xsd-structural-validator,
      esocial-service,
      esocial-routes,
      auto-trigger-hooks,
    ]
  affects:
    [
      employees.service,
      employee-terminations.service,
      payroll-runs.service,
      medical-exams.service,
      app.ts,
    ]
tech_stack:
  added: [xmlbuilder2, '@xmldom/xmldom']
  patterns:
    [
      tdd-red-green,
      state-machine,
      builder-map-dispatch,
      xsd-constraint-validation,
      auto-trigger-try-catch,
    ]
key_files:
  created:
    - apps/backend/src/modules/esocial-events/esocial-builders/s1000-builder.ts
    - apps/backend/src/modules/esocial-events/esocial-builders/s1005-builder.ts
    - apps/backend/src/modules/esocial-events/esocial-builders/s1010-builder.ts
    - apps/backend/src/modules/esocial-events/esocial-builders/s1020-builder.ts
    - apps/backend/src/modules/esocial-events/esocial-builders/s2200-builder.ts
    - apps/backend/src/modules/esocial-events/esocial-builders/s2206-builder.ts
    - apps/backend/src/modules/esocial-events/esocial-builders/s2230-builder.ts
    - apps/backend/src/modules/esocial-events/esocial-builders/s2299-builder.ts
    - apps/backend/src/modules/esocial-events/esocial-builders/s1200-builder.ts
    - apps/backend/src/modules/esocial-events/esocial-builders/s1210-builder.ts
    - apps/backend/src/modules/esocial-events/esocial-builders/s1299-builder.ts
    - apps/backend/src/modules/esocial-events/esocial-builders/s2210-builder.ts
    - apps/backend/src/modules/esocial-events/esocial-builders/s2220-builder.ts
    - apps/backend/src/modules/esocial-events/esocial-builders/s2240-builder.ts
    - apps/backend/src/modules/esocial-events/esocial-builders/index.ts
    - apps/backend/src/modules/esocial-events/esocial-validators.ts
    - apps/backend/src/modules/esocial-events/esocial-xsd-validator.ts
    - apps/backend/src/modules/esocial-events/xsd-constraints.ts
    - apps/backend/src/modules/esocial-events/esocial-events.service.ts
    - apps/backend/src/modules/esocial-events/esocial-events.routes.ts
    - apps/backend/src/modules/esocial-events/esocial-events.spec.ts
    - apps/backend/src/modules/esocial-events/esocial-events.service.spec.ts
  modified:
    - apps/backend/src/app.ts
    - apps/backend/src/modules/employees/employees.service.ts
    - apps/backend/src/modules/employee-terminations/employee-terminations.service.ts
    - apps/backend/src/modules/payroll-runs/payroll-runs.service.ts
    - apps/backend/src/modules/medical-exams/medical-exams.service.ts
decisions:
  - 'xmlbuilder2 used for all XML generation — never string concatenation, guarantees well-formed output'
  - 'XSD validation uses @xmldom/xmldom DOM traversal with JS-translated constraint records (not full xsd4j)'
  - 'S-1299 guard checks PENDENTE count for S-1200/S-1210 in same period before allowing generation'
  - 'Auto-trigger hooks wrapped in try/catch so primary operations (createEmployee, confirmTermination, closeRun, createMedicalExam) never fail due to eSocial errors'
  - 'Reprocess creates NEW EsocialEvent record at version+1 — original REJEITADO record preserved for audit trail'
  - 'Permission strings payroll-params:write / payroll-params:read match existing payroll routes pattern'
  - '/dashboard route registered before /:id to prevent Express param shadowing'
metrics:
  duration_minutes: 90
  completed_date: '2026-03-26'
  tasks_completed: 3
  files_created: 22
  files_modified: 5
  tests_added: 62
---

# Phase 31 Plan 03: eSocial Events Backend Module Summary

XML generation infrastructure for all 15 eSocial S-1.3 event types using xmlbuilder2, with pre-generation validators, @xmldom/xmldom XSD structural validation, state machine service (PENDENTE→EXPORTADO→ACEITO|REJEITADO), reprocessing with version increments, S-1299 ordering guard, and automatic event triggers from system actions.

## Objective

Implement ESOCIAL-02 — the complete eSocial events backend: 15 XML builders, pre-generation data validators, XSD constraint validation, full state machine service with download gate, and auto-trigger hooks integrated into admission, termination, payroll close, and ASO creation.

## Tasks Completed

| Task | Description                                                                    | Commit   | Tests      |
| ---- | ------------------------------------------------------------------------------ | -------- | ---------- |
| 1    | TDD RED: failing tests for builders, validators, XSD validator                 | e01c9cce | 47 failing |
| 1    | TDD GREEN: 15 eSocial XML builders + validators + XSD validator                | abe3a487 | 47 passing |
| 2    | TDD RED: failing service tests (state machine, XSD gate, reprocess, dashboard) | 26d639c8 | 15 failing |
| 2    | TDD GREEN: eSocial service + routes + app.ts registration                      | 1f1dcd2c | 62 passing |
| 3    | Auto-trigger hooks in employees/terminations/payroll-runs/medical-exams        | e9a711d5 | —          |

## What Was Built

### XML Builders (15 event types)

Each builder in `esocial-builders/` receives a typed payload and returns well-formed XML using `xmlbuilder2`. The `BUILDER_MAP` in `index.ts` enables dynamic dispatch by event type string.

Key builder details:

- **S-2200** (admissao): CPF and PIS stripped of non-digits before insertion; salary formatted with 2 decimal places; maps `dtNascimento`, `codCBO`, `remuneracao`, `horContratual`, `duracao`
- **S-1200** (remuneracao): parses `lineItemsJson`, filters items where `eSocialCode != null`, outputs `itensRemun` elements
- **S-1299** (fechamento): uses `payrollRun.referenceMonth` (YYYY-MM) to build `perApur`; includes `indApuracao=1`
- **S-2220** (ASO): maps exam type to `tpExameOcup` (ADMISSIONAL→0, PERIODICO→1, etc.); includes `nrCRM`, `ufCRM`, `resAso`
- All builders use event-specific namespace URIs conforming to S-1.3 schema

### Pre-Generation Validators

`esocial-validators.ts` contains a validator for each event type that returns `EsocialValidationError[]`. Key rules:

- S-2200: requires `cpfTrab` (11 digits), `nisTrab` (PIS, 11 digits), `codCBO` (6 digits), `vrSalFx > 0`, `dtNascimento`
- S-1200: requires `lineItemsJson` present with at least one item having `eSocialCode != null`
- S-1299: verifies `referenceMonth` is set on the payroll run
- S-2220: requires `doctorCrm` and `result`

### XSD Structural Validator

`esocial-xsd-validator.ts` uses `DOMParser` from `@xmldom/xmldom` to parse XML and navigates the DOM by path segments from `XSD_CONSTRAINTS`. Validates:

- Required element presence (returns `Elemento obrigatorio ausente: <fieldName>`)
- Minimum length (`tamanho minimo N caracteres`)
- Maximum length (`tamanho maximo N caracteres`)
- Pattern matching with RegExp (e.g., `^\d{11}$` for CPF)

`xsd-constraints.ts` contains the `XSD_CONSTRAINTS` record with constraint entries for all 15 event types, translated from the S-1.3 XSD definitions.

### Service State Machine

`esocial-events.service.ts` enforces these transitions:

```
PENDENTE → EXPORTADO (download)
EXPORTADO → ACEITO | REJEITADO (updateStatus)
REJEITADO → PENDENTE (reprocess — creates new version record)
```

Key behaviors:

- `generateEvent`: loads source data (employee, contract, payroll item), runs pre-gen validator, checks S-1299 guard, builds XML, stores as PENDENTE
- `downloadEvent`: runs XSD validation gate — blocks with inline errors if invalid; only transitions to EXPORTADO if XSD passes (per D-06)
- `reprocessEvent`: creates a NEW `EsocialEvent` record at `version + 1`; original record stays REJEITADO for audit trail (per D-11)
- `generateBatch`: used by payroll close hook for S-1200 (per employee), S-1210 (per employee), S-1299 (once)
- `getDashboard`: aggregates counts grouped by `EsocialGroup` and status for a reference month
- S-1299 guard: `generateEvent` for S-1299 checks that no S-1200/S-1210 records remain PENDENTE for the same period — returns error if any are found (per Pitfall 5)

### Routes

8 endpoints on `GET|POST /api/org/:orgId/esocial-events`:

| Method | Path              | Permission             |
| ------ | ----------------- | ---------------------- |
| POST   | `/generate`       | `payroll-params:write` |
| POST   | `/generate-batch` | `payroll-params:write` |
| GET    | `/`               | `payroll-params:read`  |
| GET    | `/dashboard`      | `payroll-params:read`  |
| GET    | `/:id/download`   | `payroll-params:read`  |
| GET    | `/batch-download` | `payroll-params:read`  |
| PATCH  | `/:id/status`     | `payroll-params:write` |
| POST   | `/:id/reprocess`  | `payroll-params:write` |

`/dashboard` is registered before `/:id` to prevent Express param shadowing.

### Auto-Trigger Hooks (per D-08)

Four system services were augmented with try/catch eSocial trigger blocks:

- **employees.service.ts `createEmployee`**: triggers S-2200 after employee persisted
- **employee-terminations.service.ts `confirmTermination`**: triggers S-2299 after termination confirmed
- **payroll-runs.service.ts `closeRun`**: triggers S-1200 + S-1210 batch, then S-1299 after run reaches COMPLETED
- **medical-exams.service.ts `createMedicalExam`**: triggers S-2220 after ASO persisted

All hooks are wrapped in `try/catch` — eSocial generation failures are logged but never propagate to fail the primary operation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript TS7022 implicit 'any' in esocial-xsd-validator.ts**

- **Found during:** Task 1 GREEN phase (tsc check)
- **Issue:** Variable `children` had recursive initializer causing implicit `any` type
- **Fix:** Renamed to `nodeChildren` with explicit type `HTMLCollectionOf<Element>`
- **Files modified:** `apps/backend/src/modules/esocial-events/esocial-xsd-validator.ts`
- **Commit:** abe3a487

**2. [Rule 1 - Bug] Wrong permission strings in routes**

- **Found during:** Task 2 GREEN phase
- **Issue:** Initially used `'payroll:manage'` / `'payroll:read'` — not valid in the project's `Permission` type union
- **Fix:** Changed to `'payroll-params:write'` / `'payroll-params:read'` matching payroll-runs.routes.ts pattern
- **Files modified:** `apps/backend/src/modules/esocial-events/esocial-events.routes.ts`
- **Commit:** 1f1dcd2c

**3. [Rule 1 - Bug] userId cast error in routes**

- **Found during:** Task 2 GREEN phase (tsc check)
- **Issue:** `(req as Record<string, unknown>).user` conversion failed TypeScript check
- **Fix:** Changed to `(req.user as { userId?: string } | undefined)?.userId ?? 'system'`
- **Files modified:** `apps/backend/src/modules/esocial-events/esocial-events.routes.ts`
- **Commit:** 1f1dcd2c

### Out-of-Scope Pre-existing Issues (Deferred)

Pre-existing TypeScript errors discovered in unrelated files during tsc run (not caused by this plan):

- `apps/backend/src/modules/employees/employees.service.ts`: `listEmployees` — TS error in unrelated filter logic
- `apps/backend/src/modules/epi-deliveries/epi-deliveries.service.ts`: pre-existing type mismatch
- `apps/backend/src/modules/employee-movements/employee-movements.routes.spec.ts`: pre-existing test type error

These are out of scope per deviation rules — documented in `deferred-items.md` for follow-up.

## Test Coverage

| File                                                     | Tests  | Status          |
| -------------------------------------------------------- | ------ | --------------- |
| `esocial-events.spec.ts` (builders/validators/XSD)       | 47     | All passing     |
| `esocial-events.service.spec.ts` (service/state machine) | 15     | All passing     |
| **Total**                                                | **62** | **All passing** |

Key test scenarios:

- All 15 builders produce well-formed XML with correct namespace
- S-2200 builder correctly formats CPF (11 digits), PIS (11 digits), CBO (6 digits), salary (2 decimals)
- Pre-gen validator rejects missing PIS/PASEP, missing CBO, zero salary, missing CPF
- XSD validator blocks download for missing required elements (cpfTrab, nisTrab)
- Service creates PENDENTE record on generate, transitions to EXPORTADO on valid download
- Service returns inline XSD errors without status transition on invalid download
- State machine rejects invalid transitions (PENDENTE→ACEITO throws)
- Reprocess creates version+1 record; non-REJEITADO event throws
- S-1299 guard blocks generation when S-1200/S-1210 still PENDENTE for same period
- Dashboard returns grouped counts by status and EsocialGroup
- listEvents filters by group and status correctly

## Known Stubs

None — all 62 tests pass against real implementations. The builders produce actual XML output, not placeholder strings. The XSD validator navigates real DOM nodes.

## Self-Check: PASSED

Files exist:

- `apps/backend/src/modules/esocial-events/esocial-builders/s2200-builder.ts` — FOUND
- `apps/backend/src/modules/esocial-events/esocial-events.service.ts` — FOUND
- `apps/backend/src/modules/esocial-events/esocial-events.routes.ts` — FOUND
- `apps/backend/src/modules/esocial-events/esocial-xsd-validator.ts` — FOUND
- `apps/backend/src/modules/esocial-events/xsd-constraints.ts` — FOUND

Commits exist:

- e01c9cce — FOUND (test RED builders/validators/XSD)
- abe3a487 — FOUND (feat GREEN builders/validators/XSD)
- 26d639c8 — FOUND (test RED service)
- 1f1dcd2c — FOUND (feat GREEN service+routes)
- e9a711d5 — FOUND (feat auto-trigger hooks)
