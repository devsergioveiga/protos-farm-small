# US-011 — Etapa 3: Testes RLS

## O que foi implementado

12 testes dedicados para validar o comportamento do RLS e atualização de todos os testes existentes para funcionar com os novos wrappers.

## Testes novos (`src/__tests__/rls-isolation.spec.ts`)

12 testes cobrindo:

- `withRlsContext` seta `app.current_org_id` corretamente
- `withRlsBypass` seta `app.bypass_rls` corretamente
- Transações separadas têm contextos independentes
- Contextos concorrentes não se interferem

## Testes existentes atualizados

- `check-farm-access.spec.ts` — mock atualizado para `withRlsBypass`
- `audit.service.spec.ts` — mock atualizado para `withRlsBypass`
- `org-users.routes.spec.ts` — assertions atualizadas para `RlsContext`
- `roles.routes.spec.ts` — assertions atualizadas para `RlsContext`

## Verificação

1. `pnpm --filter @protos-farm/backend test` — 19 suites, 266 testes passando
2. `tsc --noEmit` — compilação limpa
3. Seed roda com RLS ativo (bypass setado no início)
4. Login funciona (usa `withRlsBypass`)
5. Rotas org-scoped (`/org/users`, `/org/roles`) usam `withRlsContext`
