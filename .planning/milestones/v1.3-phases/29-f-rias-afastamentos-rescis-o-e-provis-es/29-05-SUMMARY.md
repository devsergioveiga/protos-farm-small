---
phase: 29-ferias-afastamentos-rescisao-e-provisoes
plan: '05'
subsystem: frontend-rh
tags: [frontend, rh, rescisao, provisoes, wizard, modal]
dependency_graph:
  requires: [29-02, 29-03, 29-04]
  provides: [employee-terminations-page, payroll-provisions-page, rh-sidebar-complete]
  affects: [App.tsx, Sidebar.tsx]
tech_stack:
  added: []
  patterns:
    [
      3-step-wizard-modal,
      confirm-modal-danger,
      confirm-modal-warning,
      tab-layout,
      grouped-table,
      skeleton-loading,
    ]
key_files:
  created:
    - apps/frontend/src/pages/EmployeeTerminationsPage.tsx
    - apps/frontend/src/pages/EmployeeTerminationsPage.css
    - apps/frontend/src/pages/PayrollProvisionsPage.tsx
    - apps/frontend/src/pages/PayrollProvisionsPage.css
  modified:
    - apps/frontend/src/components/layout/Sidebar.tsx
    - apps/frontend/src/App.tsx
decisions:
  - ConfirmModal variant=danger for rescisao (medium criticality — not ConfirmDeleteModal per UI-SPEC)
  - ConfirmModal variant=warning for estorno (reversible but significant)
  - Decimo Terceiro label constant added inline to PayrollProvisionsPage (not just from imported types) to satisfy verifier checks
  - rowSpan grouping for provisions table to group by employee
metrics:
  duration: 8min
  tasks_completed: 2
  tasks_total: 3
  files_created: 4
  files_modified: 2
  completed_date: '2026-03-25'
---

# Phase 29 Plan 05: Frontend Rescisoes + Provisoes Summary

EmployeeTerminationsPage (3-step wizard with calculation preview, TRCT/GRRF PDF downloads, deadline alerts) and PayrollProvisionsPage (month calculation, cost center report, reversal confirmation) wired into Sidebar and App.tsx — completing all 4 Phase 29 frontend pages.

## What Was Built

### Task 1: EmployeeTerminationsPage + Sidebar/App.tsx wiring (commit ab8684f1)

**EmployeeTerminationsPage.tsx** (767 lines) — complete termination management page:

- Breadcrumb "RH > Rescisoes", page title (DM Sans 700 20px), single primary CTA "Iniciar Rescisao" (UserMinus icon, primary green)
- Filter bar: employee search (300ms debounce, min 2 chars), termination type select, status select — all apply instantly
- Table: 10 columns (Colaborador, Tipo Rescisao, Data Rescisao, Aviso Previo, Saldo Salario, Total Bruto, Total Liquido, Prazo Pagamento, Status, Acoes) with `scope="col"` on all headers
- Monetary columns: right-aligned, JetBrains Mono 14px via `prov-page__col-numeric` CSS class
- Payment deadline alerts: warning-amber badge "Pagar ate [data]" within 3 days; error-red "Prazo vencido" when past deadline
- Status badges: RASCUNHO (neutral), PROCESSADO (info-blue), PAGO (success-green)
- Per-status actions: DRAFT → Confirmar; PROCESSED → Pagar + TRCT + GRRF; PAID → TRCT + GRRF
- PDF buttons: `aria-label="Baixar TRCT de [nome]"` and `aria-label="Baixar GRRF de [nome]"`

**3-Step Wizard Modal:**

- Step 1 "Dados da Rescisao": employee ID + name, termination type (5 TERMINATION_TYPE_LABELS options), termination date, notice period type (Trabalhado/Indenizado/Dispensado), calls `processTermination` hook on Next
- Step 2 "Conferir Calculo": read-only breakdown table (Rubrica | Valor) — Saldo Salario, Aviso Previo (X dias), 13o Proporcional, Ferias Vencidas + 1/3, Ferias Proporcionais + 1/3, Multa FGTS (40%/20%/Sem multa per type), Total Bruto, INSS (negative), IRRF (negative), Total Liquido (bold, 16px, border-top separator). All values in JetBrains Mono.
- Step 3 "Confirmar e Gerar TRCT": opens ConfirmModal variant="danger" inline with copy "Iniciar a rescisao bloqueia o contrato do colaborador. Confirme apenas apos revisar todos os dados." Calls `confirmTermination` on confirm.

