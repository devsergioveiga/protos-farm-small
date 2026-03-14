# US-107 — Dashboard sanitário do rebanho

## CAs implementados: CA1-CA6 (todos)

### CA1 — Indicadores principais

- % cobertura vacinal (animais com vacinação nos últimos 12 meses)
- Animais em tratamento (TherapeuticTreatment OPEN/IN_PROGRESS)
- Animais em carência (withdrawalEndDate > hoje)
- Campanhas ativas (SanitaryProtocol ACTIVE)
- Exames pendentes resultado
- Regulatórios vencidos

### CA2 — Lista de animais com pendências

- IN_TREATMENT: animais com tratamento aberto
- PENDING_BOOSTER: vacinação com nextDoseDate vencida
- IN_WITHDRAWAL: animais em período de carência
- Tabela com brinco, animal, lote, tipo pendência, detalhe
- Limite visual de 50 itens (CSV completo)

### CA3 — Custo sanitário acumulado

- Por categoria animal (totalCostCents de TherapeuticTreatment)
- Por lote (mesmo)
- Formatação em R$ no frontend

### CA4 — Gráficos de incidência

- Doenças diagnosticadas: agrupamento por mês + doença (6 meses)
- Procedimentos: vacinações + vermifugações por mês (6 meses)
- Visualização em barras horizontais (sem dependência de chart lib)

### CA5 — Filtros

- Por categoria animal (select)
- farmId via seletor de fazenda (FarmContext)
- Suporte a lotId no backend (preparado para filtro futuro)

### CA6 — Exportação

- CSV com indicadores + lista de pendências + custos
- Endpoint: `GET /org/farms/:farmId/sanitary-dashboard/export`
- Botão "Exportar CSV" no frontend

## Estrutura

### Backend

- Módulo: `modules/sanitary-dashboard/` (types, service, routes, spec)
- 3 endpoints: org dashboard, farm dashboard, CSV export
- 5 testes

### Frontend

- Tipos: `types/sanitary-dashboard.ts`
- Hook: `hooks/useSanitaryDashboard.ts`
- Página: `pages/SanitaryDashboardPage.tsx`
- Sidebar: Activity icon no grupo REBANHO
- Rota: `/sanitary-dashboard`
