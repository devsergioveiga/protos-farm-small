# US-087 — Mapa de Produtividade por Talhão (CA1-CA4)

## O que foi feito

### CA1 — Mapa com talhões coloridos por faixas de produtividade

- Endpoint backend `GET /api/org/farms/:farmId/productivity-map` que agrega dados de colheita (grãos e café) por talhão
- Calcula produtividade em sc/ha para cada talhão
- Classifica talhões em 3 faixas baseadas na média (±10%):
  - **ALTA** (verde `#2E7D32`): acima de +10% da média
  - **MEDIA** (amarelo `#F9A825`): entre -10% e +10% da média
  - **BAIXA** (vermelho `#C62828`): abaixo de -10% da média
  - **SEM_DADOS** (cinza `#9E9E9E`): talhões sem colheita registrada
- Frontend renderiza polígonos coloridos via Leaflet/react-leaflet com tooltips informativos
- Popup com detalhes ao clicar no talhão

### CA2 — Filtro por cultura e período

- Filtro por tipo de cultura (Grãos/Café/Todas)
- Filtro por período (data início/fim)
- Painel de filtros expansível com badge de indicação de filtros ativos

### CA3 — Popup com detalhes

- Tooltip sticky com produtividade e variação percentual
- Popup Leaflet com: cultura, produção total, produtividade/ha, variação da média, número de colheitas

### CA4 — Ranking de talhões por produtividade

- Sidebar lateral com ranking ordenado por produtividade decrescente
- Cada item mostra: posição, nome do talhão, produtividade, cultura, área
- Badge colorido com variação percentual da média
- Resumo com contagem de talhões com/sem dados

## Arquivos criados

### Backend

- `apps/backend/src/modules/productivity-map/productivity-map.types.ts` — tipos e error class
- `apps/backend/src/modules/productivity-map/productivity-map.service.ts` — serviço de agregação
- `apps/backend/src/modules/productivity-map/productivity-map.routes.ts` — endpoint GET
- `apps/backend/src/modules/productivity-map/productivity-map.routes.spec.ts` — 14 testes

### Frontend

- `apps/frontend/src/types/productivity-map.ts` — tipos compartilhados
- `apps/frontend/src/hooks/useProductivityMap.ts` — hook de dados
- `apps/frontend/src/pages/ProductivityMapPage.tsx` — página principal com mapa + ranking
- `apps/frontend/src/pages/ProductivityMapPage.css` — estilos responsivos
- `apps/frontend/src/pages/ProductivityMapPage.spec.tsx` — 15 testes

### Arquivos modificados

- `apps/backend/src/app.ts` — registro da rota
- `apps/frontend/src/App.tsx` — registro da rota + lazy loading
- `apps/frontend/src/components/layout/Sidebar.tsx` — item de menu "Mapa produtividade"

## Decisões técnicas

- Produtividade normalizada em **sc/ha** (sacas por hectare) para ambas as culturas
- Classificação por faixas relativas (±10% da média) — mais flexível que valores absolutos
- Reutiliza `useFarmMap` para geometria dos talhões (evita duplicar chamadas de boundary)
- Endpoint separado dos módulos de colheita — agrega dados de múltiplas fontes
- Não criou migration (usa dados existentes das tabelas de colheita)

## Testes

- Backend: 14 testes (autenticação, filtros, erros, validação)
- Frontend: 15 testes (renderização, filtros, estados, responsividade)