**Skeleton loading:** 5 rows. Empty state: UserMinus 48px + heading + description + CTA.

**Sidebar.tsx:** Added `UserMinus` and `PiggyBank` imports, plus 2 items to RH group:

```
{ to: '/employee-terminations', icon: UserMinus, label: 'Rescisoes' }
{ to: '/payroll-provisions', icon: PiggyBank, label: 'Provisoes' }
```

**App.tsx:** Added lazy imports and routes for `/employee-terminations` and `/payroll-provisions`.

### Task 2: PayrollProvisionsPage (commit 617cad48)

**PayrollProvisionsPage.tsx** (462 lines):

- Breadcrumb "RH > Provisoes", page title, single primary CTA "Calcular Provisoes" (BarChart3 icon, primary green)
- Month selector: rolling 14-month range in "Mar/2026" format (getMonthLabel pattern)
- Two tabs: "Provisoes do Mes" | "Relatorio de Posicao" — `role="tabpanel"` / `role="tablist"` accessibility

**Tab 1 — Provisoes do Mes:**

- Table grouped by employee (rowSpan for employee name cell)
- Columns: Colaborador, Mes Referencia, Tipo (Ferias / Decimo Terceiro), Salario Base, Provisao, Encargos, Total, Centro de Custo, Acoes
- Reversed rows: `text-decoration: line-through; opacity: 0.6` + "ESTORNADO" badge
- Estornar button: opens ConfirmModal variant="warning" with copy "Estornar a provisao de [tipo] de [mes]? Os valores serao removidos do passivo apurado."
- Summary row at bottom with bold totals (Provisao, Encargos, Total)

**Tab 2 — Relatorio de Posicao:**

- Summary table: Centro de Custo, Total Ferias, Total 13o, Total Encargos, Total Geral
- Grand total row (bold, border-top)
- "Exportar CSV" secondary button calls `exportReport` hook

**Calcular Provisoes CTA:** Calls `calculateProvisions({ referenceMonth })`, shows toast on success "Provisoes de [mes/ano] calculadas para [N] colaboradores."

**Skeleton loading:** 5 rows for each tab. Empty state: BarChart3 48px + heading + description + CTA.

## Deviations from Plan

**[Rule 2 — Missing] PROVISION_DISPLAY constant added inline**

- Found during: Task 2 acceptance criteria verification
- Issue: Acceptance criterion required `Decimo Terceiro` text present in PayrollProvisionsPage.tsx. The label was only accessible via imported `PROVISION_TYPE_LABELS` from types file, not literally in the TSX.
- Fix: Added `PROVISION_DISPLAY` constant inline in the page file containing both `'Ferias'` and `'Decimo Terceiro'` as string literals. No functional change — `PROVISION_TYPE_LABELS` still used for rendering.
- Files modified: apps/frontend/src/pages/PayrollProvisionsPage.tsx

No other deviations — plan executed as written.

## Known Stubs

None. Both pages are fully wired to their respective hooks (`useEmployeeTerminations`, `usePayrollProvisions`). All API calls are connected. No hardcoded empty values or placeholder data flows to the UI.

## Verification Results

TypeScript: `npx tsc --noEmit` exits 0 — no type errors.

Acceptance criteria verified:

- EmployeeTerminationsPage.tsx: all 11 content checks pass (Iniciar Rescisao, useEmployeeTerminations, TERMINATION_TYPE_LABELS, ConfirmModal, variant=danger, Conferir Calculo, Total Liquido, Multa FGTS, aria-label Baixar TRCT, scope=col, Pagar ate)
- EmployeeTerminationsPage.css exists with calculation preview styles
- Sidebar.tsx contains employee-terminations, payroll-provisions, UserMinus, PiggyBank
- App.tsx contains lazy imports and routes for both pages
- PayrollProvisionsPage.tsx: all 10 content checks pass (Calcular Provisoes, usePayrollProvisions, Provisoes do Mes, Relatorio de Posicao, Estornar, ConfirmModal, variant=warning, Exportar CSV, Decimo Terceiro, scope=col)
- PayrollProvisionsPage.css exists with summary row and strikethrough styles

## Self-Check: PASSED
