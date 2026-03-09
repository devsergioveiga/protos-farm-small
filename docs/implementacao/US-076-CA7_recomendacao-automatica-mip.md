# US-076 CA7 — Recomendação automática de controle MIP

## O quê

Quando o nível de infestação de uma praga atinge ou ultrapassa o limiar de controle (NC) configurado na biblioteca de pragas, o sistema gera automaticamente recomendações de ação com:

- Praga identificada e nível encontrado vs. NC
- Pontos de monitoramento afetados (com coordenadas e nível atual)
- Tendência da infestação (em alta, estável, em queda)
- Produtos recomendados, dose e período de carência
- Presença de inimigos naturais
- Urgência (Alerta ou Crítico)

A recomendação é uma sugestão baseada em dados — a decisão final é do agrônomo.

## Por quê

O MIP (Manejo Integrado de Pragas) exige que aplicações de defensivos sejam baseadas em nível de dano econômico, não em calendário fixo. Com recomendações automáticas, o agrônomo recebe alertas objetivos quando a pressão de pragas atinge o limiar, reduzindo pulverização desnecessária e atendendo requisitos de certificação.

## Como

### Backend

**Schema (Prisma):**

- Adicionados campos `controlThreshold` (InfestationLevel?) e `recommendedProducts` (String?) ao modelo `Pest`
- Migration: `20260327100000_add_pest_control_threshold`

**Endpoint:**

- `GET /org/farms/:farmId/field-plots/:fieldPlotId/monitoring-recommendations`
- Query params: `pestId` (filtro por praga), `urgency` (ALERTA | CRITICO)
- Lógica:
  1. Busca pragas com `controlThreshold` definido
  2. Busca registros dos últimos 30 dias para essas pragas
  3. Para cada praga, identifica pontos onde o nível mais recente ≥ NC
  4. Calcula tendência (comparação terço inicial vs. final dos registros)
  5. Define urgência: CRITICO se maxLevel = CRITICO, senão ALERTA
- Response: `{ data: RecommendationItem[], summary: RecommendationSummary }`

**Pests module:** Atualizado para aceitar e retornar `controlThreshold` e `recommendedProducts`

### Frontend

**Página:** `MonitoringRecommendationsPage` (`/farms/:farmId/plots/:fieldPlotId/monitoring-recommendations`)

- Cards de resumo: total alertas, críticos, alertas, pontos afetados
- Disclaimer informando que recomendação não substitui decisão do agrônomo
- Cards por praga com: urgência, nível atual vs. NC, tendência, NDE/NC, produtos recomendados
- Pontos afetados expansíveis (tabela desktop, cards mobile)
- Link para mapa de calor filtrado por praga
- Filtros: praga, urgência
- Empty state orientando a configurar NC na biblioteca

**PestModal:** Adicionados campos "Limiar de controle (nível)" (select InfestationLevel) e "Produtos recomendados" (textarea)

**Navegação:** Botão "Recomendações" adicionado na MonitoringPointsPage

### Testes

- Backend: 5 testes (200 com dados, empty, query params, 401, 403)
- Frontend: 9 testes (loading, empty, cards, expand/collapse, filtros, erro, breadcrumb, plotName)
