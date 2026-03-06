# US-028: Cadastro de Pastos e Instalações

## Resumo

Implementação de entidades georreferenciadas para pastos e instalações (curral, galpão, bezerreiro, etc.), com boundary PostGIS, capacidade, status e visualização no mapa da fazenda.

## Decisão de Design

**Tabela única `farm_locations`** com discriminador `type` (PASTURE/FACILITY). Campos type-specific são nullable. Simplifica CRUD, API e frontend — evita duplicação de lógica entre duas tabelas com 90% de campos iguais.

## O que foi implementado

### Etapa 1: Migration + Schema

- **Migration `20260315100000_farm_locations`**: 5 novos enums (FarmLocationType, PastureStatus, FacilityStatus, ForageType, FacilityType), tabela `farm_locations` com boundary geometry(Geometry, 4326) (suporta Point e Polygon), unique parcial (farmId, name), índices GiST
- **FKs**: `animal_lots.locationId` → `farm_locations.id`, `animals.pastureId` → `farm_locations.id`
- **RLS**: via `farms.organizationId` (padrão existente)
- **Schema Prisma**: model FarmLocation + relações em Farm, AnimalLot e Animal

### Etapa 2: Backend

- **Módulo `farm-locations`** em `modules/animals/`:
  - `farm-locations.types.ts`: FarmLocationError, constantes de enums, interfaces de I/O
  - `farm-locations.service.ts`: 10 funções (create, list, get, update, softDelete, uploadBoundary, getBoundary, deleteBoundary, getOccupancy, listForMap)
  - `farm-locations.routes.ts`: 10 endpoints com RBAC (animals:\*), multer para upload, audit log
  - `farm-locations.routes.spec.ts`: 21 testes
- **Reutilizações**: `parseGeoFile`/`validateGeometry` de `farms/geo-parser.ts`, `ALLOWED_GEO_EXTENSIONS`/`MAX_GEO_FILE_SIZE` de `farms.types.ts`
- **Ocupação**: <70% green, 70-90% yellow, >90% red
- **Map endpoint**: `/locations/map` retorna todos os locais com boundary GeoJSON + occupancy em uma query (evita N+1)

### Etapa 3: Frontend

- **Types**: `src/types/farm-location.ts` com labels para todos os enums
- **Hook**: `useFarmLocations.ts` (fetch `/locations/map`)
- **Componentes**:
  - `CreateLocationModal` (2 steps: tipo + dados condicionais, validação inline)
  - `LocationDetailsPanel` (slide-in com status, capacidade, ocupação)
  - `OccupancyBadge` (dot colorido + %, aria-label)
  - `LocationLegend` (cores por pasture status e facility type)
- **Integração mapa**:
  - `useFarmMap.ts`: fetch paralelo de locations
  - `FarmMap.tsx`: renderização de pastos (GeoJSON/CircleMarker) e instalações com cores por status/tipo, tooltips
  - `FarmMapPage.tsx`: layers "Pastos" e "Instalações" habilitados, botão "Novo local", estados

### Etapa 4: Seed + Docs

- 5 farm_locations para Fazenda Santa Helena (3 pastos + 2 instalações)
- 2 lotes vinculados via locationId

## Endpoints

| Método | Rota                                                 | Permissão      |
| ------ | ---------------------------------------------------- | -------------- |
| POST   | `/org/farms/:farmId/locations`                       | animals:create |
| GET    | `/org/farms/:farmId/locations`                       | animals:read   |
| GET    | `/org/farms/:farmId/locations/map`                   | animals:read   |
| GET    | `/org/farms/:farmId/locations/:locationId`           | animals:read   |
| PATCH  | `/org/farms/:farmId/locations/:locationId`           | animals:update |
| DELETE | `/org/farms/:farmId/locations/:locationId`           | animals:delete |
| POST   | `/org/farms/:farmId/locations/:locationId/boundary`  | animals:update |
| GET    | `/org/farms/:farmId/locations/:locationId/boundary`  | animals:read   |
| DELETE | `/org/farms/:farmId/locations/:locationId/boundary`  | animals:update |
| GET    | `/org/farms/:farmId/locations/:locationId/occupancy` | animals:read   |

## Testes

- Backend: 21 novos testes (625 total)
- Frontend: 635 total (existentes continuam passando)

## Cores no Mapa

**Pastos por status:**

- EM_USO: `#2E7D32` (verde)
- DESCANSO: `#FFA000` (amarelo)
- REFORMANDO: `#C62828` (vermelho)

**Instalações por tipo:**

- GALPAO: `#1565C0`
- BEZERREIRO: `#7B1FA2`
- CURRAL: `#4E342E`
- BAIA: `#00695C`
- SALA_ORDENHA: `#0277BD`
- ESTABULO: `#558B2F`
- CONFINAMENTO: `#D84315`
- OUTRO: `#757575`
