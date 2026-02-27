# US-004 CA4 — Alertas configurados (serviço down, latência > 2s, erro 5xx > 1%)

## Objetivo

Configurar alertas automáticos para os 3 cenários críticos de monitoramento:

1. **Serviço down** — backend inacessível por mais de 1 minuto
2. **Latência alta** — p95 acima de 2 segundos por mais de 2 minutos
3. **Taxa de erros 5xx** — acima de 1% por mais de 2 minutos

## Decisão técnica

### Prometheus AlertManager

Escolhemos o **AlertManager** (componente oficial do ecossistema Prometheus) por:

- Regras em YAML versionáveis (GitOps-friendly)
- Agrupamento e deduplicação nativa de alertas
- Suporte a múltiplos receivers (webhook, email, Slack, PagerDuty)
- Integração nativa com Grafana como datasource

### Fluxo de alertas

```
Prometheus (avalia regras a cada 15s)
    → AlertManager (agrupa por alertname+severity, roteia)
        → Webhook receiver (dev) / Slack/email (prod)

Grafana (visualiza alertas ativos via AlertManager datasource)
```

## Arquivos criados

### 1. `infra/prometheus/alert-rules.yml`

Três regras de alerta no grupo `protos-farm`:

| Alerta             | Expressão PromQL                                                               | For | Severidade |
| ------------------ | ------------------------------------------------------------------------------ | --- | ---------- |
| `ServiceDown`      | `up{job="protos-farm-backend"} == 0`                                           | 1m  | critical   |
| `HighLatencyP95`   | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2` | 2m  | warning    |
| `HighErrorRate5xx` | `rate(5xx) / rate(total) > 0.01`                                               | 2m  | warning    |

- **`for`**: tempo mínimo que a condição deve permanecer verdadeira antes de disparar
- **`severity`**: label usado para roteamento e priorização
- **`annotations`**: summary e description para contexto humano

### 2. `infra/alertmanager/alertmanager.yml`

Configuração do AlertManager:

- **Receiver**: `webhook` apontando para `http://host.docker.internal:9095/alerts`
  - Em dev, nenhum serviço escuta nessa porta (alertas ficam visíveis no AlertManager UI)
  - Em prod, seria substituído por Slack/email/PagerDuty
- **Agrupamento**: por `alertname` e `severity`
- **Timings**: `group_wait: 10s`, `group_interval: 30s`, `repeat_interval: 1h`

### 3. `infra/grafana/provisioning/datasources/alertmanager.yml`

Datasource AlertManager provisionado automaticamente no Grafana:

- UID fixo: `alertmanager`
- Implementação: `prometheus` (tipo de AlertManager)

### 4. `infra/grafana/dashboards/alerts-overview.json`

Dashboard "Protos Farm — Alerts Overview" com 4 painéis:

| Painel         | Tipo       | Descrição                                        |
| -------------- | ---------- | ------------------------------------------------ |
| Active Alerts  | alertlist  | Lista de alertas ativos/pending do AlertManager  |
| Target Status  | stat       | UP/DOWN do backend com cores verde/vermelho      |
| Latency p95    | timeseries | Gráfico de latência com threshold line em 2s     |
| Error Rate 5xx | timeseries | Gráfico de taxa de erro com threshold line em 1% |

## Arquivos modificados

### 5. `infra/prometheus/prometheus.yml`

Adicionadas duas seções:

```yaml
rule_files:
  - alert-rules.yml

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

### 6. `docker-compose.yml`

- **Novo serviço `alertmanager`**: `prom/alertmanager:v0.27.0`, porta 9093, healthcheck
- **Prometheus**: volume adicional para `alert-rules.yml`, `depends_on: alertmanager`
- **Grafana**: `depends_on` inclui `alertmanager`

## Verificação

### Pré-requisitos

```bash
pnpm lint    # sem erros (nenhum código backend alterado)
pnpm test    # sem regressões
```

### Infraestrutura

```bash
docker compose up -d
```

### Checklist

- [ ] AlertManager rodando: http://localhost:9093
- [ ] Prometheus Rules: http://localhost:9090/rules → grupo `protos-farm` com 3 regras
- [ ] Prometheus Alerts: http://localhost:9090/alerts → 3 alertas (inactive/pending/firing)
- [ ] Grafana → Dashboard "Alerts Overview" → 4 painéis funcionais
- [ ] Grafana → Configuration → Data Sources → AlertManager presente

### Testando alertas manualmente

Para testar `ServiceDown`, pare o backend:

```bash
# Backend parado → após ~1min, alerta dispara
# Verificar em http://localhost:9090/alerts → ServiceDown = firing
```

Para testar `HighLatencyP95`, envie requests lentas:

```bash
# Simular endpoint lento no backend (se disponível)
# Ou verificar que a regra está em "inactive" quando latência normal
```
