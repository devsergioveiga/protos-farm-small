# US-002 — CA2: CD deploy automático para staging

## O que foi feito

1. **Workflow CD Staging** (`.github/workflows/cd-staging.yml`)
   - Trigger: `push` para branch `develop`
   - Job: checkout → install → build → deploy (placeholder)
   - Environment: `staging` (pode ser configurado no GitHub para aprovações)
   - Concurrency: apenas um deploy por vez, cancela anteriores

## Por que

- Todo merge em `develop` deve resultar em deploy automático para staging
- O workflow é um esqueleto — o step de deploy será completado quando a infraestrutura (US-003) for implementada
- Secrets de deploy serão referenciados via `${{ secrets.* }}`, nunca hardcoded

## Pendências

- Configurar environment `staging` no GitHub (Settings → Environments)
- Implementar step real de deploy após US-003
