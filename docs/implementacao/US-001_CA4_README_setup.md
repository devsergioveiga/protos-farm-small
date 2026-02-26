# US-001 CA4 — README com instruções de setup local

**Data:** 2026-02-26
**Status:** Concluído

## O que foi feito

Criado `README.md` na raiz do repositório com instruções completas de setup local, cobrindo pré-requisitos, instalação, execução de cada workspace e scripts disponíveis.

## Conteúdo do README

| Seção                 | O que cobre                                                    |
| --------------------- | -------------------------------------------------------------- |
| Pré-requisitos        | Node.js 20+, pnpm 10+, Git — com versões e links de instalação |
| Setup local           | Clone, `pnpm install`, verificação com lint/format             |
| Rodando os workspaces | Comandos e URLs para backend, frontend e mobile                |
| Estrutura do monorepo | Árvore de diretórios com descrição de cada workspace           |
| Scripts disponíveis   | Tabela completa dos scripts do root `package.json`             |
| Qualidade de código   | ESLint, Prettier, Husky/lint-staged                            |
| Tech stack            | Resumo das tecnologias usadas                                  |

## Arquivos criados

- `README.md` (raiz) — Documentação principal do projeto

## Decisões de design

### Por que um único README na raiz?

- Para o estágio atual do projeto, um README centralizado é suficiente.
- Cada workspace pode ganhar seu próprio README quando tiver setup específico (ex: variáveis de ambiente, migrations de banco).
- Evita duplicação de informação prematura.

### Por que recomendar corepack?

- `corepack` é a forma oficial do Node.js para gerenciar package managers.
- Garante que todos os desenvolvedores usem a mesma versão do pnpm (`packageManager` no `package.json`).
- Elimina problemas de "funciona na minha máquina" por diferença de versão do pnpm.

## Verificação

- `README.md` existe na raiz e é renderizado corretamente no GitHub
- Instruções de setup são executáveis em sequência:
  1. `pnpm install` — instala todas as dependências
  2. `pnpm lint` — passa sem erros
  3. `pnpm format:check` — nenhum arquivo pendente
  4. `pnpm dev:backend` — backend sobe em `http://localhost:3000`
  5. `curl http://localhost:3000/api/health` — responde com status OK

## Próximo critério

**CA5:** Branch protection rules ativas (main e develop)
