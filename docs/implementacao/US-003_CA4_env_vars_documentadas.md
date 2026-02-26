# US-003 CA4 — Variáveis de ambiente documentadas e centralizadas

## Critério de aceite

> Todas as variáveis de ambiente estão documentadas em um local centralizado, com descrição, tipo, valores padrão por ambiente e instruções de onde configurar secrets.

## O que foi feito

### 1. `.env.example` atualizado

O arquivo `.env.example` na raiz estava desatualizado — continha apenas `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` e `REDIS_PORT`. Faltavam variáveis fundamentais: `NODE_ENV`, `PORT`, `POSTGRES_HOST`, `POSTGRES_PORT` e `REDIS_HOST`.

**Correção:** sincronizado com todas as variáveis de `infra/env/.env.dev`, organizadas por seção com comentários descritivos e referência à documentação completa.

### 2. `docs/ENV_VARS.md` criado

Documentação centralizada contendo:

- **Mapa de arquivos de configuração** — tabela com cada arquivo `.env` e seu propósito.
- **Tabela de variáveis** — nome, descrição, tipo TypeScript, obrigatoriedade por ambiente, valor default e onde configurar em não-dev.
- **Checklist para adicionar novas variáveis** — passo a passo: tipo `Env` → defaults → `loadEnv` → `REQUIRED_IN_NON_DEV` → arquivos `.env` → documentação → testes.

### 3. Nenhuma alteração em código

Este CA é exclusivamente de documentação. O módulo `loadEnv` e os arquivos `.env.*` por ambiente já foram criados no CA2 e não precisaram de modificação.

## Arquivos criados/modificados

| Arquivo                                                  | Ação                                             |
| -------------------------------------------------------- | ------------------------------------------------ |
| `.env.example`                                           | Atualizado — sincronizado com todas as variáveis |
| `docs/ENV_VARS.md`                                       | Criado — referência centralizada de variáveis    |
| `docs/implementacao/US-003_CA4_env_vars_documentadas.md` | Criado — esta documentação                       |

## Verificação

- `pnpm lint && pnpm test` — sem regressão
- `.env.example` contém as 9 variáveis que `loadEnv` espera
- `docs/ENV_VARS.md` documenta cada variável com tipo, default e local de configuração
