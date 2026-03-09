# US-076 CA6 — Histórico de Evolução MIP

## O que foi feito

Implementação do histórico de evolução de infestação com gráfico temporal (Recharts) e tabela detalhada, permitindo acompanhar a pressão de pragas ao longo do tempo com filtros e agregação configurável.

## Por quê

O produtor precisa visualizar tendências de infestação ao longo do tempo para tomar decisões baseadas em dados — saber se uma praga está aumentando, estabilizando ou diminuindo. Complementa o mapa de calor (visão espacial) com a dimensão temporal.

## Backend

### Endpoint

`GET /org/farms/:farmId/field-plots/:fieldPlotId/monitoring-timeline`

### Query params

| Param         | Tipo                             | Descrição                                      |
| ------------- | -------------------------------- | ---------------------------------------------- |
| `pestIds`     | string                           | IDs separados por vírgula (filtro multi-praga) |
| `startDate`   | ISO date                         | Início do período                              |
| `endDate`     | ISO date                         | Fim do período                                 |
| `aggregation` | `daily` \| `weekly` \| `monthly` | Agrupamento temporal (default: `daily`)        |

### Resposta

```json
{
  "data": [
    {
      "date": "2026-03-01",
      "pests": [
        {
          "pestId": "...",
          "pestName": "Lagarta-da-soja",
          "avgIntensity": 0.45,
          "maxLevel": "MODERADO",
          "recordCount": 5
        }
      ]
    }
  ],
  "summary": {
    "totalRecords": 42,
    "dateRange": { "start": "2026-02-01", "end": "2026-03-09" },
    "pestsFound": ["Lagarta-da-soja", "Percevejo-marrom"]
  }
}
```

### Lógica de agregação

- **Diário:** agrupa por `YYYY-MM-DD`
- **Semanal:** agrupa pela segunda-feira da semana (ISO week)
- **Mensal:** agrupa por `YYYY-MM-01`
- Intensidade média usa `LEVEL_WEIGHT` (AUSENTE=0, BAIXO=0.25, MODERADO=0.5, ALTO=0.75, CRITICO=1)

### Arquivos modificados

- `monitoring-records.types.ts` — tipos `TimelineQuery`, `TimelinePestEntry`, `TimelineDataPoint`, `TimelineSummary`
- `monitoring-records.service.ts` — função `getMonitoringTimeline`
- `monitoring-records.routes.ts` — rota GET com middleware auth/permission/farm-access
- `monitoring-records.routes.spec.ts` — 7 testes novos (22 total)

## Frontend

### Página

`MonitoringTimelinePage` em `/farms/:farmId/plots/:fieldPlotId/monitoring-timeline`

### Funcionalidades

- **Gráfico Recharts:** LineChart com uma linha por praga (cores distintas), eixo Y com labels de nível (Ausente → Crítico)
- **Filtros:** dropdown multi-select de pragas (checkboxes), período (date inputs), toggle de agregação (Diário/Semanal/Mensal)
- **Summary cards:** total de registros, período, pragas encontradas
- **Tabela detalhada:** dados com colunas Data/Praga/Intensidade/Nível/Registros
- **Responsivo:** tabela em desktop → cards empilhados em mobile
- **Empty state:** ícone + mensagem + link para registros
- **Loading:** skeleton screens

### Navegação

- Link "Histórico" com ícone TrendingUp adicionado na MonitoringPointsPage (ao lado de "Mapa de calor" e "Registros MIP")
- Breadcrumb com link de volta para pontos de monitoramento

### Arquivos criados/modificados

- `pages/MonitoringTimelinePage.tsx` — componente da página
- `pages/MonitoringTimelinePage.css` — estilos BEM com prefixo `mtp__`
- `pages/MonitoringTimelinePage.spec.tsx` — 10 testes
- `hooks/useMonitoringTimeline.ts` — hook de dados
- `types/monitoring-record.ts` — tipos Timeline\*
- `App.tsx` — rota lazy-loaded
- `pages/MonitoringPointsPage.tsx` — link de navegação

## Testes

- **Backend:** 7 novos testes (agregação daily/weekly/monthly, filtros pestIds e date range, auth 401)
- **Frontend:** 10 testes (skeleton, empty state, chart, summary cards, tabela, filtros, agregação, erro, navegação)
