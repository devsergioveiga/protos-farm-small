# US-003 — CA1: Docker Compose com PostgreSQL+PostGIS e Redis

## O que foi feito

### 1. `docker-compose.yml` (raiz)

Criado arquivo Docker Compose com dois serviços:

- **postgres** — `postgis/postgis:16-3.4` (PostgreSQL 16 + extensão PostGIS 3.4)
  - Porta 5432 exposta para dev local
  - Volume `pgdata` para persistência entre restarts
  - Healthcheck com `pg_isready` para garantir que o serviço está pronto
  - Variáveis parametrizadas via `.env` (com defaults seguros para dev)

- **redis** — `redis:7-alpine`
  - Porta 6379 exposta para dev local
  - Volume `redisdata` para persistência
  - Healthcheck com `redis-cli ping`

### 2. `.env.example` (raiz)

Arquivo de referência com todas as variáveis usadas pelo Docker Compose. O dev copia para `.env` (já ignorado no `.gitignore`) e ajusta se necessário. O `docker-compose.yml` usa `${VAR:-default}` para que funcione mesmo sem `.env` (defaults seguros para dev local).

### 3. `infra/docker/Dockerfile.backend`

Dockerfile multi-stage para o backend:

- **Build stage**: Node 20 Alpine + pnpm, compila shared e backend
- **Production stage**: Apenas dependências de produção + artefatos compilados

Este Dockerfile não é usado em dev local (usamos `tsx` diretamente), mas prepara a estrutura para deploy containerizado futuro (K8s, ECS, etc.).

### 4. `apps/backend/.env.example` (atualizado)

- `DATABASE_URL` descomentado com valor padrão apontando para o PostgreSQL do Docker Compose
- `REDIS_URL` adicionado com valor padrão para o Redis do Docker Compose

### 5. Scripts no root `package.json`

| Script        | Comando                                          | Descrição                     |
| ------------- | ------------------------------------------------ | ----------------------------- |
| `infra:up`    | `docker compose up -d`                           | Sobe infra em background      |
| `infra:down`  | `docker compose down`                            | Para os containers            |
| `infra:reset` | `docker compose down -v && docker compose up -d` | Destrói volumes e recria tudo |

## Por quê

A US-003 pede provisionamento de infraestrutura (banco, cache, storage). Em fase MVP, Docker Compose oferece:

1. **Zero custo** — roda localmente sem cloud
2. **Reprodutibilidade** — qualquer dev sobe o ambiente com `pnpm infra:up`
3. **Paridade dev/prod** — mesmas versões de PostgreSQL+PostGIS e Redis
4. **Preparação para IaC** — a estrutura `infra/docker/` + Dockerfile já está pronta para quando migrarmos para Terraform/K8s

PostGIS foi escolhido porque o sistema de fazendas precisará de dados geoespaciais (coordenadas de talhões, limites de propriedades, etc.).

## Verificação

```bash
# Subir infra
pnpm infra:up

# Verificar containers healthy
docker compose ps

# Testar PostGIS
docker compose exec postgres psql -U protos -d protos_farm -c "SELECT PostGIS_Version();"

# Testar Redis
docker compose exec redis redis-cli ping

# Limpar tudo
pnpm infra:down    # mantém dados
pnpm infra:reset   # destrói dados e recria
```
