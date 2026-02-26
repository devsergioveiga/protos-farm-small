# US-001 CA3 — Linting (ESLint/Prettier) e formatação com pre-commit hooks

**Data:** 2026-02-26
**Status:** Concluído

## O que foi feito

Configurado ESLint 9 + Prettier + Husky + lint-staged para garantir qualidade e consistência de código em todo o monorepo desde o início do desenvolvimento.

## Stack de ferramentas

| Ferramenta                | Versão | Propósito                                    |
| ------------------------- | ------ | -------------------------------------------- |
| ESLint                    | ^9.39  | Linting de código TypeScript                 |
| @eslint/js                | ^9.39  | Regras recomendadas do ESLint                |
| typescript-eslint         | ^8.56  | Suporte TypeScript para ESLint               |
| eslint-config-prettier    | ^10.1  | Desabilita regras que conflitam com Prettier |
| eslint-plugin-react       | ^7.37  | Regras React (frontend e mobile)             |
| eslint-plugin-react-hooks | ^7.0   | Regras para hooks do React                   |
| globals                   | ^17.3  | Variáveis globais (node, browser)            |
| Prettier                  | ^3.8   | Formatação automática de código              |
| Husky                     | ^9.1   | Git hooks                                    |
| lint-staged               | ^16.2  | Lint apenas em arquivos staged               |

## Arquivos criados

### ESLint configs

- `eslint.config.mjs` (root) — Config base: ESLint recommended + TypeScript recommended + Prettier override
- `apps/backend/eslint.config.mjs` — Estende root + `globals.node`
- `apps/frontend/eslint.config.mjs` — Estende root + React plugin + `globals.browser`
- `apps/mobile/eslint.config.mjs` — Estende root + React plugin + `globals.node` (React Native)
- `packages/shared/eslint.config.mjs` — Estende root + `globals.node`

### Prettier configs

- `.prettierrc` — Configurações de formatação (single quotes, trailing commas, 100 chars, etc.)
- `.prettierignore` — Ignora node_modules, dist, build, coverage, .expo, pnpm-lock.yaml

### Husky + lint-staged

- `.husky/pre-commit` — Executa `pnpm exec lint-staged`
- `lint-staged` no root `package.json`:
  - `*.{ts,tsx}` → `eslint --fix` + `prettier --write`
  - `*.{json,md,yml,yaml,css,html}` → `prettier --write`

## Scripts adicionados

### Root (`package.json`)

| Script         | Comando              | Descrição                            |
| -------------- | -------------------- | ------------------------------------ |
| `lint:fix`     | `pnpm -r lint:fix`   | Fix recursivo em todos os workspaces |
| `format`       | `prettier --write .` | Formata todo o codebase              |
| `format:check` | `prettier --check .` | Verifica formatação (CI)             |
| `prepare`      | `husky`              | Instala hooks após `pnpm install`    |

### Cada workspace

| Script     | Descrição                       |
| ---------- | ------------------------------- |
| `lint:fix` | ESLint com `--fix` no workspace |

## Decisões de design

### Por que ESLint 9 com flat config?

- ESLint 9 é a versão estável atual e usa flat config (`eslint.config.mjs`) por padrão.
- Flat config é mais simples e explícita que `.eslintrc` — sem herança implícita.
- Config compartilhada via import direto do arquivo root (sem necessidade de pacote npm separado).

### Por que NÃO usar type-checked rules?

- Rules type-checked (`tseslint.configs.recommendedTypeChecked`) requerem `parserOptions.project` e executam o type-checker do TS em cada lint.
- Isso é lento (duplica o trabalho do `tsc`) e adiciona complexidade sem ganho proporcional — `strict: true` no `tsconfig` já cobre a maioria dos erros de tipo.

### Por que Prettier separado do ESLint?

- `eslint-config-prettier` desabilita todas as regras de formatação do ESLint, delegando 100% ao Prettier.
- Isso evita conflitos entre ESLint e Prettier e mantém responsabilidades separadas: ESLint para lógica, Prettier para estilo.

### Por que lint-staged em vez de lint completo no pre-commit?

- Lint completo em monorepo é lento e bloqueia o developer.
- lint-staged executa apenas nos arquivos que foram modificados (staged), tornando o commit rápido.

## Verificação

- `pnpm lint` — passa sem erros em todos os workspaces
- `pnpm format:check` — nenhum arquivo pendente de formatação
- `pnpm --filter backend dev` — backend continua funcionando normalmente
- Pre-commit hook configurado para executar lint-staged automaticamente
