# US-017: Seletor de Fazenda e Contexto Multi-Fazenda

## Resumo

Implementação da filtragem de fazendas por acesso do usuário no backend, seletor de fazenda global no header com persistência, e views card/list com filtros na FarmsPage.

## O que foi implementado

### Etapa 1 — Backend: Filtragem por acesso + filtros de área

**Problema:** `GET /org/farms` retornava todas as fazendas da organização (apenas RLS). Usuários não-admin viam fazendas sem acesso.

**Solução:**

- `farms.types.ts`: adicionados `minAreaHa`/`maxAreaHa` em `ListFarmsQuery` e novo tipo `FarmListCaller`
- `farms.service.ts`: `listFarms()` agora recebe `caller` com userId/role
  - Se `ROLE_HIERARCHY[role] < 90` (não é ADMIN/SUPER_ADMIN), adiciona filtro `userAccess: { some: { userId } }`
  - Busca por `city` adicionada ao search OR
  - Filtros `totalAreaHa: { gte/lte }` para min/max area
- `farms.routes.ts`: extrai `caller` de `req.user`, parseia `minAreaHa`/`maxAreaHa` dos query params
- 2 novos testes: caller OPERATOR + filtros de área

**Arquivos modificados:**

- `apps/backend/src/modules/farms/farms.types.ts`
- `apps/backend/src/modules/farms/farms.service.ts`
- `apps/backend/src/modules/farms/farms.routes.ts`
- `apps/backend/src/modules/farms/farms.routes.spec.ts`

### Etapa 2 — Frontend: FarmContext + AppLayout + FarmSelector

**FarmContext** (`stores/FarmContext.tsx`):

- Busca `GET /org/farms?limit=100` no mount (já filtrado por acesso)
- Expõe: farms[], selectedFarmId, selectedFarm, selectFarm(), refreshFarms()
- Persistência em `localStorage` por userId (`protos_selected_farm_${userId}`)
- Restaura seleção no mount; reseta se fazenda não existe mais

**AppLayout** (`components/layout/AppLayout.tsx` + `.css`):

- Topbar sticky 64px: logo "Protos Farm", FarmSelector no centro, nav links + logout
- `<FarmProvider>` envolve `<Outlet />`
- Responsivo: labels ocultos <768px, FarmSelector oculto <640px
- Lógica de logout movida do DashboardPage para cá

**FarmSelector** (`components/farm-selector/FarmSelector.tsx` + `.css`):

- Botão trigger: MapPin + nome fazenda ou "Todas as fazendas" + ChevronDown
- Dropdown: search input (>3 fazendas), lista com "Todas as fazendas" primeiro
- Cada item: nome + localização/área, selected = borda esquerda primary-500
- Fecha com Escape ou click outside
- Acessibilidade: `aria-expanded`, `aria-haspopup="listbox"`, `role="option"`

**App.tsx**: `<AppLayout />` como wrapper de rotas protegidas via nested `<Route element>`

**DashboardPage**: simplificado — removidos header/logout/link fazendas (agora no AppLayout)

**10 novos testes:**

- FarmContext (4): load, select+localStorage, restore, reset
- FarmSelector (6): trigger text, selected name, dropdown, search, select, loading

**Arquivos criados/modificados:**

- `apps/frontend/src/stores/FarmContext.tsx` (novo)
- `apps/frontend/src/stores/FarmContext.spec.tsx` (novo)
- `apps/frontend/src/components/layout/AppLayout.tsx` + `.css` (novo)
- `apps/frontend/src/components/farm-selector/FarmSelector.tsx` + `.css` (novo)
- `apps/frontend/src/components/farm-selector/FarmSelector.spec.tsx` (novo)
- `apps/frontend/src/App.tsx` (mod)
- `apps/frontend/src/pages/DashboardPage.tsx` (mod)

### Etapa 3 — Frontend: FarmsPage views, filtros e placeholders

**Card/List toggle:**

- State `viewMode: 'card' | 'list'` com botões LayoutGrid/List
- `role="radiogroup"` + `aria-checked` para acessibilidade
- List view: rows no desktop, cards empilhados no mobile

**Filtros:**

- UF: `<select>` com todos os 27 estados
- Área min/max: `<input type="number">` com debounce 500ms
- Cultura: `<select disabled>` "Em breve"
- Filtros passados ao `useFarms` → query params no backend

**Placeholders em FarmCard:**

- "0 talhões" (ícone Layers) — preparação para talhões futuros
- "-" (ícone Wheat) — preparação para cultura futura

**Constante UF:** `constants/states.ts` com VALID_UF (27 estados)

**8 testes atualizados/novos:** cards, skeleton, empty, map links, view toggle, switch view, filter controls, placeholders

**Arquivos criados/modificados:**

- `apps/frontend/src/constants/states.ts` (novo)
- `apps/frontend/src/hooks/useFarms.ts` (mod — minAreaHa/maxAreaHa)
- `apps/frontend/src/pages/FarmsPage.tsx` (mod)
- `apps/frontend/src/pages/FarmsPage.css` (mod)
- `apps/frontend/src/pages/FarmsPage.spec.tsx` (mod)

## Dependência adicionada

- `@testing-library/user-event` (devDependency frontend) — para testes de interação

## Contagem de testes

- Backend: 415 testes (2 novos)
- Frontend: 36 testes (14 novos)
- Total: 451 testes passando

## Decisões técnicas

1. **Threshold ROLE_HIERARCHY >= 90 para bypass:** consistente com `checkFarmAccess` middleware existente
2. **FarmProvider dentro de AppLayout (não em App.tsx):** evita fetch desnecessário em rotas não-autenticadas (login, callback)
3. **localStorage por userId:** cada usuário mantém sua seleção independente
4. **Debounce 500ms nos filtros de área:** evita requisições excessivas enquanto o usuário digita
5. **Search por cidade no backend:** melhora usabilidade quando usuário busca por localização
