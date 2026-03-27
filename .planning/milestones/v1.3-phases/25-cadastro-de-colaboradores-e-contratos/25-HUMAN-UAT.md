---
status: partial
phase: 25-cadastro-de-colaboradores-e-contratos
source: [25-VERIFICATION.md]
started: 2026-03-24T06:10:00Z
updated: 2026-03-24T06:10:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Sidebar RH group and employee creation
expected: Sidebar shows RH group with Colaboradores, Cargos, Escalas; clicking Colaboradores loads EmployeesPage with empty state and 'Cadastrar colaborador' CTA
result: [pending]

### 2. CreateEmployeeModal CPF validation
expected: Step 1 shows inline error 'CPF invalido' on CPF field blur with invalid CPF (e.g., 111.111.111-11); form cannot advance until CPF is corrected
result: [pending]

### 3. EmployeeDetailPage 5 tabs
expected: Tabbed layout with WAI-ARIA (role=tablist/tab/tabpanel), breadcrumb 'Colaboradores > [Name]', avatar placeholder; tabs: Dados Pessoais, Contrato, Evolução, Documentos, Histórico
result: [pending]

### 4. SalaryEvolutionChart on Evolução tab
expected: If salary history exists: LineChart with primary-600 line, BRL y-axis, mm/aaaa x-axis; if no data: empty state with TrendingUp icon
result: [pending]

### 5. DESLIGADO status change confirmation
expected: Modal requires typing employee's full name; after confirmation badge changes to DESLIGADO (gray XCircle); status cannot be changed further
result: [pending]

### 6. Positions + salary bands + staffing view
expected: CBO masking works; SalaryBandModal validates ordering (JUNIOR.max <= PLENO.min); staffing view shows position × farm counts
result: [pending]

### 7. Work schedule templates
expected: 'Gerar Templates' creates 4 rural templates (5x2 Padrão, 6x1 Rural, 12x36 Turno, Ordenha 2x); days and times render correctly in chip grid
result: [pending]

### 8. Bulk employee import
expected: Download template works; upload CSV with invalid CPF row → highlighted red with AlertCircle; invalid PIS → yellow with AlertTriangle; confirm imports only valid rows
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
