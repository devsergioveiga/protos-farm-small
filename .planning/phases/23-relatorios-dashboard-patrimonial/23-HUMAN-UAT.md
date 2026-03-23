---
status: partial
phase: 23-relatorios-dashboard-patrimonial
source: [23-VERIFICATION.md]
started: 2026-03-23T13:37:00Z
updated: 2026-03-23T13:37:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Visual inspection of AssetReportsPage 3 tabs
expected: Inventario tab shows KPI cards (Valor Bruto, Depr Acumulada, Valor Liquido, Qtd Ativos) and classification table. Depreciacao tab shows ComposedChart with horizon selector (12/36/60 months). TCO tab shows fleet table with OK/Monitorar/Substituir/Sem dados badges.
result: [pending]

### 2. PDF/Excel/CSV export triggers file download
expected: Clicking PDF, Excel, or CSV export buttons initiates a browser download of the report file.
result: [pending]

### 3. CostCenterWizardModal wizard navigation and POST
expected: Clicking 'Criar Centro de Custo' in the header opens the 4-step wizard. Step 1 shows 5 asset-type cards. Step 4 submits to backend and closes modal on success.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
