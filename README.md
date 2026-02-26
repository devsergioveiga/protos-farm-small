# Protos Farm

Sistema de gerenciamento de fazendas — monorepo com backend, frontend web e app mobile.

## Pré-requisitos

| Ferramenta | Versão mínima | Instalação                                                    |
| ---------- | ------------- | ------------------------------------------------------------- |
| Node.js    | 20+           | [nodejs.org](https://nodejs.org/)                             |
| pnpm       | 10+           | `corepack enable && corepack prepare pnpm@10.27.0 --activate` |
| Git        | 2.x           | [git-scm.com](https://git-scm.com/)                           |

> **Nota:** O projeto usa `corepack` (incluso no Node.js) para gerenciar a versão do pnpm. Ao rodar `corepack enable`, o pnpm será disponibilizado automaticamente na versão definida em `packageManager` do `package.json`.

## Setup local

```bash
# 1. Clonar o repositório
git clone <url-do-repositorio>
cd protos-farm-small

# 2. Instalar dependências (todos os workspaces)
pnpm install

# 3. Verificar que tudo está configurado
pnpm lint
pnpm format:check
```

## Rodando os workspaces

### Backend (Express + TypeScript)

```bash
pnpm dev:backend
# API disponível em http://localhost:3000
# Health check: GET http://localhost:3000/api/health
```

### Frontend (Vite + React)

```bash
pnpm dev:frontend
# App disponível em http://localhost:5173
```

### Mobile (Expo + React Native)

```bash
pnpm dev:mobile
# Abre o Expo DevTools — escaneie o QR code com o app Expo Go
```

## Estrutura do monorepo

```
protos-farm-small/
├── apps/
│   ├── backend/     → @protos-farm/backend   (Express 5 + TypeScript)
│   ├── frontend/    → @protos-farm/frontend   (Vite + React 19)
│   └── mobile/      → @protos-farm/mobile     (Expo SDK 52 + React Native)
├── packages/
│   └── shared/      → @protos-farm/shared     (tipos e utilitários compartilhados)
├── infra/           → Docker, configs de infra
└── docs/            → Documentação do projeto
```

## Scripts disponíveis (root)

| Script                | Descrição                                         |
| --------------------- | ------------------------------------------------- |
| `pnpm dev:backend`    | Inicia o backend em modo dev (hot reload via tsx) |
| `pnpm dev:frontend`   | Inicia o frontend em modo dev (Vite)              |
| `pnpm dev:mobile`     | Inicia o app mobile (Expo)                        |
| `pnpm build:backend`  | Compila o backend (TypeScript → JavaScript)       |
| `pnpm build:frontend` | Compila o frontend (Vite build)                   |
| `pnpm lint`           | Roda ESLint em todos os workspaces                |
| `pnpm lint:fix`       | Roda ESLint com auto-fix em todos os workspaces   |
| `pnpm format`         | Formata todo o código com Prettier                |
| `pnpm format:check`   | Verifica formatação (útil para CI)                |
| `pnpm test`           | Roda testes em todos os workspaces                |
| `pnpm clean`          | Remove artefatos de build de todos os workspaces  |

## Qualidade de código

- **ESLint 9** com flat config — linting de TypeScript em todos os workspaces
- **Prettier** — formatação automática (single quotes, trailing commas, 100 chars)
- **Husky + lint-staged** — pre-commit hook roda ESLint e Prettier nos arquivos staged

## Tech stack

- **Backend:** Express 5, TypeScript, tsx (dev server)
- **Frontend:** Vite, React 19, TypeScript
- **Mobile:** React Native 0.76, Expo SDK 52, Expo Router
- **Shared:** Pacote de tipos e utilitários compartilhados
- **Monorepo:** pnpm workspaces
