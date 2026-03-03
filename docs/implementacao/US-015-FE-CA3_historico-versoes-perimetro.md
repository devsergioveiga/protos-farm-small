# US-015-FE CA3 — Histórico de Versões de Perímetro

## Objetivo

Permitir ao usuário visualizar o histórico de versões do perímetro de uma fazenda ou matrícula, com preview da geometria anterior sobreposta no mapa.

## O que foi implementado

### Backend

- **Novo tipo** `BoundaryVersionDetail` (extends `BoundaryVersionItem` com `boundaryGeoJSON`)
- **Nova função** `getBoundaryVersionById(ctx, farmId, versionId, registrationId?)` — busca versão específica com geometria via `ST_AsGeoJSON`
- **2 novos endpoints:**
  - `GET /org/farms/:farmId/boundary/versions/:versionId`
  - `GET /org/farms/:farmId/registrations/:regId/boundary/versions/:versionId`

### Frontend

- **Tipos** `BoundaryVersionItem` e `BoundaryVersionDetail` em `types/farm.ts`
- **Hook** `useBoundaryVersions(farmId, registrationId?)` — lista versões + `fetchVersionGeometry(versionId)`
- **BoundaryVersionsPanel** — painel slide-in (direita desktop, bottom sheet mobile):
  - Lista versões em ordem decrescente
  - Badge "Atual" na versão mais recente (desabilitada para clique)
  - Clique em versão anterior carrega geometria e notifica parent via `onPreviewVersion`
  - Segundo clique limpa a seleção
  - Skeleton loading, empty state, erro
- **FarmMap** — nova prop `versionOverlay` renderiza `<GeoJSON>` laranja tracejado (`#FF6F00`, dashArray `8 6`, fillOpacity 0.15)
- **FarmMapPage** — botão "Histórico" (Clock) no header, gerenciamento de estado `boundaryVersionsTarget` e `versionOverlay`
- **RegistrationsPanel** — botão Clock em matrículas com perímetro, abre histórico da matrícula específica

## Arquivos modificados

| Arquivo                                                                | Ação                                |
| ---------------------------------------------------------------------- | ----------------------------------- |
| `apps/backend/src/modules/farms/farms.types.ts`                        | Adicionado `BoundaryVersionDetail`  |
| `apps/backend/src/modules/farms/farms.service.ts`                      | Adicionado `getBoundaryVersionById` |
| `apps/backend/src/modules/farms/farms.routes.ts`                       | 2 novos GET endpoints               |
| `apps/backend/src/modules/farms/farms.routes.spec.ts`                  | 3 novos testes                      |
| `apps/frontend/src/types/farm.ts`                                      | Adicionados tipos boundary versions |
| `apps/frontend/src/hooks/useBoundaryVersions.ts`                       | Novo hook                           |
| `apps/frontend/src/hooks/useBoundaryVersions.spec.ts`                  | 5 testes                            |
| `apps/frontend/src/components/boundary/BoundaryVersionsPanel.tsx`      | Novo componente                     |
| `apps/frontend/src/components/boundary/BoundaryVersionsPanel.css`      | Novo CSS                            |
| `apps/frontend/src/components/boundary/BoundaryVersionsPanel.spec.tsx` | 9 testes                            |
| `apps/frontend/src/components/map/FarmMap.tsx`                         | Prop `versionOverlay`               |
| `apps/frontend/src/pages/FarmMapPage.tsx`                              | Integração completa                 |
| `apps/frontend/src/components/registrations/RegistrationsPanel.tsx`    | Botão Clock                         |

## Testes

- Backend: 102 testes passando (3 novos para version detail endpoint)
- Frontend: 320 testes passando (14 novos: 9 BoundaryVersionsPanel + 5 useBoundaryVersions)

## Verificação manual

1. Abrir mapa de fazenda com boundary → clicar "Histórico" → ver lista de versões → clicar versão anterior → overlay laranja tracejado no mapa
2. Abrir Matrículas → clicar Clock em matrícula com boundary → ver versões da matrícula
3. Clicar versão selecionada novamente → overlay removido
4. Versão "Atual" desabilitada para clique
