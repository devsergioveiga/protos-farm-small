# US-006 CA1 — CRUD de Organizações + Middleware de Autorização

## Resumo

Implementação do CRUD completo de organizações para o painel Super Admin, incluindo middleware de autorização por role, validação de CPF/CNPJ com dígitos verificadores, controle de transições de status com impacto em usuários vinculados, e bloqueio de login quando a organização está suspensa/cancelada.

## Decisões Técnicas

| Decisão          | Escolha                          | Motivo                                               |
| ---------------- | -------------------------------- | ---------------------------------------------------- |
| Autorização      | Middleware `authorize(...roles)` | Reutilizável, composição com `authenticate`          |
| Validação doc    | Algoritmo completo CPF/CNPJ      | Sem dependência externa, dígitos verificadores reais |
| Transição status | State machine hardcoded          | Simples, previsível, sem lib extra                   |
| Impacto users    | `$transaction` no Prisma         | Garante atomicidade org.status + users.status        |
| Rota prefix      | `/admin/organizations`           | Namespace separado para Super Admin                  |
| Bloqueio login   | Check org.status no service      | SUPER_ADMIN bypassa (não vinculado a org)            |

## Critérios de Aceite Cobertos

| #   | Critério                                                  | Implementação                                                    |
| --- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | CRUD completo de organizações                             | 5 endpoints REST (create, list, get, update status, update plan) |
| 2   | Proteção por role SUPER_ADMIN                             | Middleware `authorize('SUPER_ADMIN')` em todos os endpoints      |
| 4   | Suspender/cancelar organização com inativação de usuários | `updateOrganizationStatus` com `$transaction`                    |
| 5   | Validação de CPF/CNPJ                                     | `document-validator.ts` com algoritmo completo                   |
| 6   | Bloqueio de login com org suspensa/cancelada              | Check em `login()` e `refreshTokens()`                           |

## Arquivos Criados

| Arquivo                                                  | Descrição                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/middleware/authorize.ts`                            | Middleware de autorização por role (UserRole[])                    |
| `src/middleware/authorize.spec.ts`                       | 4 testes: sem user, role errado, role correto, múltiplos roles     |
| `src/shared/utils/document-validator.ts`                 | Validação CPF/CNPJ com dígitos verificadores + `cleanDocument`     |
| `src/shared/utils/document-validator.spec.ts`            | 11 testes: CPF/CNPJ válido/inválido, dígitos iguais, length, clean |
| `src/modules/organizations/organizations.service.ts`     | Service com 5 funções CRUD + `OrgError`                            |
| `src/modules/organizations/organizations.routes.ts`      | 5 endpoints REST protegidos por SUPER_ADMIN                        |
| `src/modules/organizations/organizations.routes.spec.ts` | 27 testes: happy paths, validações, erros de negócio, auth guard   |

## Arquivos Modificados

| Arquivo                                | Alteração                                                      |
| -------------------------------------- | -------------------------------------------------------------- |
| `src/app.ts`                           | Registrou `organizationsRouter` em `/api`                      |
| `src/modules/auth/auth.service.ts`     | Adicionou check de org.status em `login()` e `refreshTokens()` |
| `src/modules/auth/auth.routes.spec.ts` | +2 testes: login 403 com org suspensa/cancelada                |

## Endpoints

### POST /api/admin/organizations

**Body:** `{ "name": string, "type": "PF"|"PJ", "document": string, "plan?": string, "maxUsers?": number, "maxFarms?": number }`

**Sucesso (201):** Organização criada

**Erros:** 400 (validação/documento inválido), 409 (documento duplicado)

### GET /api/admin/organizations

**Query:** `?page=1&limit=20&status=ACTIVE&search=nome`

**Sucesso (200):** `{ data: Organization[], meta: { page, limit, total, totalPages } }`

### GET /api/admin/organizations/:id

**Sucesso (200):** Organização com `_count: { users, farms }`

**Erros:** 404

### PATCH /api/admin/organizations/:id/status

**Body:** `{ "status": "ACTIVE"|"SUSPENDED"|"CANCELLED" }`

**Transições permitidas:**

- ACTIVE → SUSPENDED, CANCELLED
- SUSPENDED → ACTIVE, CANCELLED
- CANCELLED → (nenhuma)

**Efeito colateral:** SUSPENDED/CANCELLED → users para INACTIVE; ACTIVE → users de volta para ACTIVE

**Erros:** 400 (status inválido), 404, 422 (transição não permitida)

### PATCH /api/admin/organizations/:id/plan

**Body:** `{ "plan": "basic"|"professional"|"enterprise", "maxUsers?": number, "maxFarms?": number }`

**Erros:** 400 (plano inválido), 404, 422 (limite menor que contagem atual)

## Middleware authorize

```typescript
// Uso: proteger rotas por role
router.get('/admin/resource', authenticate, authorize('SUPER_ADMIN'), handler);

// Múltiplos roles
router.get('/resource', authenticate, authorize('ADMIN', 'MANAGER'), handler);
```

## Bloqueio de Login por Org Suspensa

Adicionado em `login()` e `refreshTokens()`:

- Se `user.role !== 'SUPER_ADMIN'`, verifica `org.status === 'ACTIVE'`
- Se org não existe ou status !== ACTIVE → `AuthError('Organização suspensa ou cancelada', 403)`
- SUPER_ADMIN bypassa o check (não está vinculado a restrições de org)

## Testes

- **Total de testes:** 95 (anteriores: 64 → novos: 31)
- **Suites:** 10 (3 novas + 7 existentes)
- **Build:** TypeScript compila sem erros
