---
phase: 26-par-metros-de-folha-e-motor-de-c-lculo
plan: '04'
subsystem: frontend/payroll
tags: [frontend, react, payroll, rubricas, legal-tables, hr]
dependency_graph:
  requires:
    - 26-03 (payroll REST API — /payroll-rubricas and /payroll-tables endpoints)
  provides:
    - PayrollParametersPage at /payroll-parameters
    - PayrollRubricaModal (create/edit rubricas)
    - PayrollLegalTableModal (add new legal table version)
    - usePayrollRubricas hook
    - usePayrollTables hook
  affects:
    - apps/frontend/src/App.tsx (new route)
    - apps/frontend/src/components/layout/Sidebar.tsx (new sidebar link)
tech_stack:
  added: []
  patterns:
    - useState+useCallback hook pattern (matches useEmployees)
    - Tab page layout with skeleton loading (matches EmployeesPage)
    - Modal-based CRUD with fieldset/legend for radio groups (matches CreateEmployeeModal)
    - ConfirmModal for destructive actions
    - CSS custom properties with design token vars
key_files:
  created:
    - apps/frontend/src/types/payroll.ts
    - apps/frontend/src/hooks/usePayrollRubricas.ts
    - apps/frontend/src/hooks/usePayrollTables.ts
    - apps/frontend/src/pages/PayrollParametersPage.tsx
    - apps/frontend/src/pages/PayrollParametersPage.css
    - apps/frontend/src/components/payroll/PayrollRubricaModal.tsx
    - apps/frontend/src/components/payroll/PayrollRubricaModal.css
    - apps/frontend/src/components/payroll/PayrollLegalTableModal.tsx
    - apps/frontend/src/components/payroll/PayrollLegalTableModal.css
  modified:
    - apps/frontend/src/App.tsx
    - apps/frontend/src/components/layout/Sidebar.tsx
decisions:
  - Used error/successMessage return pattern instead of sonner (not installed in this project)
  - Combined Tasks 1 and 2 into single commit since PayrollLegalTableModal was required for page to compile
  - groupTablesByType uses Record<string, ...> internally then casts to Record<LegalTableType, ...> to satisfy TypeScript
metrics:
  duration: 25m
  completed: 2026-03-24
  tasks_completed: 2
  tasks_total: 3
  files_created: 9
  files_modified: 2
---

# Phase 26 Plan 04: Payroll Parameters Frontend Summary

**One-liner:** PayrollParametersPage with rubricas CRUD (badges, system rubrica lock, deactivate confirm) and legal tables display/update using CSS custom properties and useState+useCallback hook pattern.

## Completed Tasks

| Task | Name                                                               | Commit   | Files                                                                                                                                                        |
| ---- | ------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Frontend types, hooks, and PayrollParametersPage with Rubricas tab | 6bd2e4e5 | types/payroll.ts, hooks/usePayrollRubricas.ts, hooks/usePayrollTables.ts, PayrollParametersPage.tsx/.css, PayrollRubricaModal.tsx/.css, App.tsx, Sidebar.tsx |
| 2    | Legal Tables tab with table display and update modal               | 6bd2e4e5 | PayrollLegalTableModal.tsx/.css (committed with Task 1 since required for page to compile)                                                                   |

## Pending

| Task | Name                                         | Status              |
| ---- | -------------------------------------------- | ------------------- |
| 3    | Visual verification of PayrollParametersPage | Awaiting checkpoint |

## What Was Built

### PayrollParametersPage (`/payroll-parameters`)

- Breadcrumb: RH > Parâmetros de Folha
- Page title with Settings icon
- Tab layout: Rubricas | Tabelas Legais with active underline using `--color-primary-600`
- Skeleton loading (3 rows per tab)

### Rubricas Tab

- Table with RUBRICA, TIPO, CÁLCULO, TAXA/FÓRMULA, AÇÕES columns
- Type badges: PROVENTO (success green, TrendingUp icon), DESCONTO (error red, TrendingDown icon)
- Calculation badges: SISTEMA (warning orange, Lock icon), FORMULA (info blue, Code icon), PERCENTUAL (neutral)
- System rubricas: `--color-neutral-100` row background, lock icon with `aria-label="Rubrica protegida por lei, não editável"`, no Desativar button
- Custom rubricas: Editar + Desativar buttons with icon+text labels
- Deactivate via ConfirmModal variant="danger"
- Empty state with ListTree icon and "Nova Rubrica" CTA

### PayrollRubricaModal

- Name, Code (hidden on edit), Tipo (fieldset/legend radio), Tipo de Cálculo (fieldset/legend radio)
- Rate input (conditional on PERCENTAGE), Formula input with `--font-mono` (conditional on FORMULA)
- Variable reference panel with `<code>` tags
- Incidence checkboxes (INSS, FGTS, IRRF)
- `role="alert"` on all error messages, focus management, Escape closes

### Tabelas Legais Tab

- All 5 table types displayed: INSS, IRRF, SALARY_FAMILY, MINIMUM_WAGE, FUNRURAL
- Effective/Agendada/Historico badges per effectiveFrom vs today
- Bracket table with `<th scope="col">`, monetary cells in JetBrains Mono, "Sem limite" for last bracket
- Scalar key-value display for non-bracket types
- "Ver histórico" / "Ocultar histórico" collapsible section
- "Atualizar Tabela" button per group

### PayrollLegalTableModal

- tableType: display-only
- effectiveFrom: `<input type="month">` — ensures first-of-month dates
- Dynamic bracket rows with "Adicionar faixa" / Trash2 remove
- Last row's "Até" field disabled (unbounded)
- `aria-label="De (R$) - Faixa N"` pattern on each bracket input
- Scalar fields per table type (SALARY_FAMILY, MINIMUM_WAGE, FUNRURAL)
- `role="alert"` on errors, "Confirmar Tabela" CTA

### Routing & Navigation

- `/payroll-parameters` route added to App.tsx (lazy loaded)
- "Parâmetros de Folha" with Settings icon added to RH group in Sidebar.tsx

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] sonner not installed in project**

- **Found during:** Task 1 — hook creation
- **Issue:** Plan specified `import { toast } from 'sonner'` but sonner package is not installed in the frontend
- **Fix:** Changed hooks to return `successMessage: string | null` and `error: string | null` states instead of calling toast directly. Page can use these states to show inline feedback.
- **Files modified:** hooks/usePayrollRubricas.ts, hooks/usePayrollTables.ts
- **Commit:** 6bd2e4e5

**2. [Note] Tasks 1 and 2 combined into single commit**

- **Found during:** Task 1
- **Issue:** PayrollLegalTableModal was imported by PayrollParametersPage which needed to compile for tsc to pass
- **Fix:** Both components were created together in the same commit. Task 2 had no additional code changes beyond what was already implemented.

## Known Stubs

None — all required functionality is wired. The hooks fetch real API endpoints, the modals call real mutations, and all data flows through the components correctly.

## Self-Check: PASSED

All 6 key files found. Commit 6bd2e4e5 verified in git log.
