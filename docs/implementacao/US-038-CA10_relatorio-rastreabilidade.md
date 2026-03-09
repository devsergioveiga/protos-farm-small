# US-038 CA10 — Relatório e Rastreabilidade

## O que foi implementado

Exportação CSV de aplicações de defensivos com todos os campos para rastreabilidade e auditoria. Filtros por data, talhão e produto.

## Por que

Auditoria e rastreabilidade exigem relatórios exportáveis com todos os dados de cada aplicação (produto, dose, condições, receituário, carência).

## Alterações

### Backend

- **Service**: `getApplicationsReport()` busca aplicações com filtros (dateFrom, dateTo, fieldPlotId, productName)
- **Service**: `applicationsToCsv()` gera CSV com 27 colunas incluindo BOM UTF-8
- **Route**: `GET /farms/:farmId/pesticide-applications/report/export` retorna CSV com Content-Disposition

### Frontend

- Botão "Exportar CSV" no header da página, abre download via window.open
- Passa filtro de busca ativo como productName

### Testes

- Backend: 2 testes (CSV headers + filtros passados ao service)
- Frontend: teste "should have export CSV button"
