# US-002 — CA5: Pipeline CI < 10 minutos

## Estratégias implementadas

1. **Cache de pnpm** — `actions/setup-node@v4` com `cache: pnpm` evita re-download de dependências
2. **Jobs paralelos** — `lint` e `test` rodam em paralelo; `build` só roda após ambos passarem
3. **Concurrency com cancelamento** — PRs atualizadas cancelam runs anteriores da mesma branch
4. **`--frozen-lockfile`** — evita resolução de dependências no CI

## Tempo estimado

Com o setup atual (poucas dependências, 3 smoke tests), o pipeline deve completar em ~2-3 minutos:

- Install + cache: ~30s
- Lint: ~10s
- Test: ~5s
- Build: ~30s

## Monitoramento

- Verificar tempo real após primeira execução no GitHub Actions
- Se ultrapassar 5 minutos, investigar qual job está lento
