# US-004 CA3 — Logs centralizados (Loki) com busca funcional

## Objetivo

Implementar logging estruturado no backend com agregação centralizada e busca funcional via Grafana, completando a tríade de observabilidade (métricas + logs + health checks).

## Stack escolhida

| Componente   | Tecnologia                      | Justificativa                                                         |
| ------------ | ------------------------------- | --------------------------------------------------------------------- |
| Logger       | **pino**                        | JSON nativo, ~5x mais rápido que winston, ideal para ingestão em Loki |
| Agregação    | **Grafana Loki 3.4.2**          | Complemento natural do Grafana, zero custo, 100% local                |
| Coleta       | **Grafana Promtail 3.4.2**      | Coleta logs dos containers Docker via volume mount                    |
| Visualização | **Grafana Explore + Dashboard** | Busca por labels, texto livre, LogQL                                  |

### Arquitetura do fluxo

```
Backend (pino JSON → stdout) → Docker logs → Promtail → Loki → Grafana Explore
```

## Arquivos criados

### `apps/backend/src/shared/utils/logger.ts`

Instância pino configurada com:

- **Level**: `debug` em dev, `info` em staging/production
- **Transport**: `pino-pretty` em dev (output legível no terminal)
- **Base fields**: `service: "backend"`, `environment: NODE_ENV`

### `apps/backend/src/middleware/request-logger.ts`

Middleware Express que loga cada request no `res.on('finish')`:

- Campos: `method`, `url`, `status_code`, `response_time_ms`
- Nível por status: `info` (2xx/3xx), `warn` (4xx), `error` (5xx)
- Endpoints excluídos (polling): `/metrics`, `/api/health/live`

### `apps/backend/src/middleware/request-logger.spec.ts`

5 testes unitários:

- Loga `info` para respostas 2xx
- Loga `warn` para respostas 4xx
- Loga `error` para respostas 5xx
- Pula `/metrics`
- Pula `/api/health/live`

### `infra/loki/loki-config.yml`

Configuração do Loki:

- Storage: filesystem local (`/loki/chunks`)
- Schema: TSDB v13
- Retenção: 7 dias com compactor habilitado
- Porta: 3100

### `infra/promtail/promtail-config.yml`

Configuração do Promtail:

- Scrape: logs Docker via `/var/lib/docker/containers`
- Pipeline: parse Docker JSON → extract campos pino (`level`, `service`, `msg`)
- Labels extraídos para queries no Grafana

### `infra/grafana/provisioning/datasources/loki.yml`

Datasource Loki provisionado automaticamente:

- URL: `http://loki:3100`
- UID fixo: `loki`

### `infra/grafana/dashboards/backend-logs.json`

Dashboard "Protos Farm — Backend Logs" com 3 painéis:

1. **Log Stream** — busca por texto livre (variável `$search`) e labels
2. **Requests by Status Code** — bar chart via LogQL `count_over_time`
3. **Errors & Warnings** — filtro por `level =~ (error|warn|50|40)`

## Arquivos modificados

### `apps/backend/package.json`

- `pino` (runtime dependency)
- `pino-pretty` (devDependency — output legível em dev)

### `apps/backend/src/app.ts`

- Import e registro do `requestLoggerMiddleware` (após `metricsMiddleware`)

### `apps/backend/src/main.ts`

- `console.log` substituído por `logger.info({ port }, 'Backend running')`

### `docker-compose.yml`

- Serviço `loki` (grafana/loki:3.4.2) — porta 3100, volume `lokidata`, healthcheck
- Serviço `promtail` (grafana/promtail:3.4.2) — volumes Docker socket + containers
- Grafana: `depends_on` atualizado para incluir `loki`
- Volume `lokidata` adicionado

## Verificação

```bash
# 1. Lint + testes (sem regressões)
pnpm lint    # ✅ passa
pnpm test    # ✅ 21 testes passam (5 novos do request-logger)

# 2. Subir infraestrutura
docker compose up -d

# 3. Backend em dev (logs JSON estruturado no terminal via pino-pretty)
pnpm --filter backend dev

# 4. Grafana → Explore → Loki
#    Query: {compose_service="protos-farm-backend"}
#    → Retorna logs estruturados do backend

# 5. Dashboard "Backend Logs"
#    → 3 painéis funcionais com busca por texto e filtro por level
```

## Decisões de design

1. **pino-pretty apenas em dev** — Em staging/production, pino emite JSON puro que Loki ingere sem parsing extra
2. **Endpoints excluídos** — `/metrics` (Prometheus scrape) e `/api/health/live` (liveness probe) geram muito ruído; excluídos do request logger
3. **Promtail via Docker socket** — Não requer alteração nos containers; coleta logs de todos os serviços automaticamente
4. **Retenção 7 dias** — Adequado para ambiente dev; em produção seria configurável via variável de ambiente
