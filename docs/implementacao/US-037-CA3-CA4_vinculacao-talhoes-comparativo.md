# US-037 CA3/CA4/CA8/CA9 — Vinculação a Talhões e Comparativo de Produtividade

## O que foi feito

### Backend

- **Migration `20260320300000`**: adiciona `cultivarId` FK em `plot_crop_seasons` → `cultivars`
- **Relação bidirecional**: `Cultivar.plotCropSeasons` ↔ `PlotCropSeason.cultivar`
- **Endpoint `GET /org/farms/:farmId/cultivars/productivity`**: comparativo de produtividade por cultivar, agrupado por safra/talhão, com média ponderada (CA4/CA8)
- **Endpoint `GET /org/farms/:farmId/cultivars/plot-history`**: histórico de performance por talhão com cultivar, produtividade e notas (CA3/CA9)

## CAs Atendidos

- **CA3**: Vinculação a talhões via `cultivarId` em `PlotCropSeason`
- **CA4**: Comparativo de produtividade por cultivar (endpoint backend)
- **CA8**: Dados para gráfico comparativo (agrupado por safra/talhão)
- **CA9**: Histórico de performance por talhão (endpoint backend)

## CAs Pendentes (frontend)

- **CA7**: Filtros avançados no catálogo (já parcial)
- **CA8**: Gráfico de barras visual (requer lib de gráficos)
- **CA9**: Tabela de histórico no frontend
