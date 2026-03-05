# US-024-FE CA5 — Histórico de versões do perímetro do talhão

## O que foi feito

Adicionada a tab "Perímetro" ao `PlotHistoryPanel`, exibindo o histórico de versões do perímetro de cada talhão. A visualização é de metadados (versão, data, área, fonte da edição) sem preview de geometria no mapa.

## Por que

O usuário precisa acompanhar as alterações feitas no perímetro de cada talhão ao longo do tempo, identificando quando, como e qual foi o impacto em área de cada edição.

## Arquivos criados

| Arquivo                                                              | Descrição                                |
| -------------------------------------------------------------------- | ---------------------------------------- |
| `apps/frontend/src/hooks/usePlotBoundaryVersions.ts`                 | Hook para fetch das versões do perímetro |
| `apps/frontend/src/components/map/PlotBoundaryVersionsList.tsx`      | Componente lista de versões com cards    |
| `apps/frontend/src/components/map/PlotBoundaryVersionsList.css`      | Estilos do componente                    |
| `apps/frontend/src/components/map/PlotBoundaryVersionsList.spec.tsx` | 6 testes do componente                   |

## Arquivos modificados

| Arquivo                                                 | Alteração                                          |
| ------------------------------------------------------- | -------------------------------------------------- |
| `apps/frontend/src/components/map/PlotHistoryPanel.tsx` | Nova tab "Perímetro" (type Tab + botão + tabpanel) |

## Detalhes técnicos

- **Hook `usePlotBoundaryVersions`:** Segue o padrão do `usePlotHistory` — `useState` + `useCallback` + `useEffect` com fetch para `GET /org/farms/:farmId/plots/:plotId/boundary/versions`.
- **Tradução de `editSource`:** map_editor → "Editor de mapa", file_upload → "Upload de arquivo", subdivide → "Subdivisão", merge → "Mesclagem".
- **Badge "Atual":** Exibido na versão com maior número de `version`.
- **Estados:** skeleton loading (3 cards), empty state com ícone Clock, error com role="alert".
- **Tab posicionada** entre "Solo" e "Exportar" no PlotHistoryPanel.

## Endpoint consumido

- `GET /api/org/farms/:farmId/plots/:plotId/boundary/versions` → `PlotBoundaryVersionItem[]`
