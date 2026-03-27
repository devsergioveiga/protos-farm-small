# Phase 33: Wire Employee Data to Safety Pages - Research

**Researched:** 2026-03-26
**Domain:** Frontend data wiring — React hooks, API integration, TypeScript types
**Confidence:** HIGH

---

## Summary

Phase 33 is a pure frontend wiring phase. Both `TrainingRecordsPage` and `MedicalExamsPage` already have fully functioning modal components (`TrainingRecordModal`, `MedicalExamModal`) that accept an `employees` prop. That prop is currently satisfied by a `const MOCK_EMPLOYEES = []` stub — an empty array — meaning the participant/ASO selection steps are rendered but no actual employees appear. The fix is to replace those stubs with real data fetched from the existing `/org/:orgId/employees` endpoint via the existing `useEmployees` hook.

The only non-trivial decision is the shape mismatch between what the `listEmployees` API response provides and what the modals expect. The list response returns employees with `farms[0].position.name` (nested) and no `asoPeriodicityMonths`. The modals need a flat `{ id, name, positionName: string | null }` for training, and `{ id, name, positionName: string | null, asoPeriodicityMonths: number | null }` for medical exams. This shape transformation must happen in the page component (or a thin selector hook), and `asoPeriodicityMonths` needs to be added to the `listEmployees` position select in the backend.

The scope is narrow: one backend select-field addition, one frontend hook call per page, two inline data mappings. No new database migrations, no new endpoints, no schema changes.

**Primary recommendation:** Add `asoPeriodicityMonths` to the position select in `listEmployees`, call `useEmployees({ status: 'ATIVO', limit: 200 })` in each page, map the nested response shape to the flat shape the modals expect.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEGUR-02 | Técnico pode gerenciar treinamentos obrigatórios NR-31 com registro de data, CH, instrutor e lista de presença — requires employee multi-select to work with real data | The `TrainingRecordModal` Step 2 participant list reads from `employees` prop; replacing `MOCK_EMPLOYEES` with real data enables E2E training record creation |
| SEGUR-03 | Gerente pode controlar ASOs com registro de médico, resultado, exames — requires real employee combobox for ASO creation | The `MedicalExamModal` employee combobox reads from `employees` prop and uses `asoPeriodicityMonths` for auto-calculating next exam date; real data makes this functional |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **Backend module pattern:** `modules/{domain}/controller+service+routes+types`
- **Express 5 params:** always `req.params.id as string`, never destructure without cast
- **Prisma select field names:** verify exact field names in `schema.prisma` before writing queries
- **Frontend hooks:** `useState+useCallback` pattern matching `useAnimals`/`useEmployees` — no SWR
- **Frontend types:** types in `src/types/` must mirror backend response shapes
- **Null vs undefined:** Prisma uses `null` for optional DB fields; frontend input interfaces use `undefined`
- **No `any`:** everything typed explicitly
- **Confirmations:** never `window.confirm()` — use `ConfirmModal`
- **Styling:** CSS custom properties via `var(--color-*)`, never hardcoded hex
- **Touch targets:** minimum 48x48px
- **Fonts:** DM Sans headlines, Source Sans 3 body — never Inter/Roboto
- **Phase 30 decision:** Training routes use `employees:read`/`employees:manage` permission strings
- **Phase 25 decision:** Frontend hooks follow `useState+useCallback` (no SWR), matching `useAnimals` pattern
- **Phase 25 decision:** HR endpoints use `farms:read` permission (hr module not yet in PermissionModule)

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.x | UI components | Project standard |
| TypeScript | 5.x | Type safety | Project standard |
| Vitest | current | Unit tests | Project standard (frontend) |
| @testing-library/react | current | Component tests | Project standard |

### Already Available (No New Installs)
| Hook/Module | Location | Purpose |
|-------------|----------|---------|
| `useEmployees` | `src/hooks/useEmployees.ts` | Fetches `/org/:orgId/employees` with status/search/limit params |
| `useAuth` | `src/stores/AuthContext` | Provides `user.organizationId` (used internally by `useEmployees`) |
| `TrainingRecordModal` | `src/components/training-records/TrainingRecordModal.tsx` | Accepts `employees: { id, name, positionName }[]` prop |
| `MedicalExamModal` | `src/components/medical-exams/MedicalExamModal.tsx` | Accepts `employees: { id, name, positionName, asoPeriodicityMonths? }[]` prop |

**No new npm packages required.**

---

## Architecture Patterns

### Pattern 1: useEmployees Hook Call (existing pattern)

