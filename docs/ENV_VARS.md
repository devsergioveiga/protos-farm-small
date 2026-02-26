# Variáveis de Ambiente — Protos Farm

Referência centralizada de todas as variáveis de ambiente utilizadas pelo projeto.

## Arquivos de configuração

| Arquivo                          | Propósito                                                  |
| -------------------------------- | ---------------------------------------------------------- |
| `.env.example`                   | Template com todas as variáveis e valores padrão           |
| `infra/env/.env.dev`             | Valores para desenvolvimento local                         |
| `infra/env/.env.staging`         | Valores para staging (secrets no GitHub Environments)      |
| `infra/env/.env.production`      | Valores para produção (secrets no GitHub Environments)     |
| `apps/backend/src/config/env.ts` | Módulo `loadEnv` — carrega, valida e tipifica as variáveis |

## Tabela de variáveis

| Variável            | Descrição                 | Tipo                                       | Obrigatória?           | Default (dev) | Default (staging/prod) | Onde configurar (não-dev) |
| ------------------- | ------------------------- | ------------------------------------------ | ---------------------- | ------------- | ---------------------- | ------------------------- |
| `NODE_ENV`          | Ambiente de execução      | `development` \| `staging` \| `production` | Não                    | `development` | —                      | Arquivo `.env.*`          |
| `PORT`              | Porta do servidor backend | `number`                                   | Não                    | `3000`        | `3000`                 | Arquivo `.env.*`          |
| `POSTGRES_HOST`     | Host do PostgreSQL        | `string`                                   | Não                    | `localhost`   | `postgres`             | Arquivo `.env.*`          |
| `POSTGRES_PORT`     | Porta do PostgreSQL       | `number`                                   | Não                    | `5432`        | `5432`                 | Arquivo `.env.*`          |
| `POSTGRES_USER`     | Usuário do PostgreSQL     | `string`                                   | **Sim** (staging/prod) | `protos`      | —                      | GitHub Secrets            |
| `POSTGRES_PASSWORD` | Senha do PostgreSQL       | `string`                                   | **Sim** (staging/prod) | `protos`      | —                      | GitHub Secrets            |
| `POSTGRES_DB`       | Nome do banco de dados    | `string`                                   | **Sim** (staging/prod) | `protos_farm` | —                      | GitHub Secrets            |
| `REDIS_HOST`        | Host do Redis             | `string`                                   | Não                    | `localhost`   | `redis`                | Arquivo `.env.*`          |
| `REDIS_PORT`        | Porta do Redis            | `number`                                   | Não                    | `6379`        | `6379`                 | Arquivo `.env.*`          |

> **Nota:** Variáveis marcadas como obrigatórias em staging/prod causam erro na inicialização se ausentes. Em desenvolvimento, possuem defaults seguros para uso local.

## Como adicionar uma nova variável

1. **Definir no tipo `Env`** em `apps/backend/src/config/env.ts` — adicionar o campo na interface `Env`.
2. **Adicionar defaults** no objeto `DEFAULTS` (por ambiente) em `env.ts`.
3. **Resolver no `loadEnv`** — adicionar a leitura de `processEnv.NOVA_VAR` com fallback para o default.
4. **Se for sensível** (credenciais, tokens), adicionar em `REQUIRED_IN_NON_DEV` para forçar configuração explícita em staging/prod.
5. **Atualizar os arquivos `.env`:**
   - `.env.example` (raiz) — com valor de exemplo e comentário.
   - `infra/env/.env.dev` — com valor de desenvolvimento.
   - `infra/env/.env.staging` — com placeholder (`CHANGE_ME_IN_GITHUB_SECRETS` se sensível).
   - `infra/env/.env.production` — com placeholder.
6. **Atualizar esta documentação** (`docs/ENV_VARS.md`) — adicionar linha na tabela.
7. **Adicionar testes** em `apps/backend/src/config/env.spec.ts` para a nova variável.
