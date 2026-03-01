# US-012: Cadastro de Fazenda (Imóvel Rural) com Múltiplas Matrículas

## O que foi implementado

CRUD completo de fazendas com suporte a múltiplas matrículas de cartório, refletindo a estrutura fundiária real do Brasil onde um imóvel rural pode ser composto por várias matrículas em diferentes cartórios e comarcas.

## Por que

Fazendas brasileiras frequentemente possuem múltiplas matrículas de cartório (uma para cada gleba adquirida ao longo do tempo). O sistema precisa modelar essa realidade para controle fundiário adequado, incluindo dados do CCIR, classificação fundiária, áreas ambientais e grau de utilização.

## Etapa 1 — Migration

### Novos campos em `farms`

Campos adicionados para suporte a dados do CCIR, classificação fundiária, dados ambientais e produtividade:

- `ccirCode` — Código do CCIR (Certificado de Cadastro de Imóvel Rural)
- `landClassification` — MINIFUNDIO / PEQUENA / MEDIA / GRANDE
- `productive` — Se o imóvel é produtivo
- `fiscalModuleHa`, `fiscalModulesCount`, `minPartitionFraction` — Módulos fiscais
- `appAreaHa` — Área de Preservação Permanente
- `legalReserveHa` — Reserva Legal
- `taxableAreaHa`, `usableAreaHa` — Áreas tributável e utilizável
- `utilizationDegree` — Grau de utilização (%)

### Nova tabela `farm_registrations`

Matrículas de cartório (1:N → farms):

| Coluna           | Tipo          | Descrição                     |
| ---------------- | ------------- | ----------------------------- |
| id               | UUID PK       | Identificador                 |
| farmId           | FK → farms    | Fazenda vinculada (CASCADE)   |
| number           | TEXT          | Número da matrícula           |
| cnsCode          | TEXT?         | Código CNS do cartório        |
| cartorioName     | TEXT          | Nome do cartório              |
| comarca          | TEXT          | Comarca                       |
| state            | VARCHAR(2)    | UF                            |
| livro            | TEXT?         | Livro de registro             |
| registrationDate | TIMESTAMP?    | Data do registro              |
| areaHa           | DECIMAL(12,4) | Área da matrícula em hectares |

### Nova tabela `farm_documents` (esqueleto)

Preparação para upload de documentos (CA10 futuro). Será implementado quando houver storage (S3/MinIO).

### RLS

Ambas as tabelas têm RLS habilitado com política `tenant_isolation_policy` que verifica se o `farmId` pertence à organização corrente via subquery em `farms`.

**Migration:** `20260303100000_add_farm_details`

## Etapa 2 — Módulo `farms`

### Estrutura

```
src/modules/farms/
├── farms.types.ts      — FarmError, constantes (VALID_UF, CIB_REGEX), interfaces
├── farms.service.ts    — Business logic com withRlsContext
├── farms.routes.ts     — Router com authenticate + checkPermission + checkFarmAccess
└── farms.routes.spec.ts — 30+ testes unitários
```

### Endpoints

| Método | Rota                                      | Permissão      | Middleware        |
| ------ | ----------------------------------------- | -------------- | ----------------- |
| POST   | `/org/farms`                              | `farms:create` | —                 |
| GET    | `/org/farms`                              | `farms:read`   | —                 |
| GET    | `/org/farms/limit`                        | `farms:read`   | —                 |
| GET    | `/org/farms/:farmId`                      | `farms:read`   | `checkFarmAccess` |
| PATCH  | `/org/farms/:farmId`                      | `farms:update` | `checkFarmAccess` |
| PATCH  | `/org/farms/:farmId/status`               | `farms:update` | `checkFarmAccess` |
| POST   | `/org/farms/:farmId/registrations`        | `farms:update` | `checkFarmAccess` |
| PATCH  | `/org/farms/:farmId/registrations/:regId` | `farms:update` | `checkFarmAccess` |
| DELETE | `/org/farms/:farmId/registrations/:regId` | `farms:update` | `checkFarmAccess` |

### Validações

- **UF:** 27 estados brasileiros válidos
- **CIB:** Formato `XXX.XXX.XXX-X` (regex)
- **Classificação fundiária:** MINIFUNDIO, PEQUENA, MEDIA, GRANDE
- **Área:** Deve ser > 0 (farm e matrículas)
- **Limite de fazendas:** Verifica `org.maxFarms` antes de criar
- **Organização ativa:** Verifica `org.status === 'ACTIVE'`

### Alerta de divergência de área

Ao criar/editar/excluir matrículas, o sistema calcula se a soma das áreas das matrículas diverge mais de 5% da `totalAreaHa` da fazenda. Retorna `areaDivergence: { divergent: boolean, percentage: number }` na resposta.

### Padrões seguidos

- `withRlsContext(ctx)` em todas as funções de serviço
- `buildRlsContext(req)` nas rotas
- `FarmError extends Error { statusCode }` para erros de negócio
- `void logAudit(...)` fire-and-forget após mutações
- `checkFarmAccess()` middleware nos endpoints que recebem `:farmId`

## Etapa 3 — Seed + Testes

### Seed

5 matrículas adicionadas ao seed:

- Fazenda Santa Helena: 2 matrículas (3.200 ha + 2.000 ha = 5.200 ha)
- Fazenda Três Irmãos: 1 matrícula (1.800,5 ha)
- Fazenda Lagoa Dourada: 1 matrícula (520,75 ha)
- Sítio Recanto do Sol: 1 matrícula (185,3 ha)

### Testes

30+ testes cobrindo:

- Auth guard (401 sem token, 403 permissão insuficiente)
- Criar fazenda (201 sucesso, 400 validações, 422 limite)
- Listar paginado com filtros
- Obter por ID (200, 404)
- Editar (200, 404, 500)
- Toggle status (200, 400 status inválido)
- CRUD matrículas (201, 400 campos obrigatórios, 404, 500)
- Alerta divergência área >5%

## Arquivos

### Novos (6)

- `prisma/migrations/20260303100000_add_farm_details/migration.sql`
- `src/modules/farms/farms.types.ts`
- `src/modules/farms/farms.service.ts`
- `src/modules/farms/farms.routes.ts`
- `src/modules/farms/farms.routes.spec.ts`
- `docs/implementacao/US-012_cadastro-fazenda.md`

### Modificados (3)

- `prisma/schema.prisma` — novos campos Farm + modelos FarmRegistration, FarmDocument
- `prisma/seed.ts` — dados de matrículas
- `src/app.ts` — registro do `farmsRouter`

## Decisões

1. **Upload de documentos adiado:** Tabela `farm_documents` criada como esqueleto. Implementação do upload requer storage (S3/MinIO) que ainda não está configurado.
2. **PostGIS via raw SQL:** Campos `location` e `boundary` são `Unsupported` no Prisma, então coordenadas são inseridas/atualizadas via `$executeRawUnsafe`.
3. **UserFarmAccess para criador:** Ao criar fazenda, o criador recebe acesso automaticamente.
4. **checkFarmAccess mockado nos testes:** O middleware é testado separadamente; nos testes de rotas, é mockado para focar na lógica de negócio.
