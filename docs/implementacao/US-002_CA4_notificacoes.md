# US-002 — CA4: Notificações de falha

## O que foi feito

O GitHub Actions já envia notificações por email automaticamente quando um workflow falha. Não é necessário configuração adicional no workflow.

## Configuração necessária pelo desenvolvedor

Cada membro do time deve verificar suas notification settings:

1. GitHub → Settings → Notifications
2. Em **Actions**, garantir que "Failed workflows only" ou "All workflows" está selecionado
3. Opcionalmente, configurar notificações para email ou web

## Por que

- O GitHub já provê notificações nativas para Actions — não há necessidade de integração externa (Slack, etc.) neste momento
- Quando o time crescer, pode-se considerar integração com Slack via webhook no workflow
