# US-076 CA9 — Relatório MIP para Certificadoras e Auditorias

## O que foi implementado

Endpoint e página para geração de relatórios de Monitoramento Integrado de Pragas (MIP) voltado para certificadoras e auditorias agrícolas.

## Por que

Certificadoras e auditorias exigem documentação formal do programa de MIP, incluindo:

- Evidência de monitoramento sistemático (pontos, frequência, cobertura)
- Registro das pragas detectadas com nome científico e classificação
- Justificativa técnica para decisões de controle (NDE/NC)
- Evidência de uso de inimigos naturais (controle biológico)
- Rastreabilidade temporal (evolução semanal de infestação)

## Decisões técnicas

### Backend

- **Endpoint farm-level** (`GET /org/farms/:farmId/monitoring-report`): o relatório agrega dados de TODOS os talhões da fazenda, pois a certificação é por propriedade, não por talhão
- **Período padrão de 90 dias**: caso não informado, evita relatórios vazios
- **Agregação semanal**: timeline usa buckets semanais para suavizar dados e mostrar tendências
- **Decisões de controle automáticas**: detecta semanas onde infestação ultrapassou o NC configurado na biblioteca de pragas
- **Excel multi-abas**: Resumo, Pragas Monitoradas, Decisões de Controle, Evolução Temporal — formato padrão para auditorias
- **Filtro por talhões** (`fieldPlotIds`): permite gerar relatório parcial

### Frontend

- **Página no nível da fazenda** (`/farms/:farmId/monitoring-report`): acessível pelo painel da fazenda
- **Geração sob demanda**: o relatório não é pré-gerado, o usuário escolhe o período e clica "Gerar"
- **Análise expandível por praga**: cada praga tem um card colapsável com timeline visual, NDE/NC, e decisões de controle
- **Download Excel**: usa fetch + blob para download autenticado

## Arquivos criados

### Backend

- `apps/backend/src/modules/monitoring-reports/monitoring-reports.types.ts`
- `apps/backend/src/modules/monitoring-reports/monitoring-reports.service.ts`
- `apps/backend/src/modules/monitoring-reports/monitoring-reports.routes.ts`
- `apps/backend/src/modules/monitoring-reports/monitoring-reports.routes.spec.ts` (10 testes)

### Frontend

- `apps/frontend/src/types/monitoring-report.ts`
- `apps/frontend/src/hooks/useMonitoringReport.ts`
- `apps/frontend/src/pages/MonitoringReportPage.tsx`
- `apps/frontend/src/pages/MonitoringReportPage.css`
- `apps/frontend/src/pages/MonitoringReportPage.spec.tsx` (11 testes)

### Modificados

- `apps/backend/src/app.ts` — registro do monitoringReportsRouter
- `apps/frontend/src/App.tsx` — rota `/farms/:farmId/monitoring-report`

## Endpoints

| Método | Rota                                             | Descrição                      |
| ------ | ------------------------------------------------ | ------------------------------ |
| GET    | `/api/org/farms/:farmId/monitoring-report`       | Relatório MIP em JSON          |
| GET    | `/api/org/farms/:farmId/monitoring-report/excel` | Relatório MIP em Excel (.xlsx) |

**Query params:** `startDate`, `endDate`, `fieldPlotIds` (comma-separated)
