# US-076 CA4 — Registro de Monitoramento por Ponto

## O que foi implementado

Módulo completo de registro de observações de pragas e doenças nos pontos de monitoramento MIP, conectando a biblioteca de pragas (CA1-CA2) com os pontos configuráveis (CA3).

## Por que

O registro por ponto é o fluxo operacional central do MIP: o técnico vai ao campo, visita cada ponto de monitoramento e registra quais pragas encontrou, em que nível de infestação, estádio fenológico da cultura e presença de inimigos naturais. Esses dados alimentarão o mapa de calor (CA5) e as recomendações automáticas (CA7).

## Modelo de dados

### MonitoringRecord

| Campo              | Tipo                 | Descrição                               |
| ------------------ | -------------------- | --------------------------------------- |
| monitoringPointId  | FK → MonitoringPoint | Ponto onde foi feita a observação       |
| pestId             | FK → Pest            | Praga/doença observada                  |
| observedAt         | DateTime             | Data/hora da observação                 |
| infestationLevel   | Enum                 | AUSENTE, BAIXO, MODERADO, ALTO, CRITICO |
| sampleCount        | Int?                 | Quantidade de amostras coletadas        |
| pestCount          | Int?                 | Contagem de indivíduos                  |
| growthStage        | String?              | Estádio fenológico (VE-R9)              |
| hasNaturalEnemies  | Boolean              | Presença de inimigos naturais           |
| naturalEnemiesDesc | String?              | Descrição dos inimigos encontrados      |
| damagePercentage   | Decimal(5,2)?        | % de dano estimado                      |
| photoUrl           | String?              | URL da foto (preparado para CA8)        |

## Endpoints

| Método | Rota                                                             | Descrição                                    |
| ------ | ---------------------------------------------------------------- | -------------------------------------------- |
| POST   | `/org/farms/:farmId/field-plots/:fieldPlotId/monitoring-records` | Criar registro                               |
| GET    | `/org/farms/:farmId/field-plots/:fieldPlotId/monitoring-records` | Listar (filtros: ponto, praga, nível, datas) |
| GET    | `/org/farms/:farmId/monitoring-records/:recordId`                | Detalhe                                      |
| PATCH  | `/org/farms/:farmId/monitoring-records/:recordId`                | Atualizar                                    |
| DELETE | `/org/farms/:farmId/monitoring-records/:recordId`                | Soft delete                                  |

## Frontend

- **Página:** `MonitoringRecordsPage` — tabela desktop + cards mobile, filtro por nível de infestação, badges coloridos por severidade, indicador de inimigos naturais
- **Modal:** `MonitoringRecordModal` — formulário com seleção de ponto e praga (com busca), datetime-local, nível, contagens, estádio fenológico, checkbox de inimigos naturais
- **Rota:** `/farms/:farmId/plots/:fieldPlotId/monitoring-records`
- **Navegação:** Link "Registros MIP" adicionado na página de pontos de monitoramento

## Testes

- Backend: 12 testes (CRUD + permissões + validação + auditoria)
- Frontend: 8 testes (empty state, loading, error, tabela, modal, filtro, breadcrumb, indicador inimigos naturais)
