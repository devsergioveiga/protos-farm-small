# US-076 CA5 — Mapa de Calor de Incidência MIP

## O que foi feito

Implementado mapa de calor de incidência de pragas por talhão, permitindo visualizar a pressão de pragas em cada ponto de monitoramento.

## Backend

- **Novo endpoint:** `GET /org/farms/:farmId/field-plots/:fieldPlotId/monitoring-heatmap`
  - Filtros: `pestId`, `startDate`, `endDate`
  - Agrega registros por ponto de monitoramento
  - Retorna: coordenadas, intensidade média (0-1), nível máximo, contagem de registros, top 3 pragas
- **Tipos:** `HeatmapQuery`, `HeatmapPoint` em `monitoring-records.types.ts`
- **Testes:** 3 novos (total: 15 no módulo)

## Frontend

- **Nova página:** `MonitoringHeatmapPage` (`/farms/:farmId/plots/:fieldPlotId/monitoring-heatmap`)
  - Mapa Leaflet com imagem de satélite e contorno do talhão
  - CircleMarkers coloridos (verde→vermelho) por intensidade de infestação
  - Raio proporcional à intensidade média
  - Tooltip com código do ponto, nível máximo, contagem e pragas
  - Painel de filtros (praga, data início, data fim)
  - Legenda com escala de cores por nível de infestação
  - Cards de resumo por ponto abaixo do mapa
  - Empty state com CTA para registros
  - Responsivo (mobile-first)
- **Hook:** `useMonitoringHeatmap` para busca de dados
- **Link:** Botão "Mapa de calor" na página de pontos de monitoramento
- **Testes:** 8 (empty state, markers, plot name, legenda, cards, filtros, erro, back link)

## Arquivos

### Backend

- `apps/backend/src/modules/monitoring-records/monitoring-records.service.ts` (getMonitoringHeatmap)
- `apps/backend/src/modules/monitoring-records/monitoring-records.routes.ts` (nova rota)
- `apps/backend/src/modules/monitoring-records/monitoring-records.types.ts` (tipos heatmap)
- `apps/backend/src/modules/monitoring-records/monitoring-records.routes.spec.ts` (+3 testes)

### Frontend

- `apps/frontend/src/pages/MonitoringHeatmapPage.tsx`
- `apps/frontend/src/pages/MonitoringHeatmapPage.css`
- `apps/frontend/src/pages/MonitoringHeatmapPage.spec.tsx`
- `apps/frontend/src/hooks/useMonitoringHeatmap.ts`
- `apps/frontend/src/types/monitoring-record.ts` (tipos heatmap)
- `apps/frontend/src/App.tsx` (rota)
- `apps/frontend/src/pages/MonitoringPointsPage.tsx` (link)
