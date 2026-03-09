# US-037 — CA3, CA4, CA7, CA8, CA9: Frontend Cultivares

## O que foi implementado

### CA3 — Vinculação a Talhões (Frontend)

- Componente `CultivarPlotHistory` com lista expansível de talhões
- Cada talhão mostra suas safras com cultivar, produtividade e produção
- Highlight da melhor safra por talhão (badge "Melhor")
- Tabela desktop + cards empilhados mobile
- Exportação CSV com dados de todas as safras
- Hook `useCultivarPlotHistory` consumindo `GET /org/farms/:farmId/cultivars/plot-history`

### CA4 — Comparativo de Produtividade (Tabela)

- Componente `CultivarProductivity` com tabela sortável (nome, produtividade, plantios)
- Linhas expansíveis mostrando detalhes por safra/talhão
- Filtro por cultura
- Exportação CSV

### CA7 — Filtros Avançados no Catálogo

- Painel de filtros avançados colapsável (botão "Filtros" com contador)
- Filtros: Tipo (Convencional/Transgênico), Tecnologia (text search)
- Filtros client-side sobre dados já carregados
- Botão "Limpar filtros" quando filtros estão ativos
- Empty state adaptado para filtros ativos

### CA8 — Gráfico de Produtividade

- Gráfico de barras horizontais (recharts) no modo "Gráfico"
- Toggle Gráfico/Tabela no toolbar
- Cores distintas por cultivar
- Tooltip com valor exato e número de plantios
- Layout responsivo com `ResponsiveContainer`

### CA9 — Histórico de Performance por Talhão

- Integrado no CA3 (mesma visualização)
- Highlight da melhor cultivar por talhão
- Dados por safra com produtividade e produção total

## Arquitetura

### Tabs na CultivarsPage

```
Catálogo | Produtividade | Histórico por Talhão
```

- Catálogo: catálogo existente + CA7 filtros avançados
- Produtividade: CA4 tabela + CA8 gráfico (lazy loaded)
- Histórico por Talhão: CA3/CA9 (lazy loaded)

### Novos arquivos

- `hooks/useCultivarPlotHistory.ts` — hook para histórico por talhão
- `hooks/useCultivarProductivity.ts` — hook para comparativo produtividade
- `components/cultivars/CultivarPlotHistory.tsx` + `.css`
- `components/cultivars/CultivarProductivity.tsx` + `.css`

### Padrões seguidos

- Farm-scoped: usa `useFarmContext()` para obter `selectedFarmId`
- Empty state quando nenhuma fazenda selecionada
- Skeleton loading, error handling
- Tabela desktop → cards mobile (<768px)
- CSS custom properties, fontes DM Sans/Source Sans 3/JetBrains Mono
- WCAG AA: aria-expanded, role="tablist", focus-visible, prefers-reduced-motion

## Testes

- `useCultivarPlotHistory.spec.ts` (4 testes)
- `useCultivarProductivity.spec.ts` (4 testes)
- `CultivarsPage.spec.tsx` (8 testes — tabs, filtros CA7)
