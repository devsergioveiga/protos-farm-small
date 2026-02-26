# US-001 CA5 — Branch protection rules ativas (main e develop)

**Data:** 2026-02-26
**Status:** Concluído

## O que foi feito

Repositório criado no GitHub, branches `main` e `develop` protegidas com regras que impedem push direto, force push e deleção.

## Repositório

- **URL:** https://github.com/devsergioveiga/protos-farm-small
- **Visibilidade:** Público (necessário para branch protection no plano Free)
- **Branches:** `main` (default) + `develop`

## Regras configuradas

### Branch `main`

| Regra                               | Valor                                       |
| ----------------------------------- | ------------------------------------------- |
| Require pull request before merging | Sim                                         |
| Required approving reviews          | 1                                           |
| Allow force pushes                  | Não                                         |
| Allow deletions                     | Não                                         |
| Enforce admins                      | Não (owner pode fazer bypass em emergência) |

### Branch `develop`

| Regra                               | Valor                              |
| ----------------------------------- | ---------------------------------- |
| Require pull request before merging | Sim                                |
| Required approving reviews          | 0 (auto-merge via PR sem approval) |
| Allow force pushes                  | Não                                |
| Allow deletions                     | Não                                |
| Enforce admins                      | Não                                |

## Fluxo de trabalho Git

```
feature/* ──PR──► develop ──PR (1 approval)──► main
```

1. **Desenvolvimento:** Criar branch `feature/*` a partir de `develop`
2. **Merge em develop:** Abrir PR para `develop` (sem approval obrigatório — permite fluxo ágil solo)
3. **Merge em main:** Abrir PR de `develop` para `main` (requer 1 approval)
4. **Hotfix:** Criar branch `hotfix/*` a partir de `main`, merge via PR

## Decisões de design

### Por que repo público?

- Branch protection rules não estão disponíveis em repos privados no plano Free do GitHub.
- Alternativa seria usar GitHub Pro ou GitHub Organization com plano Team.

### Por que 1 approval em main e 0 em develop?

- `main` é a branch de produção — exige revisão para proteger contra bugs em produção.
- `develop` tem 0 approvals para permitir fluxo ágil em equipe pequena/solo, mas ainda exige PR (para ter histórico e CI).

### Por que enforce_admins = false?

- Permite que o owner faça merge direto em emergências sem precisar de approval.
- Pode ser alterado para `true` quando a equipe crescer.

## Verificação

```bash
# Verificar proteção de main
gh api repos/devsergioveiga/protos-farm-small/branches/main/protection \
  --jq '{force_pushes: .allow_force_pushes.enabled, deletions: .allow_deletions.enabled, pr_reviews: .required_pull_request_reviews.required_approving_review_count}'
# Esperado: {"deletions":false,"force_pushes":false,"pr_reviews":1}

# Verificar proteção de develop
gh api repos/devsergioveiga/protos-farm-small/branches/develop/protection \
  --jq '{force_pushes: .allow_force_pushes.enabled, deletions: .allow_deletions.enabled, pr_reviews: .required_pull_request_reviews.required_approving_review_count}'
# Esperado: {"deletions":false,"force_pushes":false,"pr_reviews":0}
```

## Conclusão US-001

Com CA5 concluído, todos os 5 critérios de aceite da US-001 estão implementados:

- **CA1:** Monorepo com pnpm workspaces
- **CA2:** Estrutura de pastas definida
- **CA3:** ESLint/Prettier/Husky configurados
- **CA4:** README com instruções de setup
- **CA5:** Branch protection rules ativas
