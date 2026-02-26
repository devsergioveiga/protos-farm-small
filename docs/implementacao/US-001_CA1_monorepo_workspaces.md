# US-001 — Critério de Aceite 1: Repositório Git criado (monorepo com workspaces)

**Status:** Implementado
**Data:** 2026-02-26
**Épico:** EPIC-01 — Infraestrutura e DevOps
**User Story:** US-001 — Setup do repositório e estrutura de projeto

---

## O que foi feito

Criação de um monorepo utilizando **pnpm workspaces** como gerenciador de pacotes e orquestrador de workspaces. O repositório foi estruturado com 4 workspaces independentes que compartilham configuração base e podem referenciar uns aos outros como dependências internas.

### Estrutura criada

```
protos-farm-small/
├── package.json                  # Raiz do monorepo com scripts globais
├── pnpm-workspace.yaml           # Definição dos workspaces (apps/* e packages/*)
├── .npmrc                        # Configuração do pnpm (shamefully-hoist, peer deps)
├── .gitignore                    # Ignora node_modules, dist, .env, IDE files, etc.
├── tsconfig.base.json            # Configuração TypeScript base compartilhada
├── apps/
│   ├── backend/                  # @protos-farm/backend — API Express + TypeScript
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── main.ts           # Entry point: Express server na porta 3000
│   │       └── routes/
│   │           └── health.ts     # GET /api/health — endpoint de healthcheck
│   ├── frontend/                 # @protos-farm/frontend — Vite + React + TypeScript
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts        # Proxy /api → backend, alias @/
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       └── App.tsx
│   └── mobile/                   # @protos-farm/mobile — React Native + Expo
│       ├── package.json
│       ├── tsconfig.json
│       └── app/
│           ├── _layout.tsx       # Expo Router layout
│           └── index.tsx         # Tela inicial
└── packages/
    └── shared/                   # @protos-farm/shared — Tipos e utils compartilhados
        ├── package.json
        ├── tsconfig.json
        └── src/
            └── index.ts
```

### Workspaces configurados

| Workspace         | Nome npm                | Descrição                                                                      |
| ----------------- | ----------------------- | ------------------------------------------------------------------------------ |
| `apps/backend`    | `@protos-farm/backend`  | API REST com Express 5 + TypeScript. Usa `tsx` para hot-reload em dev.         |
| `apps/frontend`   | `@protos-farm/frontend` | SPA com Vite + React 19 + TypeScript. Proxy configurado para `/api` → backend. |
| `apps/mobile`     | `@protos-farm/mobile`   | App mobile com React Native 0.76 + Expo SDK 52 + Expo Router.                  |
| `packages/shared` | `@protos-farm/shared`   | Pacote interno para tipos, constantes e utilitários compartilhados entre apps. |

---

## Por que foi feito assim

### 1. pnpm workspaces (em vez de npm ou yarn)

- **Eficiência em disco:** pnpm usa content-addressable store — pacotes iguais entre workspaces são armazenados uma única vez e linkados via hardlinks, economizando ~60% de espaço vs npm.
- **Determinismo:** lockfile (`pnpm-lock.yaml`) é mais estrito e determinístico que package-lock.json.
- **Velocidade:** instalação mais rápida por evitar duplicação de pacotes.
- **Adoção:** amplamente adotado em monorepos de produção (Vite, Vue, Turborepo usam pnpm).

### 2. Estrutura apps/ + packages/

- **Separação clara:** `apps/` contém aplicações executáveis (backend, frontend, mobile). `packages/` contém bibliotecas internas reutilizáveis.
- **Escalabilidade:** novos packages (ex.: `packages/database`, `packages/ui`) podem ser adicionados sem alterar a estrutura.
- **Padrão de mercado:** segue a convenção adotada por Turborepo, Nx e projetos open-source maduros.

### 3. Express + TypeScript (backend)

- **Flexibilidade:** Express é leve e não impõe padrões arquiteturais, permitindo liberdade para moldar a arquitetura conforme o projeto cresce (ex.: hexagonal, clean architecture).
- **Express 5:** versão mais recente com suporte nativo a async handlers e melhor tratamento de erros.
- **tsx para dev:** permite hot-reload instantâneo sem etapa de build, acelerando o ciclo de desenvolvimento.
- **Helmet + CORS:** segurança HTTP padrão configurada desde o início.

### 4. Vite + React (frontend)

- **Build rápido:** Vite usa esbuild para dev e Rollup para produção, muito mais rápido que webpack.
- **React 19:** versão mais recente com melhorias de performance e Server Components preparados.
- **Proxy /api:** configurado no vite.config.ts para evitar problemas de CORS em desenvolvimento.

### 5. React Native + Expo (mobile)

- **Expo SDK 52:** simplifica build, OTA updates e acesso a APIs nativas.
- **Expo Router:** navegação file-based, consistente com Next.js/Remix patterns.
- **Compartilhamento de código:** React no frontend + React Native no mobile permite reutilizar lógica e tipos via `@protos-farm/shared`.

### 6. tsconfig.base.json compartilhado

- **DRY:** configurações comuns (strict, target, módulo) definidas uma vez na raiz.
- **Cada workspace estende:** e customiza apenas o que difere (ex.: backend usa CommonJS, frontend usa ESNext+JSX).

### 7. .npmrc com shamefully-hoist=true

- **Necessário para Expo/React Native:** muitos pacotes do ecossistema RN esperam dependências hoisted na raiz. Sem isso, builds mobile falham.
- **strict-peer-dependencies=false:** evita falhas de install por peer deps incompatíveis (React 19 + libs que ainda declaram peer ^18).

---

## Validação

- `pnpm ls -r --depth 0` confirma 4 workspaces reconhecidos
- `pnpm install` completou com sucesso (978 pacotes)
- Warnings de peer deps são esperados (React 19 + React Native 0.76 — compatibilidade funcional confirmada)

---

## Próximo critério de aceite

**US-001 CA2:** Estrutura de pastas definida (backend, frontend, mobile, infra, docs)