The hook already handles `orgId` extraction from auth context internally. Callers just pass params:

```typescript
// Source: apps/frontend/src/hooks/useEmployees.ts (verified)
const { employees, isLoading } = useEmployees({ status: 'ATIVO', limit: 200 });
```

The hook signature accepts these optional params: `search`, `status`, `contractType`, `farmId`, `positionId`, `page`, `limit`, `sortBy`, `sortOrder`.

**`status: 'ATIVO'` filter is important:** Safety pages should only show active employees in selection dropdowns, not terminated/on-leave employees. `limit: 200` is a safe upper bound for small farms — avoids pagination complexity in the selector.

### Pattern 2: Response Shape Mapping (inline in page)

The `listEmployees` response shape for each employee:

```typescript
// What the API actually returns (verified in employees.service.ts listEmployees select)
{
  id: string,
  name: string,
  cpf: string,
  status: string,
  photoUrl: string | null,
  admissionDate: Date,
  farms: [{
    id: string,
    farm: { id: string, name: string },
    position: { id: string, name: string } | null,
  }]
}
```

The modals need:

```typescript
// TrainingRecordModal expects
{ id: string, name: string, positionName: string | null }

// MedicalExamModal expects
{ id: string, name: string, positionName: string | null, asoPeriodicityMonths: number | null }
```

The mapping happens in the page component with `useMemo`:

```typescript
// Source: pattern derived from existing EmployeesPage.tsx line 242 (verified)
const employeeOptions = useMemo(
  () =>
    employees.map((emp) => ({
      id: emp.id,
      name: emp.name,
      positionName: emp.farms?.[0]?.position?.name ?? null,
    })),
  [employees],
);
```

For `MedicalExamModal`, `asoPeriodicityMonths` is NOT in the current `listEmployees` response — the position select in `listEmployees` only fetches `{ id, name }`. This requires adding `asoPeriodicityMonths` to the backend select. See "Backend Change Required" below.

### Pattern 3: Backend Position Select Extension

In `employees.service.ts`, `listEmployees` has this select for the farms relation:

```typescript
// Current (verified in employees.service.ts lines 213-223)
farms: {
  where: { endDate: null },
  select: {
    id: true,
    farm: { select: { id: true, name: true } },
    position: { select: { id: true, name: true } },
  },
  take: 1,
},
```

Must add `asoPeriodicityMonths: true` to the position select:

```typescript
// After change
position: { select: { id: true, name: true, asoPeriodicityMonths: true } },
```

This is a non-breaking additive change — no migration needed (field already exists in schema, `@default(12)`).

### Pattern 4: Page-Level Loading State

Both pages already handle `loading`/`error` from their own hooks. The employee loading is secondary — show employees as they arrive (no hard gate). The modal already handles the empty-list case with "Nenhum colaborador encontrado." in both components.

```typescript
// Pattern: isLoading from useEmployees is separate from the page's main loading state
// No need to block page render waiting for employees — pass empty array until loaded
const { employees, isLoading: employeesLoading } = useEmployees({ status: 'ATIVO', limit: 200 });
// Pass employees directly — modal shows empty state gracefully while loading
```

### Recommended Project Structure (no changes needed)
```
apps/frontend/src/
├── pages/
│   ├── TrainingRecordsPage.tsx   # Remove MOCK_EMPLOYEES, add useEmployees call
│   └── MedicalExamsPage.tsx      # Remove MOCK_EMPLOYEES, add useEmployees call
├── hooks/
│   └── useEmployees.ts           # No changes needed
apps/backend/src/modules/employees/
└── employees.service.ts          # Add asoPeriodicityMonths to listEmployees position select
```

### Anti-Patterns to Avoid

- **Do not create a new `/employees/for-select` endpoint.** The existing `listEmployees` with `status=ATIVO&limit=200` is sufficient for farm-scale operations.
- **Do not add employee loading state as a blocker.** Both modals gracefully handle an empty list; no UX benefit to blocking the "Registrar" button until employees load.
- **Do not use `React.useEffect` to set derived state from employees.** Use `useMemo` for the shape mapping instead.
- **Do not filter out terminated employees in the frontend.** Use `status: 'ATIVO'` query param so the API does it server-side.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Employee fetching | Custom fetch logic | `useEmployees` hook (already exists) | Already handles auth, org scoping, error state, pagination |
| Employee search/filter | Client-side search over all employees | `useEmployees({ search })` param | Server handles search; already built |
| Position name resolution | Extra API call to `/positions/:id` | Already in `farms[0].position.name` in list response | Included in the join, no extra round trip |

