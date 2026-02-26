# US-002 — CA3: Deploy produção via tag release

## O que foi feito

1. **Workflow CD Production** (`.github/workflows/cd-production.yml`)
   - Trigger: `push` de tags `v*` (ex: `v0.1.0`, `v1.0.0`)
   - Job com `environment: production` — requer aprovação manual configurada no GitHub
   - Steps: checkout → install → build → deploy (placeholder)

## Por que

- Deploy em produção deve ser explícito (via tag) e requerer aprovação humana
- O padrão de tags semânticas (`v*`) segue convenção de versionamento
- O workflow é um esqueleto — será completado com US-003

## Como usar

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Pendências

- Configurar environment `production` no GitHub com required reviewers
- Implementar step real de deploy após US-003
