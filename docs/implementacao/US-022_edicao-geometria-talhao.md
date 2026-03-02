# US-022 — Edição de Geometria do Talhão

## Resumo

Permite que o agrônomo edite visualmente o contorno (boundary) de um talhão existente diretamente no mapa, arrastando vértices, adicionando/removendo pontos, com recálculo de área em tempo real e histórico de alterações.

## O que foi implementado

### CA1: Modo de edição com drag de vértices do polígono

- Componente `PlotGeometryEditor` com MapContainer Leaflet dedicado
- Modo de edição (leaflet-draw edit handler) habilitado automaticamente ao abrir
- Farm boundary como referência visual (tracejado verde, read-only)
- Outros talhões visíveis com opacidade reduzida

### CA2: Adição e remoção de vértices

- Midpoints nativos do leaflet-draw permitem adicionar vértices
- Click em vértice existente para remover (funcionalidade nativa do edit handler)

### CA3: Área recalculada em tempo real durante a edição

- Badge flutuante "Área: X,XX ha" com `@turf/area` no front
- Atualiza a cada evento `draw:editvertex` e `draw:edited`
- Fonte monospace (JetBrains Mono) para dados numéricos

### CA4: Confirmação antes de salvar com comparativo

- Modal `ConfirmBoundaryEdit` com:
  - Área anterior vs. nova (font-mono)
  - Diferença em ha e percentual
  - Alerta visual (ícone AlertTriangle + cor warning) se diferença > 10%
  - Focus trap e Escape para fechar
  - `role="dialog"`, `aria-modal="true"`

### CA5: Histórico de alterações de geometria mantido

- Tabela `field_plot_boundary_versions` com campos: plotId, farmId, boundary, boundaryAreaHa, editedBy, editedAt, editSource, version
- Versão anterior salva automaticamente tanto em upload de arquivo (editSource='file_upload') quanto em edição via mapa (editSource='map_editor')
- Endpoint GET `/org/farms/:farmId/plots/:plotId/boundary/versions` retorna lista ordenada

## Estrutura de Arquivos

### Novos

| Arquivo                                                                              | Descrição                   |
| ------------------------------------------------------------------------------------ | --------------------------- |
| `apps/backend/prisma/migrations/20260309100000_plot_boundary_versions/migration.sql` | Migration: tabela + RLS     |
| `apps/frontend/src/components/map/PlotGeometryEditor.tsx`                            | Editor de geometria Leaflet |
| `apps/frontend/src/components/map/PlotGeometryEditor.css`                            | Estilos do editor           |
| `apps/frontend/src/components/map/ConfirmBoundaryEdit.tsx`                           | Modal de confirmação        |
| `apps/frontend/src/components/map/ConfirmBoundaryEdit.css`                           | Estilos do modal            |
| `apps/frontend/src/components/map/ConfirmBoundaryEdit.spec.tsx`                      | Testes do modal             |
| `apps/frontend/src/components/map/PlotGeometryEditor.spec.tsx`                       | Testes do editor            |

### Modificados

| Arquivo                                                      | Alteração                                                                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/prisma/schema.prisma`                          | Model `FieldPlotBoundaryVersion` + relações                                                                                                 |
| `apps/backend/src/modules/farms/farms.types.ts`              | `UpdatePlotBoundaryResult`, `PlotBoundaryVersionItem`                                                                                       |
| `apps/backend/src/modules/farms/farms.service.ts`            | `updatePlotBoundaryFromGeoJSON()`, `getPlotBoundaryVersions()`, `saveFieldPlotBoundaryVersion()`, versioning em `uploadFieldPlotBoundary()` |
| `apps/backend/src/modules/farms/farms.routes.ts`             | PATCH + GET versions endpoints                                                                                                              |
| `apps/backend/src/modules/farms/farms.routes.spec.ts`        | 6 novos testes backend                                                                                                                      |
| `apps/frontend/src/services/api.ts`                          | Método `put()`                                                                                                                              |
| `apps/frontend/src/types/farm.ts`                            | `UpdatePlotBoundaryResult`, `PlotBoundaryVersionItem`                                                                                       |
| `apps/frontend/src/components/map/PlotDetailsPanel.tsx`      | Botão "Editar perímetro"                                                                                                                    |
| `apps/frontend/src/components/map/PlotDetailsPanel.css`      | Estilos header actions                                                                                                                      |
| `apps/frontend/src/components/map/PlotDetailsPanel.spec.tsx` | 2 novos testes                                                                                                                              |
| `apps/frontend/src/pages/FarmMapPage.tsx`                    | Estado de edição, integração editor + modal                                                                                                 |
| `apps/backend/prisma/seed.ts`                                | 2 registros em field_plot_boundary_versions                                                                                                 |

## Endpoints

### PATCH `/api/org/farms/:farmId/plots/:plotId/boundary`

Atualiza o boundary do talhão a partir de GeoJSON raw (editor de mapa).

**Body:** `{ geojson: GeoJSON.Polygon }`

**Resposta 200:**

```json
{
  "boundaryAreaHa": 60.5,
  "previousAreaHa": 55.3,
  "warnings": ["Talhão extrapola o perímetro da fazenda"]
}
```

**Erros:** 400 (geometria inválida), 404 (talhão não encontrado), 422 (sobreposição > 5%)

**Audit:** action `EDIT_FIELD_PLOT_BOUNDARY`

### GET `/api/org/farms/:farmId/plots/:plotId/boundary/versions`

Lista versões anteriores do boundary do talhão.

**Resposta 200:**

```json
[
  {
    "id": "...",
    "version": 2,
    "boundaryAreaHa": 55.3,
    "editedAt": "...",
    "editSource": "map_editor"
  },
  {
    "id": "...",
    "version": 1,
    "boundaryAreaHa": 50.0,
    "editedAt": "...",
    "editSource": "file_upload"
  }
]
```

## Dependências adicionadas

- `leaflet-draw` + `@types/leaflet-draw` (frontend) — edição de polígonos
- `@turf/area` + `@turf/helpers` (frontend) — cálculo de área client-side

## Testes

- **Backend:** 466 testes (6 novos para PATCH boundary + GET versions)
- **Frontend:** 82 testes (9 novos: 5 ConfirmBoundaryEdit, 4 PlotGeometryEditor, 2 PlotDetailsPanel atualizado menos 2 contados separadamente)
- **Total:** 548 testes
