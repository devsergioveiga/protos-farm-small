---
status: partial
phase: 41-sped-ecd-e-relat-rio-integrado
source: [41-VERIFICATION.md]
started: 2026-03-28T14:35:00Z
updated: 2026-03-28T14:35:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Visual inspection of SpedEcdPage in running browser

expected: Page loads at /sped-ecd with FileText icon, two tabs (SPED ECD / Relatorio Integrado), fiscal year selector; selecting FY triggers auto-validation; ValidationPanel shows ERROR/WARNING items with correct colors (red/amber) and correction links; Gerar SPED ECD button disabled when hasErrors=true; switching to Relatorio Integrado tab shows notes textarea with debounced save indicator; Gerar Relatorio PDF downloads a PDF with capa, indice, DRE, BP, DFC, notas explicativas sections with R$ formatting
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
