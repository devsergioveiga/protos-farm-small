# US-004 CA1 — Prometheus coletando métricas de CPU, memória, latência de endpoints

## Objetivo

Instrumentar o backend com métricas Prometheus (CPU, memória, latência HTTP) e subir o Prometheus no Docker Compose para scrape automático.

## O que foi feito

### 1. `middleware/metrics.ts` (novo)

Módulo de métricas usando `prom-client` v15:

| Componente                | Descrição                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------- |
| `collectDefaultMetrics()` | Coleta automática de CPU, memória (heap, RSS), event loop lag, GC                     |
| `httpRequestDuration`     | Histogram customizado com labels `method`, `route`, `status_code`                     |
| `metricsMiddleware`       | Express middleware — inicia timer por request, registra duração no `res.on('finish')` |
| `metricsHandler`          | Handler para `GET /metrics` — retorna métricas no formato OpenMetrics                 |

O middleware exclui `/metrics` do tracking para evitar auto-referência. A rota é extraída de `req.route?.path` para evitar cardinality explosion com path params dinâmicos.

Buckets do histogram seguem padrão Prometheus: `[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]` segundos.

### 2. `app.ts` (modificado)

- `metricsMiddleware` adicionado após helmet/cors/json, antes das rotas
- `GET /metrics` registrado na raiz (fora do `/api`) — convenção Prometheus para facilitar discovery

### 3. `middleware/metrics.spec.ts` (novo)

Testes com supertest contra o app real:

| Teste                                                                     | Verifica                                    |
| ------------------------------------------------------------------------- | ------------------------------------------- |
| Status 200 com content-type prometheus                                    | Endpoint funciona e retorna formato correto |
| Contém métricas default (`process_cpu_`, `process_resident_memory_bytes`) | Default metrics coletadas                   |
| Contém `http_request_duration_seconds` após request                       | Histogram customizado registra latência     |
| Não rastreia `/metrics` no histogram                                      | Auto-exclusão funciona                      |

### 4. `infra/prometheus/prometheus.yml` (novo)

Configuração do Prometheus:

- Scrape interval: 15s
- Target: `host.docker.internal:3000` (backend roda no host)
- Job: `protos-farm-backend`

### 5. `docker-compose.yml` (modificado)

Serviço `prometheus` adicionado:

- Imagem: `prom/prometheus:v2.51.0`
- Porta: 9090
- Volume para config (read-only) e dados persistentes
- `extra_hosts: host.docker.internal:host-gateway` para portabilidade Linux

## Métricas disponíveis

| Métrica                         | Tipo      | Origem                 |
| ------------------------------- | --------- | ---------------------- |
| `process_cpu_*`                 | Gauge     | Default metrics        |
| `process_resident_memory_bytes` | Gauge     | Default metrics        |
| `nodejs_heap_size_*`            | Gauge     | Default metrics        |
| `nodejs_eventloop_lag_*`        | Histogram | Default metrics        |
| `http_request_duration_seconds` | Histogram | Middleware customizado |

## Dependências adicionadas

- `prom-client@^15.1.0` — client oficial Prometheus para Node.js

## Como verificar

```bash
# Backend com métricas
pnpm --filter @protos-farm/backend dev
curl localhost:3000/metrics

# Prometheus
docker compose up -d prometheus
# Acessar http://localhost:9090/targets → target backend com status UP

# Testes
pnpm --filter @protos-farm/backend test
```

## Decisões técnicas

1. **`prom-client` vs alternativas** — Client oficial, mantido ativamente, suporta OpenMetrics, e `collectDefaultMetrics()` cobre CPU/memória/event loop sem código extra.

2. **`GET /metrics` na raiz** — Convenção Prometheus. Separa métricas da API de negócio (`/api`), facilita scrape config e service discovery.

3. **Histogram com buckets padrão** — Buckets `[0.005..10]` cobrem desde APIs rápidas (<5ms) até operações lentas (10s), distribuição adequada para análise de percentis (p50, p95, p99).

4. **`host.docker.internal`** — Backend roda no host (não em container). Essa abordagem é a correta para dev, e `extra_hosts` garante compatibilidade Linux (macOS/Windows resolvem nativamente).
