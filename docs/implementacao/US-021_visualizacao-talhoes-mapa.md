# US-021 — Visualização de talhões no mapa

**Data:** 2026-03-02
**Status:** Concluída
**Escopo:** Frontend-only (sem alterações no backend)

---

## O que foi implementado

### Critérios de aceite

| #   | Critério                                                    | Status    |
| --- | ----------------------------------------------------------- | --------- |
| 1   | Talhões coloridos por cultura com legenda visível           | Concluído |
| 2   | Tooltip no hover: nome, cultura, área, tipo de solo         | Concluído |
| 3   | Click abre painel lateral com detalhes completos            | Concluído |
| 4   | Filtro por cultura (safra/status como placeholders futuros) | Concluído |
| 5   | Label com nome do talhão visível em zoom >= 15              | Concluído |
| 6   | Área total por cultura exibida em resumo                    | Concluído |

### Notas sobre dados indisponíveis

- **Produtividade última safra**: campo não existe no modelo — tooltip exibe nome, cultura, área e solo
- **Safra e status (plantado/colhido/pousio)**: não existem no modelo — filtro implementado por cultura; safra/status ficam para US futura

---

## Componentes criados/modificados

### FarmMap.tsx (modificado)

- Exportou `CROP_COLORS`, `getCropColor()`, `formatArea()` para reuso
- Novas props: `onPlotClick?: (plot: FieldPlot) => void`, `cropFilter?: Set<string>`
- Filtra `plotBoundaries` por `cropFilter` antes de renderizar
- Substituiu `<Popup>` por `onEachFeature` com `bindTooltip` (hover) + click handler
- Integrou `<PlotLabels>` para labels zoom-dependentes

### PlotLabels.tsx (novo)

- Usa `useMap()` + listener `zoomend`
- Renderiza `L.tooltip({ permanent: true })` no centróide quando zoom >= 15
- Nomes truncados em 15 caracteres
- Labels com text-shadow branco para legibilidade sobre satélite

### CropLegend.tsx + .css (novo)

- Posição: bottom-left no mapa
- Agrupa plots por `currentCrop` → conta + soma área
- Cada item é clicável para filtrar (toggle on/off)
- Itens filtrados ficam com opacidade 0.4
- "Sem cultura" para plots com `currentCrop === null`
- Linha de total: "X talhões · Y,YY ha"
- Botão "Limpar filtros" quando filtro ativo
- Mobile: colapsável com FAB (ícone Palette)

### PlotDetailsPanel.tsx + .css (novo)

- Painel slide-in da direita (320px desktop, bottom sheet mobile)
- Campos: nome com swatch, código, cultura atual/anterior, solo, área (mono), observações, data criação
- Animação slide-in com `prefers-reduced-motion` respeitado
- Botão fechar com aria-label

### PlotSummaryBar.tsx + .css (novo)

- Barra compacta: "X talhões · Y,YY ha mapeados · Z,ZZ ha sem talhão"
- Desktop: bottom-right (não sobrepõe legenda bottom-left)
- Mobile: centralizado acima do FAB da legenda
- Oculto quando não há plots

### FarmMapPage.tsx (modificado)

- States: `selectedPlot`, `cropFilter`
- Handlers: `handlePlotClick`, `handleToggleCrop`
- Integra CropLegend, PlotDetailsPanel, PlotSummaryBar condicionalmente

---

## Testes

12 novos testes frontend:

| Arquivo                   | Testes                                                |
| ------------------------- | ----------------------------------------------------- |
| CropLegend.spec.tsx       | 4 (renderiza, agrupa, "Sem cultura", onToggleCrop)    |
| PlotDetailsPanel.spec.tsx | 5 (detalhes, campos opcionais, fechar, null, minimal) |
| PlotSummaryBar.spec.tsx   | 3 (total, unmapped, vazio)                            |

**Total:** 460 backend + 71 frontend = 531 testes

---

## Decisões técnicas

1. **Frontend-only**: todos os dados já disponíveis via endpoints existentes (`GET /plots`, `GET /plots/summary`)
2. **Filtro por Set<string>**: cropFilter usa chave lowercase da cultura; `__none__` para "Sem cultura"
3. **onEachFeature em vez de Popup**: melhor UX (tooltip no hover + click abre painel lateral)
4. **PlotLabels com L.marker invisible**: usa marker com opacity 0 para ancorar tooltip permanente no centróide
5. **z-index**: legenda e layer-panel em 1000, painel detalhes em 1001, summary em 999
