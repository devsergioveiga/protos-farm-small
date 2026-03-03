# Cadastro de CAR (Cadastro Ambiental Rural)

## Contexto

O CAR era um campo texto simples (`carCode`) na tabela `farms`. Na prática, uma fazenda pode ter **múltiplos CARs**, e cada CAR pode cobrir **múltiplas matrículas** (relação N:N). Exemplo: Fazenda Santa Helena tem 2 matrículas divididas em 2 CARs.

## O que foi feito

### Etapa 1: Migration + Prisma Schema

**Migration:** `20260311100000_car_registrations`

- Enum `CarStatus` (ATIVO, PENDENTE, CANCELADO, SUSPENSO)
- Tabela `car_registrations` com:
  - Identificação: farmId, carCode, status, inscriptionDate, lastRectificationDate
  - Dimensão: areaHa, modulosFiscais, city, state
  - Cobertura do solo: nativeVegetationHa, consolidatedAreaHa, administrativeEasementHa
  - Reserva Legal: legalReserveRecordedHa, legalReserveApprovedHa, legalReserveProposedHa
  - APP: appTotalHa, appConsolidatedHa, appNativeVegetationHa
  - Uso restrito e regularidade: restrictedUseHa, surplus/deficit, campos toRestore
  - Boundary PostGIS: geometry(Polygon, 4326) + boundaryAreaHa + GiST index
- Tabela `car_registration_links` (M:N CAR ↔ Matrícula)
- RLS para ambas as tabelas (mesmo padrão de tenant isolation via farmId)

**Prisma schema:** CarRegistration, CarRegistrationLink, enum CarStatus

### Etapa 2: Módulo Backend

**Módulo:** `apps/backend/src/modules/car/`

| Arquivo          | Descrição                                           |
| ---------------- | --------------------------------------------------- |
| `car.types.ts`   | Error class, constantes, interfaces de input/output |
| `car.service.ts` | 8 funções CRUD + boundary (withRlsContext)          |
| `car.routes.ts`  | 8 endpoints REST com auth, RBAC, checkFarmAccess    |

**Endpoints:** Base `/api/org/farms/:farmId/car`

| Método | Rota               | Permissão    | Descrição                               |
| ------ | ------------------ | ------------ | --------------------------------------- |
| POST   | `/`                | farms:create | Criar CAR com registrationIds opcionais |
| GET    | `/`                | farms:read   | Listar CARs da fazenda                  |
| GET    | `/:carId`          | farms:read   | Detalhe do CAR com links                |
| PATCH  | `/:carId`          | farms:update | Atualizar CAR (delete+recreate links)   |
| DELETE | `/:carId`          | farms:delete | Excluir CAR                             |
| POST   | `/:carId/boundary` | farms:update | Upload perímetro (GeoJSON/KML/KMZ/SHP)  |
| GET    | `/:carId/boundary` | farms:read   | Obter perímetro como GeoJSON            |
| DELETE | `/:carId/boundary` | farms:update | Remover perímetro                       |

### Etapa 3: Seed + Testes

**Seed:** 2 CARs para Fazenda Santa Helena + 3 links CAR↔Matrícula

**Testes:** 25 testes em `car.routes.spec.ts`

- Auth/RBAC: 3 testes
- CRUD: 13 testes
- Boundary: 5 testes
- Delete RBAC: 2 testes adicionais

## Decisões

- **Reuso de permissões `farms:*`**: CAR é sub-recurso de fazenda, sem necessidade de módulo RBAC separado
- **Campo `farms.carCode` mantido**: retrocompatibilidade, pode ser derivado ou removido no futuro
- **Sem versionamento de boundary**: diferente de farms/plots, CAR boundary não tem histórico de versões (pode ser adicionado se necessário)
- **M:N links com delete+recreate**: padrão já usado em producers, simples e eficaz

## Totais

- 523 testes backend passando (498 + 25 novos)
