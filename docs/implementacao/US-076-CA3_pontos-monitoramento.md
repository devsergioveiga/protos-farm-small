# US-076 CA3 — Pontos de Monitoramento Configuráveis por Talhão

## O que foi implementado

Pontos de monitoramento MIP configuráveis por talhão, com suporte a criação manual e geração automática em grade.

## Por que

O Manejo Integrado de Pragas (MIP) requer pontos de amostragem georreferenciados em cada talhão para que os registros de monitoramento (CA4) possam ser localizados espacialmente. Os pontos podem ser distribuídos em grid regular ou posicionados manualmente pelo agrônomo.

## Backend

### Modelo `MonitoringPoint`

- **Tabela:** `monitoring_points`
- **Campos:** id, farmId, fieldPlotId, code (único por talhão), latitude, longitude, notes, deletedAt, timestamps
- **RLS:** Isolamento via farm → organization
- **Migration:** `20260325100000_add_monitoring_points`

### Rotas

| Método | Rota                                                            | Permissão    | Descrição               |
| ------ | --------------------------------------------------------------- | ------------ | ----------------------- |
| POST   | `/org/farms/:farmId/monitoring-points`                          | farms:update | Criar ponto             |
| GET    | `/org/farms/:farmId/field-plots/:fieldPlotId/monitoring-points` | farms:read   | Listar pontos do talhão |
| GET    | `/org/farms/:farmId/monitoring-points/:pointId`                 | farms:read   | Detalhe do ponto        |
| PATCH  | `/org/farms/:farmId/monitoring-points/:pointId`                 | farms:update | Atualizar ponto         |
| DELETE | `/org/farms/:farmId/monitoring-points/:pointId`                 | farms:update | Soft delete             |
| POST   | `/org/farms/:farmId/monitoring-points/generate-grid`            | farms:update | Gerar grade automática  |

### Geração de Grade

- Usa PostGIS `ST_Contains` para verificar quais pontos do grid caem dentro do polígono do talhão
- Espaçamento configurável (5–500m)
- Limite de 200 pontos por geração
- Substitui pontos existentes (soft delete)

### Testes

- 14 testes de rota (supertest + jest mocks)

## Frontend

### Página `/farms/:farmId/plots/:fieldPlotId/monitoring-points`

- Tabela com código, coordenadas, observações
- Cards empilhados em mobile (<768px)
- Skeleton loading, empty state com CTA
- Botão "Gerar grade" com formulário de espaçamento
- CRUD via modal (MonitoringPointModal)
- Paginação, breadcrumb com link de volta ao mapa

### Acesso

- Link "Pontos de monitoramento MIP" no PlotDetailsPanel (painel de detalhes do talhão no mapa)
- Rota registrada em App.tsx

### Testes

- 8 testes (vitest + testing-library)

## Arquivos

### Backend

- `apps/backend/prisma/schema.prisma` — modelo MonitoringPoint
- `apps/backend/prisma/migrations/20260325100000_add_monitoring_points/migration.sql`
- `apps/backend/src/modules/monitoring-points/monitoring-points.types.ts`
- `apps/backend/src/modules/monitoring-points/monitoring-points.service.ts`
- `apps/backend/src/modules/monitoring-points/monitoring-points.routes.ts`
- `apps/backend/src/modules/monitoring-points/monitoring-points.routes.spec.ts`
- `apps/backend/src/app.ts` — registro do router

### Frontend

- `apps/frontend/src/types/monitoring-point.ts`
- `apps/frontend/src/hooks/useMonitoringPoints.ts`
- `apps/frontend/src/pages/MonitoringPointsPage.tsx` + `.css` + `.spec.tsx`
- `apps/frontend/src/components/monitoring-points/MonitoringPointModal.tsx` + `.css`
- `apps/frontend/src/components/map/PlotDetailsPanel.tsx` + `.css` — link MIP
- `apps/frontend/src/App.tsx` — rota
