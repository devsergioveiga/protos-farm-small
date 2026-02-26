# US-003 CA2 — Ambientes dev, staging e prod com configs separadas

## Objetivo

Criar configurações separadas por ambiente (development, staging, production) para que o sistema
se comporte de forma adequada em cada contexto, com fail-fast para variáveis obrigatórias ausentes.

## O que foi implementado

### 1. Arquivos de configuração por ambiente (`infra/env/`)

| Arquivo           | Propósito                                      |
| ----------------- | ---------------------------------------------- |
| `.env.dev`        | Valores padrão para desenvolvimento local      |
| `.env.staging`    | Placeholders para staging (secrets no GitHub)  |
| `.env.production` | Placeholders para produção (secrets no GitHub) |

Todas as variáveis são consistentes entre os três arquivos:
`NODE_ENV`, `PORT`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`,
`POSTGRES_DB`, `REDIS_HOST`, `REDIS_PORT`.

Secrets reais (passwords, etc.) **nunca são commitados** — ficam nos GitHub Environments
(`staging` e `production`), já configurados nos workflows de CD da US-002.

### 2. Módulo de configuração do backend (`apps/backend/src/config/env.ts`)

- **`loadEnv(processEnv?)`** — função pura que centraliza leitura de variáveis de ambiente
- Tipagem TypeScript completa via interface `Env`
- Defaults inteligentes por `NODE_ENV`:
  - `development`: todos os valores têm default (zero-config local)
  - `staging`/`production`: host/port têm defaults, mas `POSTGRES_USER`, `POSTGRES_PASSWORD`
    e `POSTGRES_DB` são **obrigatórios** (fail-fast com mensagem clara)
- Aceita `processEnv` como parâmetro para facilitar testes (inversão de dependência)

### 3. Testes (`apps/backend/src/config/env.spec.ts`)

- Defaults de development aplicados corretamente
- Override de valores via env vars
- Erro em staging quando variáveis obrigatórias faltam
- Erro em production quando variáveis obrigatórias faltam
- Staging funciona com todas as variáveis obrigatórias preenchidas
- Defaults de host corretos em production
- Erro para `NODE_ENV` inválido

### 4. Atualização do `main.ts`

Antes:

```ts
const port = process.env.PORT ?? 3000;
```

Depois:

```ts
import { loadEnv } from './config/env';
const env = loadEnv();
app.listen(env.PORT, () => { ... });
```

O startup agora valida todas as variáveis antes de iniciar o servidor.

### 5. Docker Compose overrides

| Arquivo                      | Propósito                                                            |
| ---------------------------- | -------------------------------------------------------------------- |
| `docker-compose.staging.yml` | Remove portas expostas, usa credenciais staging                      |
| `docker-compose.prod.yml`    | Remove portas expostas, `restart: always`, sem defaults para secrets |

Uso:

```bash
pnpm infra:up:staging  # docker compose -f docker-compose.yml -f docker-compose.staging.yml up -d
pnpm infra:up:prod     # docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 6. Scripts no root `package.json`

- `infra:up:staging` — sobe infra com overrides de staging
- `infra:up:prod` — sobe infra com overrides de produção

## Decisões técnicas

1. **Função pura `loadEnv`** — aceita `processEnv` como parâmetro em vez de ler `process.env`
   diretamente, facilitando testes sem mock global.

2. **Fail-fast apenas em non-dev** — em development, todos os valores têm defaults para
   zero-config. Em staging/production, variáveis sensíveis são obrigatórias.

3. **`!reset` nos overrides do Docker Compose** — limpa o array de portas do compose base,
   evitando exposição de portas em ambientes remotos.

4. **Sem `.env` no repositório** — os arquivos em `infra/env/` servem como documentação e
   referência. Secrets reais ficam nos GitHub Environments.

## Verificação

```bash
# Lint e testes passam
pnpm lint && pnpm test

# Configs distintas por ambiente
cat infra/env/.env.dev
cat infra/env/.env.staging
cat infra/env/.env.production

# Fail-fast funciona
NODE_ENV=staging node -e "require('./apps/backend/dist/config/env').loadEnv()"
# → Error: Missing required environment variables for staging: ...

# Docker Compose merge correto
docker compose -f docker-compose.yml -f docker-compose.staging.yml config
```