---

## Common Pitfalls

### Pitfall 1: `asoPeriodicityMonths` Missing from List Response
**What goes wrong:** `MedicalExamModal` calls `emp?.asoPeriodicityMonths ?? 12` to auto-calculate next exam date. If the field is not in the response, it always falls back to 12 months for every employee, making the auto-calculation silently wrong for employees in positions with non-12-month periodicities.
**Why it happens:** `listEmployees` position select only has `{ id, name }` — `asoPeriodicityMonths` is not included.
**How to avoid:** Add `asoPeriodicityMonths: true` to the position select in `listEmployees` before the frontend change. One-line backend fix.
**Warning signs:** Next exam date always shows exactly 12 months after exam date regardless of position.

### Pitfall 2: Shape Mismatch TypeScript Error
**What goes wrong:** TypeScript will reject `employees` from `useEmployees` directly as the modal's `employees` prop because `Employee` type has no flat `positionName` field — it has `farms?: EmployeeFarm[]` with nested `position`.
**Why it happens:** The `Employee` type in `src/types/employee.ts` is shaped for the detail response. The list endpoint returns a subset. The modals define their own `interface Employee` inline.
**How to avoid:** Use `useMemo` to map `employees` → `employeeOptions` with the flat shape before passing to the modal prop.
**Warning signs:** TypeScript error on the `employees={employees}` prop line.

### Pitfall 3: DESLIGADO Employees in Selector
**What goes wrong:** Terminated employees appear in the training/ASO participant selectors, confusing users and creating records for people no longer at the farm.
**Why it happens:** `useEmployees()` with no `status` param returns all statuses.
**How to avoid:** Always pass `status: 'ATIVO'` to `useEmployees`. Note: if a workflow requires registering training for employees on leave (AFASTADO), this can be relaxed later — ATIVO is the conservative default.
**Warning signs:** Terminated employees appear in the dropdown.

### Pitfall 4: Express 5 Param Cast
**What goes wrong:** TypeScript error when reading `req.params.orgId` in the backend if added.
**Why it happens:** Express 5 `req.params` returns `string | string[]`.
**How to avoid:** Always cast: `req.params.orgId as string`. (No new routes are being added in this phase, so this pitfall is only relevant if a new endpoint is created.)

---

## Code Examples

### TrainingRecordsPage: Replacing MOCK_EMPLOYEES
```typescript
// Source: verified pattern from useEmployees.ts + TrainingRecordModal.tsx
import { useMemo } from 'react';
import { useEmployees } from '@/hooks/useEmployees';

// Inside component:
const { employees } = useEmployees({ status: 'ATIVO', limit: 200 });

const employeeOptions = useMemo(
  () =>
    employees.map((emp) => ({
      id: emp.id,
      name: emp.name,
      positionName: emp.farms?.[0]?.position?.name ?? null,
    })),
  [employees],
);

// Remove: const MOCK_EMPLOYEES = [];
// Change: <TrainingRecordModal employees={MOCK_EMPLOYEES} ... />
// To:     <TrainingRecordModal employees={employeeOptions} ... />
```

### MedicalExamsPage: Replacing MOCK_EMPLOYEES
```typescript
// Source: verified pattern from useEmployees.ts + MedicalExamModal.tsx
import { useMemo } from 'react';
import { useEmployees } from '@/hooks/useEmployees';

// Inside component:
const { employees } = useEmployees({ status: 'ATIVO', limit: 200 });

const employeeOptions = useMemo(
  () =>
    employees.map((emp) => ({
      id: emp.id,
      name: emp.name,
      positionName: emp.farms?.[0]?.position?.name ?? null,
      asoPeriodicityMonths: emp.farms?.[0]?.position?.asoPeriodicityMonths ?? null,
    })),
  [employees],
);

// Remove: const MOCK_EMPLOYEES = [];
// Change: <MedicalExamModal employees={MOCK_EMPLOYEES} ... />
// To:     <MedicalExamModal employees={employeeOptions} ... />
```

### Backend: Add asoPeriodicityMonths to listEmployees Select
```typescript
// Source: apps/backend/src/modules/employees/employees.service.ts lines 213-223 (verified)
// Change position select from:
position: { select: { id: true, name: true } },
// To:
position: { select: { id: true, name: true, asoPeriodicityMonths: true } },
```

