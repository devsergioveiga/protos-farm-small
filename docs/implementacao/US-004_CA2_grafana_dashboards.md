# US-004 CA2 — Grafana com Dashboards de Saúde dos Serviços

## O que foi feito

Adicionado Grafana ao stack de observabilidade com provisionamento automático de datasource e dashboard pré-configurado.

## Arquivos criados

### `infra/grafana/provisioning/datasources/prometheus.yml`

- Provisiona Prometheus (`http://prometheus:9090`) como datasource default
- UID fixo (`prometheus`) para referência estável nos dashboards
- Comunicação container-to-container via rede Docker interna

### `infra/grafana/provisioning/dashboards/dashboards.yml`

- Provider que carrega dashboards JSON de `/etc/grafana/dashboards/`
- Atualização automática a cada 30 segundos

### `infra/grafana/dashboards/backend-health.json`

- Dashboard "Protos Farm — Backend Health" com UID fixo `protos-farm-backend-health`
- Padrão: últimos 15 minutos, refresh a cada 10 segundos
- 9 painéis organizados em 3 linhas:

| Painel             | Tipo        | Query PromQL                                     |
| ------------------ | ----------- | ------------------------------------------------ |
| Request Rate       | Time series | `rate(http_request_duration_seconds_count[1m])`  |
| Latency p95        | Time series | `histogram_quantile(0.95, rate(..._bucket[5m]))` |
| Latency p99        | Time series | `histogram_quantile(0.99, rate(..._bucket[5m]))` |
| Error Rate (5xx)   | Time series | `rate(..._count{status_code=~"5.."}[5m])`        |
| CPU Usage          | Gauge       | `rate(process_cpu_seconds_total[1m])`            |
| Memory (RSS)       | Gauge       | `process_resident_memory_bytes`                  |
| Heap Used vs Total | Time series | `nodejs_heap_size_used_bytes` / `_total_bytes`   |
| Event Loop Lag     | Time series | `nodejs_eventloop_lag_seconds`                   |
| Uptime             | Stat        | `time() - process_start_time_seconds`            |

## Arquivos modificados

### `docker-compose.yml`

- Adicionado serviço `grafana` (imagem `grafana/grafana:11.5.2`)
- Porta: `3001:3000` (3001 externa para evitar conflito com backend na 3000)
- Volumes montados: provisioning de datasources, provisioning de dashboards, dashboards JSON, dados persistentes
- Variáveis: credenciais admin/admin, sign-up desabilitado
- `depends_on: prometheus`
- Adicionado volume `grafanadata` para persistência

## Por que provisionamento via arquivos

- **Zero configuração manual:** ao subir o container, datasource e dashboard já estão disponíveis
- **Versionável:** toda configuração do Grafana está no repositório
- **Reproduzível:** qualquer dev que faça `docker compose up` terá o mesmo ambiente
- **UID fixo no datasource:** evita que dashboards quebrem se o Grafana for recriado

## Como verificar

```bash
# Subir toda a infraestrutura
docker compose up -d

# Verificar que Grafana está rodando
curl -s http://localhost:3001/api/health | jq .

# Acessar no navegador
# URL: http://localhost:3001
# Login: admin / admin

# Verificar datasource provisionado
curl -s -u admin:admin http://localhost:3001/api/datasources | jq '.[].name'

# Verificar dashboard provisionado
curl -s -u admin:admin http://localhost:3001/api/search?query=Backend%20Health | jq '.[].title'
```

Para ver dados nos painéis, o backend precisa estar rodando (`pnpm --filter backend dev`) e recebendo requests.

## Decisões técnicas

- **Grafana 11.5.2:** versão estável mais recente com suporte a provisioning v1
- **Porta 3001:** evita conflito com Express (3000) — padrão comum em stacks com Node
- **UID `prometheus` no datasource:** referência estável usada em todos os painéis do dashboard
- **Thresholds nos gauges:** CPU (amarelo 50%, vermelho 80%), memória (amarelo 256MB, vermelho 512MB) — valores razoáveis para desenvolvimento
