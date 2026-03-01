# US-013: Cadastro de Produtor Rural (Entidade Fiscal)

## Resumo

Implementa o cadastro completo de produtores rurais com dados fiscais, inscrições estaduais (IEs) como sub-recurso, participantes de sociedade em comum, e vinculação produtor-fazenda com tipo de vínculo e percentual de participação.

## Arquitetura

### Etapa 1 — Migration + Schema Prisma

**Migration:** `prisma/migrations/20260304100000_add_producers/migration.sql`

#### 6 novos enums

| Enum                   | Valores                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `ProducerType`         | PF, PJ, SOCIEDADE_EM_COMUM                                                         |
| `ProducerStatus`       | ACTIVE, INACTIVE                                                                   |
| `ProducerFarmBondType` | PROPRIETARIO, ARRENDATARIO, COMODATARIO, PARCEIRO, MEEIRO, USUFRUTUARIO, CONDOMINO |
| `TaxRegime`            | REAL, PRESUMIDO, SIMPLES, ISENTO                                                   |
| `IeSituation`          | ACTIVE, SUSPENDED, CANCELLED                                                       |
| `IeCategory`           | PRIMEIRO_ESTABELECIMENTO, DEMAIS, UNICO                                            |

#### 5 novas tabelas

1. **`producers`** — Produtor rural com dados fiscais completos. Unique parcial em `(document, organizationId)` onde `document IS NOT NULL`.
2. **`society_participants`** — Participantes de Sociedade em Comum com CPF e % de participação. Unique em `(producerId, cpf)`.
3. **`producer_state_registrations`** — Inscrições estaduais vinculadas opcionalmente a uma fazenda. Unique em `(producerId, number, state)`.
4. **`producer_farm_links`** — Vínculo produtor-fazenda com tipo e participação. Unique em `(producerId, farmId, bondType)`.
5. **`producer_documents`** — Esqueleto para documentos do produtor.

#### RLS

- `producers`: direto via `organizationId = current_org_id()`
- Demais 4 tabelas: subquery via `producerId IN (SELECT id FROM producers WHERE "organizationId" = current_org_id())`

### Etapa 2 — Módulo `producers`

**Estrutura:** `src/modules/producers/` com types, service, routes e spec.

#### RBAC

Módulo `producers` adicionado a `PermissionModule`, `ALL_MODULES` e `DEFAULT_ROLE_PERMISSIONS`:

| Role                                           | Permissões                     |
| ---------------------------------------------- | ------------------------------ |
| SUPER_ADMIN / ADMIN                            | Full CRUD (via allPermissions) |
| MANAGER                                        | Full CRUD                      |
| AGRONOMIST / FINANCIAL / CONSULTANT / OPERATOR | Read only                      |
| COWBOY                                         | Nenhuma                        |

#### 17 endpoints

| Método | Rota                                           | Permissão          |
| ------ | ---------------------------------------------- | ------------------ |
| POST   | `/org/producers`                               | `producers:create` |
| GET    | `/org/producers`                               | `producers:read`   |
| GET    | `/org/producers/:producerId`                   | `producers:read`   |
| PATCH  | `/org/producers/:producerId`                   | `producers:update` |
| PATCH  | `/org/producers/:producerId/status`            | `producers:update` |
| POST   | `/org/producers/:producerId/participants`      | `producers:update` |
| PATCH  | `/org/producers/:producerId/participants/:pid` | `producers:update` |
| DELETE | `/org/producers/:producerId/participants/:pid` | `producers:update` |
| POST   | `/org/producers/:producerId/ies`               | `producers:update` |
| PATCH  | `/org/producers/:producerId/ies/:ieId`         | `producers:update` |
| DELETE | `/org/producers/:producerId/ies/:ieId`         | `producers:update` |
| PATCH  | `/org/producers/:producerId/ies/:ieId/default` | `producers:update` |
| POST   | `/org/producers/:producerId/farms`             | `producers:update` |
| GET    | `/org/producers/:producerId/farms`             | `producers:read`   |
| PATCH  | `/org/producers/:producerId/farms/:linkId`     | `producers:update` |
| DELETE | `/org/producers/:producerId/farms/:linkId`     | `producers:update` |
| GET    | `/org/farms/:farmId/producers`                 | `farms:read`       |

#### Validações

- **PF:** name + CPF obrigatórios (reusa `isValidCPF`)
- **PJ:** name + CNPJ obrigatórios (reusa `isValidCNPJ`)
- **SC:** name obrigatório, document null, participantes com soma ≤ 100%
- **UF:** reutiliza constante `VALID_UF`
- **IE:** unique por (producerId, number, state); formato 8-14 dígitos
- **spouseCpf, legalRepCpf:** validados se fornecidos

### Etapa 3 — Seed + Testes + Docs

#### Seed

4 produtores, 3 participantes (SC), 5 IEs, 6 vínculos fazenda:

- **Org 1:** Carlos Eduardo Silva (PF), Agropecuária Bom Futuro (PJ), Sociedade Irmãos Silva (SC com 3 participantes)
- **Org 2:** João Carlos Mendes (PF)

#### Testes

42 testes em `producers.routes.spec.ts` cobrindo:

- Auth guard e permission checks
- CRUD produtor (3 tipos, validações)
- Participantes SC (CPF, soma %)
- CRUD IEs (duplicata, UF)
- IE padrão por fazenda
- Vínculos produtor-fazenda
- Reverse lookup fazenda→produtores
- Audit log em mutações

## Arquivos

### Novos (6)

- `prisma/migrations/20260304100000_add_producers/migration.sql`
- `src/modules/producers/producers.types.ts`
- `src/modules/producers/producers.service.ts`
- `src/modules/producers/producers.routes.ts`
- `src/modules/producers/producers.routes.spec.ts`
- `docs/implementacao/US-013_cadastro-produtor-rural.md`

### Modificados (4)

- `prisma/schema.prisma` — 6 enums, 5 modelos, relations em Organization e Farm
- `prisma/seed.ts` — dados de produtores, participantes, IEs e vínculos
- `src/app.ts` — mount producersRouter
- `src/shared/rbac/permissions.ts` — add producers module (8 módulos × 4 ações)

## Decisões

1. **VALID_UF duplicada em producers.types.ts** — Mantida no módulo (mesma abordagem de farms.types.ts) para evitar acoplamento. Pode ser extraída para shared se mais módulos precisarem.
2. **Reverse endpoint em producersRouter** — O `GET /org/farms/:farmId/producers` fica no producersRouter (usa `farms:read` permission) em vez de no farmsRouter para manter o módulo coeso.
3. **IE number validação simplificada** — Formato 8-14 dígitos. Validação por UF (cada estado tem formato diferente) não implementada nesta etapa.
