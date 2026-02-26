# US-002 — CA1: Pipeline CI em cada PR

## O que foi feito

1. **Workflow CI** (`.github/workflows/ci.yml`)
   - Trigger: `pull_request` para `main` e `develop`
   - 3 jobs: `lint` → `test` → `build` (build depende dos dois anteriores)
   - Usa `pnpm/action-setup@v4` + `actions/setup-node@v4` com cache de pnpm
   - `concurrency` configurada para cancelar runs anteriores na mesma branch

2. **Configuração de testes — Backend** (`apps/backend/jest.config.js`)
   - Preset `ts-jest`, environment `node`
   - Test match: `**/*.spec.ts`
   - Path alias `@/` mapeado

3. **Configuração de testes — Frontend** (`apps/frontend/vitest.config.ts`)
   - Plugin React, environment `jsdom`
   - Globals habilitados para não precisar importar `describe`/`it`/`expect`

4. **Configuração de testes — Shared** (`packages/shared/jest.config.js`)
   - Preset `ts-jest`, environment `node`

5. **Smoke tests criados:**
   - `apps/backend/src/modules/health/health.routes.spec.ts` — testa GET /api/health
   - `apps/frontend/src/App.spec.tsx` — verifica renderização do heading
   - `packages/shared/src/index.spec.ts` — verifica constantes exportadas

## Por que

- O CI garante que toda PR passa por lint, testes e build antes de merge
- Jobs paralelos (lint + test) com build sequencial otimizam tempo sem sacrificar corretude
- Smoke tests validam que a infraestrutura de testes funciona em cada workspace

## Mudanças estruturais

- `apps/backend/src/app.ts` extraído de `main.ts` para permitir testes HTTP com supertest sem iniciar o servidor
- `apps/mobile/package.json`: `test` script atualizado para `jest --passWithNoTests` (mobile não tem testes ainda)

## Dependências adicionadas

- `supertest` + `@types/supertest` no backend
- `@testing-library/react` + `@testing-library/dom` + `jsdom` no frontend
