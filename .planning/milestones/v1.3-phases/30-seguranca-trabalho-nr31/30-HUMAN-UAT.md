---
status: partial
phase: 30-seguranca-trabalho-nr31
source: [30-VERIFICATION.md]
started: 2026-03-26T00:00:00Z
updated: 2026-03-26T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Sidebar SEGURANÇA group

expected: Sidebar mostra SEGURANÇA com 6 itens: EPIs, Entregas EPI, Treinamentos, Registros de Treinamento, ASOs, Dashboard NR-31
result: [pending]

### 2. EPI product CRUD with CA validation

expected: Formulário salva, lista atualiza, badge de status CA aparece conforme data de validade
result: [pending]

### 3. EPI delivery with stock deduction

expected: Toast 'Entrega registrada. Estoque atualizado automaticamente.' aparece; saldo decresce
result: [pending]

### 4. Collective training + certificate PDF

expected: PDF gerado com nome do colaborador, tipo de treinamento, data, e validade calculada
result: [pending]

### 5. ASO INAPTO banner

expected: Banner amarelo aparece dentro do modal com texto 'Colaborador inapto para trabalho'
result: [pending]

### 6. Safety dashboard KPIs and tabs

expected: Cards mostram Total, Conformes, Com pendências, Vencimentos 30 dias; 4 abas visíveis
result: [pending]

### 7. Dashboard CSV export

expected: Download de arquivo conformidade-nr31-YYYY-MM-DD.csv disparado
result: [pending]

### 8. Backend tests pass

expected: npx jest --testPathPattern='epi|training|medical|safety' --no-coverage — 82+ testes passam
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
