# US-016 — Visualização da Fazenda no Mapa (Frontend)

## Resumo

Implementação da visualização de fazendas no mapa interativo com Leaflet/react-leaflet, incluindo lista de fazendas, mapa com camadas toggleáveis, popups informativos e responsividade.

## Dependências instaladas

- `leaflet` — biblioteca de mapas interativos
- `react-leaflet` — binding React para Leaflet
- `@types/leaflet` — tipos TypeScript (devDependency)

## Arquivos criados

### Tipos

| Arquivo             | Descrição                                                                   |
| ------------------- | --------------------------------------------------------------------------- |
| `src/types/farm.ts` | FarmListItem, FarmDetail, FarmRegistration, FarmsListResponse, BoundaryInfo |

### Hooks

| Arquivo                   | Descrição                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `src/hooks/useFarms.ts`   | GET /org/farms com search, page, state — retorna farms, meta, isLoading, error     |
| `src/hooks/useFarmMap.ts` | Busca farm detail + boundary + registration boundaries em paralelo via Promise.all |

### Páginas

| Arquivo                              | Descrição                                                                                                            |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `src/pages/FarmsPage.tsx` + `.css`   | Lista de fazendas em cards responsivos, search com debounce, skeleton loading, empty state                           |
| `src/pages/FarmMapPage.tsx` + `.css` | Página do mapa (rota `/farms/:farmId/map`) — header com breadcrumb, mapa full-height, controles de camada e base map |

### Componentes de mapa

| Arquivo                                             | Descrição                                                                          |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/components/map/FarmMap.tsx`                    | MapContainer + TileLayer + GeoJSON layers com Canvas renderer, popups informativos |
| `src/components/map/MapAutoFit.tsx`                 | Componente renderless — useMap() + fitBounds() no boundary da fazenda              |
| `src/components/map/BaseMapSelector.tsx` + `.css`   | Botões Topo/Satélite/Híbrido (floating bottom-left) com aria-pressed               |
| `src/components/map/LayerControlPanel.tsx` + `.css` | Toggles de camadas (desktop: panel top-right, mobile: FAB + bottom sheet)          |

## Arquivos modificados

| Arquivo                       | Alteração                                              |
| ----------------------------- | ------------------------------------------------------ |
| `src/App.tsx`                 | Rotas `/farms` e `/farms/:farmId/map` com lazy loading |
| `src/pages/DashboardPage.tsx` | Link "Fazendas" com ícone MapPin                       |

## Detalhes de implementação

### Base maps (CA1)

- **Topográfico**: OpenStreetMap
- **Satélite**: Esri World Imagery
- **Híbrido**: Esri Imagery + labels overlay

### Estilos GeoJSON (CA2/CA3)

- **Perímetro fazenda**: `#2E7D32` (primary), weight 3, fillOpacity 0.1
- **Matrículas**: cores distintas (orange, blue, gold, pink, turquoise, purple), weight 2, dashed, fillOpacity 0.15

### Camadas (CA5)

- Perímetro ✅ on
- Matrículas ✅ on
- Talhões 🔒 disabled (futuro)
- Pastos 🔒 disabled (futuro)
- Sedes/Estruturas 🔒 disabled (futuro)
- APP/Reserva Legal 🔒 disabled (futuro)

### Popup (CA6)

- Perímetro: nome, área total, estado, classificação fundiária
- Matrícula: número, cartório, comarca, área

### Performance (CA8)

- `preferCanvas={true}` no MapContainer
- GeoJSON `key` prop com ID para evitar re-render

### Responsividade (CA7)

- Mobile (<768px): mapa full-width, LayerControlPanel como FAB → bottom sheet
- Desktop (≥768px): controles sempre visíveis, breadcrumb completo

## Testes — 22 passando

| Arquivo                      | Testes | Descrição                                                     |
| ---------------------------- | ------ | ------------------------------------------------------------- |
| `useFarms.spec.ts`           | 3      | Lista, query params, error                                    |
| `useFarmMap.spec.ts`         | 4      | Dados completos, boundary ausente, farm 404, farmId undefined |
| `FarmsPage.spec.tsx`         | 4      | Cards, skeleton, empty state, links                           |
| `FarmMapPage.spec.tsx`       | 4      | Header, loading, error, layer/basemap toggle                  |
| `LayerControlPanel.spec.tsx` | 3      | Labels, disabled, toggle click                                |
| `BaseMapSelector.spec.tsx`   | 3      | Buttons, aria-pressed, click handler                          |
| `App.spec.tsx`               | 1      | (existente) Render login                                      |

## Acessibilidade

- HTML semântico: `<nav>`, `<main>`, `<header>`, `<article>`, `<button>`
- `aria-label` em ícones funcionais, `aria-hidden` em decorativos
- `aria-pressed` nos botões de base map
- `role="switch"` + `aria-checked` nos toggles de camada
- `role="alert"` em mensagens de erro
- `aria-current="page"` no breadcrumb
- `aria-busy="true"` no skeleton loading
- Focus visible com outline em todos os interativos
- Touch targets mínimos 48×48px

## Verificação

```bash
# Type-check
cd apps/frontend && npx tsc --noEmit  # ✅ OK

# Testes
pnpm --filter frontend test  # ✅ 22 passing

# Dev
pnpm --filter frontend dev
# Navegar: /farms → selecionar fazenda → /farms/:id/map
```
