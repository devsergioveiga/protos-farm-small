# US-003 CA5 — Destruição e recriação de ambiente dev em < 30 minutos

## Objetivo

Garantir que o ambiente de desenvolvimento pode ser completamente destruído e recriado em menos de 30 minutos, com verificação automatizada de saúde dos serviços e medição de tempo.

## O que foi feito

### 1. Script `infra/scripts/reset-dev.sh`

Script shell que automatiza o ciclo completo de destruição e recriação:

| Etapa       | Descrição                                                                       |
| ----------- | ------------------------------------------------------------------------------- |
| Validações  | Verifica se Docker está instalado e o daemon está rodando                       |
| Destruição  | `docker compose down -v --remove-orphans` — remove containers, volumes e órfãos |
| Recriação   | `docker compose up -d` — sobe todos os serviços em background                   |
| Healthcheck | Poll em loop até todos os containers reportarem `healthy` (timeout: 120s)       |
| Relatório   | Imprime tempo total e status dos serviços via `docker compose ps`               |

Características do script:

- **Idempotente** — pode ser executado a qualquer momento, mesmo sem containers rodando
- **Auto-localizável** — navega até a raiz do projeto independente de onde é chamado
- **Fail-fast** — `set -euo pipefail` garante que erros interrompem a execução
- **Timeout configurável** — constante `HEALTH_TIMEOUT` no topo do script (padrão: 120s)

### 2. Atualização do `package.json`

O script `infra:reset` foi atualizado para usar o novo script:

```json
"infra:reset": "bash infra/scripts/reset-dev.sh"
```

Os scripts `infra:up` e `infra:down` continuam disponíveis para operações individuais.

## Como usar

```bash
# Reset completo (destruição + recriação + verificação)
pnpm infra:reset

# Ou diretamente
bash infra/scripts/reset-dev.sh
```

Saída esperada:

```
[INFO]  Iniciando reset do ambiente dev — 2026-02-26 10:00:00
[INFO]  Derrubando containers e removendo volumes...
[INFO]  Subindo serviços...
[INFO]  Aguardando healthchecks (timeout: 120s)...
[INFO]  Ambiente dev recriado com sucesso!
[INFO]  Tempo total: 0m 12s

NAME                   ... STATUS
protos-farm-postgres   ... Up (healthy)
protos-farm-redis      ... Up (healthy)
```

## Performance observada

Com Docker local (imagens já em cache):

- **Destruição (down -v):** ~1-2 segundos
- **Recriação (up -d):** ~2-3 segundos
- **Healthchecks:** ~10-30 segundos (PostgreSQL leva mais que Redis)
- **Total típico:** ~15-35 segundos

Mesmo com pull de imagens (primeira execução), o tempo total fica abaixo de 5 minutos — muito dentro do limite de 30 minutos.

## Critério de aceite

> **CA5:** A destruição e recriação completa do ambiente de desenvolvimento deve ser possível em menos de 30 minutos.

**Atendido.** O script automatiza o ciclo completo com verificação de saúde e medição de tempo. O tempo típico é de ~30 segundos com imagens em cache.
