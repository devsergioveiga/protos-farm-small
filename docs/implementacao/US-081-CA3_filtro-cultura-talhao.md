# US-081 CA3 — Filtro de tipos de operação por cultura do talhão

**Data:** 2026-03-10
**Status:** Implementado

## Critério de aceite

> Ao registrar operação no campo, sistema filtra os tipos disponíveis pela cultura do talhão selecionado. Ex.: seleciono talhão de café → aparecem apenas operações vinculadas a café e "Todas". Operações não vinculadas ficam ocultas (mas acessíveis via "mostrar todas" se necessário).

## O que foi feito

### Backend

- **Query parameter `crop`** adicionado aos endpoints `GET /org/operation-types` (flat) e `GET /org/operation-types/tree`
- **Lógica de filtro:** retorna tipos que possuem a cultura informada OU "Todas" na junction table `operation_type_crops`
- Tipos sem nenhuma cultura vinculada **não** aparecem no filtro (precisam ter crop explícito)
- No endpoint tree, categorias raiz (nível 1) são mantidas se possuem filhos que passam no filtro, mesmo que a raiz não tenha a cultura diretamente
- Sem filtro (`crop` ausente), comportamento inalterado — retorna todos

### Frontend

- **Dropdown "Filtrar por cultura"** adicionado à toolbar da página de tipos de operação
- Lista todas as culturas de `CROP_OPTIONS_OPERATION` (exceto "Todas")
- Opção padrão "Todas as culturas" desativa o filtro
- Hook `useOperationTypeTree` atualizado para aceitar `crop` e montar a query string
- Empty state contextual: mostra mensagem específica quando filtro ativo não retorna resultados

### Testes

- 4 testes novos (total: 26)
  - Passa `crop` ao service no list endpoint
  - Passa `crop` ao service no tree endpoint
  - Não passa `crop` quando ausente
  - Retorna árvore filtrada com branches correspondentes

## Arquivos modificados

### Backend

- `operation-types.types.ts` — campo `crop` em `ListOperationTypesQuery`
- `operation-types.service.ts` — filtro `crops.some` em list, filtro recursivo em tree
- `operation-types.routes.ts` — repasse de `req.query.crop` nos dois endpoints
- `operation-types.routes.spec.ts` — 4 testes CA3

### Frontend

- `hooks/useOperationTypes.ts` — `crop` no options e na query string
- `pages/OperationTypesPage.tsx` — dropdown filtro, empty state contextual
- `pages/OperationTypesPage.css` — estilos `.optype-page__filter-*`

## Decisões de design

1. **Filtro server-side** — evita trazer toda a árvore e filtrar no client; mais eficiente para organizações com muitos tipos
2. **Categorias raiz preservadas** — ao filtrar por cultura, categorias pai sem a cultura mas com filhos correspondentes continuam visíveis para manter a hierarquia
3. **Dropdown na admin page** — permite ao admin visualizar como a árvore aparece para cada cultura, simulando a experiência do registro de operações
