# US-004 CA5 — Health check endpoints

## Objetivo

Implementar endpoints de health check no backend prontos para Kubernetes (liveness/readiness probes) e futura integração com Prometheus/Grafana. Como frontend e mobile são SPAs/apps cliente, o escopo é apenas o backend.

## O que foi feito

### 1. `health.service.ts` (novo)

Serviço responsável pela verificação de saúde das dependências externas:

| Função                          | Descrição                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `checkTcp(host, port, timeout)` | Helper genérico — abre socket TCP e verifica se a conexão é aceita dentro do timeout |
| `checkPostgres()`               | Verifica se PostgreSQL está acessível via TCP usando `POSTGRES_HOST:POSTGRES_PORT`   |
| `checkRedis()`                  | Verifica se Redis está acessível via TCP usando `REDIS_HOST:REDIS_PORT`              |
| `getHealthStatus()`             | Agrega todos os checks e retorna status geral com versão, uptime e timestamp         |

A abordagem TCP socket (`net.createConnection`) foi escolhida porque ainda não há drivers (pg, ioredis) instalados. Quando forem adicionados em US futuras, os checks podem evoluir para queries reais (`SELECT 1`, `PING`).

### 2. `health.routes.ts` (modificado)

Três endpoints implementados:

| Endpoint                | Tipo      | Comportamento                                                  | HTTP Status                     |
| ----------------------- | --------- | -------------------------------------------------------------- | ------------------------------- |
| `GET /api/health`       | Geral     | Status agregado + versão + uptime + checks de cada dependência | 200 (healthy) / 503 (unhealthy) |
| `GET /api/health/live`  | Liveness  | Processo está rodando — sem I/O, retorna imediato              | Sempre 200                      |
| `GET /api/health/ready` | Readiness | Verifica PostgreSQL e Redis via TCP                            | 200 (healthy) / 503 (unhealthy) |

Formato de resposta do `/api/health`:

```json
{
  "status": "healthy",
  "version": "0.1.0",
  "uptime": 123.45,
  "timestamp": "2026-02-26T00:00:00.000Z",
  "checks": {
    "postgres": { "status": "healthy", "responseTime": 5 },
    "redis": { "status": "healthy", "responseTime": 2 }
  }
}
```

### 3. `health.routes.spec.ts` (modificado)

Testes atualizados com mock do `health.service`:

| Teste                         | Cenário                                   |
| ----------------------------- | ----------------------------------------- |
| `GET /api/health` — 200       | Todos os checks healthy                   |
| `GET /api/health` — 503       | Pelo menos um check unhealthy             |
| `GET /api/health/live` — 200  | Sempre retorna healthy (sem dependências) |
| `GET /api/health/ready` — 200 | Todas as dependências acessíveis          |
| `GET /api/health/ready` — 503 | Pelo menos uma dependência inacessível    |

## Arquivos criados/modificados

| Arquivo                                                 | Ação       |
| ------------------------------------------------------- | ---------- |
| `apps/backend/src/modules/health/health.service.ts`     | Criado     |
| `apps/backend/src/modules/health/health.routes.ts`      | Modificado |
| `apps/backend/src/modules/health/health.routes.spec.ts` | Modificado |

## Como testar

```bash
# Testes unitários
pnpm test

# Com infra rodando (Docker Compose)
pnpm infra:up
curl http://localhost:3000/api/health       # 200 com checks healthy
curl http://localhost:3000/api/health/live   # 200 sempre
curl http://localhost:3000/api/health/ready  # 200 com infra up

# Sem infra
pnpm infra:down
curl http://localhost:3000/api/health       # 503 com checks unhealthy
curl http://localhost:3000/api/health/ready  # 503
```
