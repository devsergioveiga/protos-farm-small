---
status: complete
phase: 24-ativos-biol-gicos-leasing-e-features-avan-adas
source: [24-VERIFICATION.md]
started: 2026-03-23T14:30:00Z
updated: 2026-03-23T17:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Biological assets KPI cards with variation indicator
expected: KPI cards show latestTotalFairValue formatted as currency, variation with ArrowUp (green) or ArrowDown (red) icon + text — never color alone
result: pass

### 2. First valuation shows null variation
expected: First valuation for a group shows variation as null (dash or empty), not R$ 0,00
result: pass

### 3. Leasing status badges and lifecycle transitions
expected: Status badge with color + icon + text (WCAG AA); Exercer Opcao/Devolver/Cancelar buttons work with ConfirmModal
result: pass

### 4. Trade-in button in AssetDrawer
expected: "Trocar Ativo" button visible for ATIVO assets, hidden for ALIENADO/EM_ANDAMENTO
result: pass

### 5. Trade-in financial summary reactive calculation
expected: Resumo Financeiro updates reactively as values change; dueDate field only appears when netPayable > 0
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
