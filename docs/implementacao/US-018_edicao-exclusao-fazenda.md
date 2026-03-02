# US-018: Edição e Exclusão de Fazenda

## Resumo

Implementa exclusão lógica (soft delete) de fazendas com confirmação em duas etapas, versionamento de perímetro no re-upload, e restrição de RBAC para exclusão.

## O que foi implementado

### Etapa 1: Migration

- **Soft delete:** campo `deletedAt` (TIMESTAMPTZ) na tabela `farms` com índice
- **Boundary versioning:** nova tabela `farm_boundary_versions` com campos id, farmId, registrationId, boundary (geometry), boundaryAreaHa, uploadedBy, uploadedAt, filename, version
- **RLS:** policy `tenant_isolation_policy` via join com `farms` para isolamento multi-tenant

### Etapa 2: Backend

**RBAC restrito:**

- MANAGER: `farms:create`, `farms:read`, `farms:update` (sem `delete`)
- Apenas SUPER_ADMIN e ADMIN possuem `farms:delete`

**Soft delete (`DELETE /org/farms/:farmId`):**

- Middleware: authenticate + checkPermission('farms:delete') + checkFarmAccess
- Exige `confirmName` no body — case-insensitive match com o nome da fazenda
- Verifica dependências ativas (TODO: safras, animais, financeiro — tabelas ainda não existem)
- Se bloqueado: retorna 422 com lista de dependências
- Se OK: seta `deletedAt = now()`
- `listFarms` filtra `deletedAt: null`
- `getFarm` retorna 404 se `deletedAt` != null

**Boundary versioning:**

- `uploadFarmBoundary` e `uploadRegistrationBoundary` agora recebem `actorId`
- Antes de sobrescrever, se boundary existe, salva versão anterior em `farm_boundary_versions`
- `getBoundaryVersions(ctx, farmId, registrationId?)` retorna histórico ordenado por version DESC
- Endpoints: `GET /org/farms/:farmId/boundary/versions` e `GET /org/farms/:farmId/registrations/:regId/boundary/versions`

**Testes:** 424 backend tests (9 novos)

### Etapa 3: Frontend

**ConfirmDeleteModal:**

- Modal destrutivo conforme design system
- Input para digitar nome da fazenda
- Botão "Excluir fazenda" habilitado somente quando input === farmName (case-insensitive)
- Focus trap, Escape fecha, aria-modal, role="dialog"

**FarmsPage:**

- Botão Trash2 em cada FarmCard (visível apenas se `permissions` inclui `farms:delete`)
- Abre ConfirmDeleteModal → chama `api.deleteWithBody` → refetch lista

**api.ts:**

- Novo método `deleteWithBody<T>(path, body)` — DELETE com JSON body

**Testes:** 47 frontend tests (11 novos: 8 ConfirmDeleteModal + 3 FarmsPage)

## Endpoints novos/modificados

| Método | Rota                                                        | Permissão      | Descrição                                      |
| ------ | ----------------------------------------------------------- | -------------- | ---------------------------------------------- |
| DELETE | `/org/farms/:farmId`                                        | `farms:delete` | Soft delete com confirmação                    |
| GET    | `/org/farms/:farmId/boundary/versions`                      | `farms:read`   | Histórico de versões do perímetro              |
| GET    | `/org/farms/:farmId/registrations/:regId/boundary/versions` | `farms:read`   | Histórico de versões do perímetro da matrícula |

## Arquivos modificados/criados

| Ação | Arquivo                                                              |
| ---- | -------------------------------------------------------------------- |
| NEW  | `prisma/migrations/20260307100000_.../migration.sql`                 |
| MOD  | `prisma/schema.prisma`                                               |
| MOD  | `src/shared/rbac/permissions.ts`                                     |
| MOD  | `src/modules/farms/farms.types.ts`                                   |
| MOD  | `src/modules/farms/farms.service.ts`                                 |
| MOD  | `src/modules/farms/farms.routes.ts`                                  |
| MOD  | `src/modules/farms/farms.routes.spec.ts`                             |
| MOD  | `src/middleware/check-permission.spec.ts`                            |
| NEW  | `frontend/src/components/confirm-delete/ConfirmDeleteModal.tsx`      |
| NEW  | `frontend/src/components/confirm-delete/ConfirmDeleteModal.css`      |
| NEW  | `frontend/src/components/confirm-delete/ConfirmDeleteModal.spec.tsx` |
| MOD  | `frontend/src/services/api.ts`                                       |
| MOD  | `frontend/src/pages/FarmsPage.tsx`                                   |
| MOD  | `frontend/src/pages/FarmsPage.css`                                   |
| MOD  | `frontend/src/pages/FarmsPage.spec.tsx`                              |
| NEW  | `docs/implementacao/US-018_edicao-exclusao-fazenda.md`               |

## Contagem de testes

- Backend: 424 testes (era 415)
- Frontend: 47 testes (era 36)
- **Total: 471 testes**
