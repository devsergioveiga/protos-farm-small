# US-002 — CA6: Secrets gerenciados via vault

## O que foi feito

1. **`.env.example`** criado em `apps/backend/`
   - Documenta variáveis de ambiente necessárias (PORT, NODE_ENV, DATABASE_URL, JWT_SECRET)
   - Serve como template — devs copiam para `.env` local

2. **Workflows referenciam secrets via `${{ secrets.* }}`**
   - Nenhum valor sensível hardcoded nos workflows
   - Placeholders de deploy indicam onde secrets serão usados

3. **`.gitignore`** já ignora `.env`, `.env.local`, `.env.*.local`

## Padrão de uso

### Local

```bash
cp apps/backend/.env.example apps/backend/.env
# Editar com valores locais
```

### CI/CD

- Secrets configurados em GitHub → Settings → Secrets and variables → Actions
- Cada environment (staging, production) pode ter seus próprios secrets
- Secrets nunca aparecem nos logs do GitHub Actions

## Por que

- GitHub Secrets é o "vault" nativo do GitHub Actions — suficiente para o estágio atual
- `.env.example` documenta quais variáveis são necessárias sem expor valores reais
- Quando o projeto escalar, pode migrar para AWS Secrets Manager, Vault, etc.
