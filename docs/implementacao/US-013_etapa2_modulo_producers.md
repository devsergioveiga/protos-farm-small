# US-013 — Etapa 2: Módulo `producers`

## O que foi implementado

Módulo completo de produtores rurais com 17 endpoints, RBAC, validações fiscais, sub-recursos (participantes, IEs, vínculos) e audit log.

## Estrutura

```
src/modules/producers/
├── producers.types.ts      — ProducerError, constantes, interfaces
├── producers.service.ts    — Business logic com withRlsContext
├── producers.routes.ts     — Router com authenticate + checkPermission
└── producers.routes.spec.ts — 42 testes
```

## RBAC

Módulo `producers` adicionado a `PermissionModule`, `ALL_MODULES` e `DEFAULT_ROLE_PERMISSIONS`:

| Role                                           | Permissões                     |
| ---------------------------------------------- | ------------------------------ |
| SUPER_ADMIN / ADMIN                            | Full CRUD (via allPermissions) |
| MANAGER                                        | Full CRUD                      |
| AGRONOMIST / FINANCIAL / CONSULTANT / OPERATOR | Read only                      |
| COWBOY                                         | Nenhuma                        |

## 17 endpoints

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

## Validações

- **PF:** name + CPF obrigatórios (reusa `isValidCPF`)
- **PJ:** name + CNPJ obrigatórios (reusa `isValidCNPJ`)
- **SC:** name obrigatório, document null, participantes com soma ≤ 100%
- **UF:** reutiliza constante `VALID_UF`
- **IE:** unique por (producerId, number, state); formato 8-14 dígitos
- **spouseCpf, legalRepCpf:** validados se fornecidos

## Decisões

1. **VALID_UF duplicada em producers.types.ts** — Mantida no módulo (mesma abordagem de farms.types.ts) para evitar acoplamento. Pode ser extraída para shared se mais módulos precisarem.
2. **Reverse endpoint em producersRouter** — O `GET /org/farms/:farmId/producers` fica no producersRouter (usa `farms:read` permission) em vez de no farmsRouter para manter o módulo coeso.
3. **IE number validação simplificada** — Formato 8-14 dígitos. Validação por UF (cada estado tem formato diferente) não implementada nesta etapa.

## Arquivos

### Novos

- `src/modules/producers/producers.types.ts`
- `src/modules/producers/producers.service.ts`
- `src/modules/producers/producers.routes.ts`
- `src/modules/producers/producers.routes.spec.ts`

### Modificados

- `src/app.ts` — mount producersRouter
- `src/shared/rbac/permissions.ts` — add producers module (8 módulos × 4 ações)