### Employee Type Extension for asoPeriodicityMonths
```typescript
// Source: apps/frontend/src/types/employee.ts (verified — EmployeeFarm interface)
// Current EmployeeFarm:
export interface EmployeeFarm {
  id: string;
  farmId: string;
  positionId?: string;
  startDate: string;
  endDate?: string;
  status: string;
  farm?: { name: string };
  position?: { name: string };  // <-- needs asoPeriodicityMonths added
}

// After:
position?: { name: string; asoPeriodicityMonths?: number };
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| MOCK_EMPLOYEES = [] | useEmployees({ status: 'ATIVO', limit: 200 }) | This phase makes the switch |
| asoPeriodicityMonths hardcoded at 12 | fetched from position.asoPeriodicityMonths | Requires backend select extension |

**No deprecated APIs involved.** This phase touches only existing, current code.

---

## Open Questions

1. **Should AFASTADO employees be included in the safety page selectors?**
   - What we know: Employees on leave (AFASTADO) are technically still contracted and might need training record or ASO registration (e.g., return-to-work ASO is required)
   - What's unclear: Whether the product owner wants to include AFASTADO in the safety selectors
   - Recommendation: Start with `status: 'ATIVO'` only, add `AFASTADO` if user reports the need. The backend filter supports multi-value in the future.

2. **Should employee loading show a disabled state on the modal CTA?**
   - What we know: Both modals handle `employees=[]` gracefully with "Nenhum colaborador encontrado."
   - What's unclear: Whether a brief empty-list flash during load is acceptable UX or should be masked
   - Recommendation: No blocking needed — the empty state message is sufficient for the few hundred milliseconds it takes to load. The modal is only opened by explicit user action, by which time employees are already loaded (both fetches start at component mount).

---

## Environment Availability

Step 2.6: SKIPPED — this phase is code/config-only changes with no new external dependencies. All required tools (Node, pnpm, Vitest, TypeScript) are already in use on the current branch.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Config file | `apps/frontend/vitest.config.ts` |
| Quick run command | `pnpm --filter @protos-farm/frontend test` |
| Full suite command | `pnpm --filter @protos-farm/frontend test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEGUR-02 | TrainingRecordModal renders real employees in participant list | unit | `pnpm --filter @protos-farm/frontend test -- --reporter=verbose` | ❌ Wave 0 |
| SEGUR-02 | TrainingRecordModal step 2 shows employee name and position | unit | same | ❌ Wave 0 |
| SEGUR-03 | MedicalExamModal renders real employees in combobox dropdown | unit | same | ❌ Wave 0 |
| SEGUR-03 | MedicalExamModal auto-calculates nextExamDate from asoPeriodicityMonths | unit | same | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @protos-farm/frontend test`
- **Per wave merge:** `pnpm --filter @protos-farm/frontend test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/frontend/src/pages/TrainingRecordsPage.spec.tsx` — covers SEGUR-02 (renders real employees in modal)
- [ ] `apps/frontend/src/pages/MedicalExamsPage.spec.tsx` — covers SEGUR-03 (renders real employees in modal, asoPeriodicityMonths auto-calc)

*(Existing test infrastructure — vitest.config.ts, jsdom, @testing-library/react — covers all phase requirements. Only test files are missing.)*

---

## Sources

### Primary (HIGH confidence)
- Verified directly from source: `apps/frontend/src/pages/TrainingRecordsPage.tsx` — MOCK_EMPLOYEES stub location confirmed at line 34
- Verified directly from source: `apps/frontend/src/pages/MedicalExamsPage.tsx` — MOCK_EMPLOYEES stub location confirmed at line 67-72
- Verified directly from source: `apps/frontend/src/hooks/useEmployees.ts` — full hook signature confirmed
- Verified directly from source: `apps/frontend/src/types/employee.ts` — EmployeeFarm.position shape confirmed as `{ name: string }` only
- Verified directly from source: `apps/backend/src/modules/employees/employees.service.ts` — listEmployees position select confirmed as `{ id: true, name: true }` (no asoPeriodicityMonths)
- Verified directly from source: `apps/backend/prisma/schema.prisma` line 7793 — `asoPeriodicityMonths Int @default(12)` on Position model confirmed

### Secondary (MEDIUM confidence)
- Pattern inference: `useMemo` for shape mapping is consistent with the React 19 hooks pattern already used throughout this codebase (e.g., EmployeesPage.tsx line 242 for position name access)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all code verified from source files
- Architecture: HIGH — all patterns verified from existing code; no new libraries
- Pitfalls: HIGH — shape mismatch and missing field verified directly from source

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable — no external dependencies, no fast-moving APIs)
