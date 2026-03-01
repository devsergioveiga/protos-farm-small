# US-012 — Etapa 2: Módulo `farms`

## O que foi implementado

Módulo completo de fazendas com CRUD, matrículas como sub-recurso, validações de dados fundiários e alerta de divergência de área.

## Estrutura

```
src/modules/farms/
├── farms.types.ts      — FarmError, constantes (VALID_UF, CIB_REGEX), interfaces
├── farms.service.ts    — Business logic com withRlsContext
├── farms.routes.ts     — Router com authenticate + checkPermission + checkFarmAccess
└── farms.routes.spec.ts — 30+ testes unitários
```

## Endpoints

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

## Validações

- **UF:** 27 estados brasileiros válidos
- **CIB:** Formato `XXX.XXX.XXX-X` (regex)
- **Classificação fundiária:** MINIFUNDIO, PEQUENA, MEDIA, GRANDE
- **Área:** Deve ser > 0 (farm e matrículas)
- **Limite de fazendas:** Verifica `org.maxFarms` antes de criar
- **Organização ativa:** Verifica `org.status === 'ACTIVE'`

## Alerta de divergência de área

Ao criar/editar/excluir matrículas, o sistema calcula se a soma das áreas das matrículas diverge mais de 5% da `totalAreaHa` da fazenda. Retorna `areaDivergence: { divergent: boolean, percentage: number }` na resposta.

## Padrões seguidos

- `withRlsContext(ctx)` em todas as funções de serviço
- `buildRlsContext(req)` nas rotas
- `FarmError extends Error { statusCode }` para erros de negócio
- `void logAudit(...)` fire-and-forget após mutações
- `checkFarmAccess()` middleware nos endpoints que recebem `:farmId`

## Decisões

1. **Upload de documentos adiado:** Tabela `farm_documents` criada como esqueleto. Implementação do upload requer storage (S3/MinIO) que ainda não está configurado.
2. **PostGIS via raw SQL:** Campos `location` e `boundary` são `Unsupported` no Prisma, então coordenadas são inseridas/atualizadas via `$executeRawUnsafe`.
3. **UserFarmAccess para criador:** Ao criar fazenda, o criador recebe acesso automaticamente.
4. **checkFarmAccess mockado nos testes:** O middleware é testado separadamente; nos testes de rotas, é mockado para focar na lógica de negócio.

## Arquivos

### Novos

- `src/modules/farms/farms.types.ts`
- `src/modules/farms/farms.service.ts`
- `src/modules/farms/farms.routes.ts`
- `src/modules/farms/farms.routes.spec.ts`

### Modificados

- `src/app.ts` — registro do `farmsRouter`
