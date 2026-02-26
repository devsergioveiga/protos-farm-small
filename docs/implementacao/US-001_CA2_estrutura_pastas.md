# US-001 CA2 — Estrutura de pastas definida

**Data:** 2026-02-26
**Status:** Concluído

## O que foi feito

Definida a estrutura interna de pastas para todos os workspaces do monorepo, criando a organização que guiará todo o desenvolvimento futuro. Nenhum código funcional novo foi adicionado — apenas pastas com `.gitkeep` para persistência no Git.

## Estrutura criada

### Backend (`apps/backend/src/`)

```
src/
├── main.ts
├── config/              → Configurações (env, database, cors, etc.)
├── middleware/           → Express middleware (auth, error-handler, tenant, etc.)
├── modules/             → Módulos de domínio
│   └── health/
│       └── health.routes.ts
├── shared/
│   ├── errors/          → Classes de erro customizadas
│   └── utils/           → Helpers internos
└── database/
    ├── migrations/
    └── seeds/
```

### Frontend (`apps/frontend/src/`)

```
src/
├── main.tsx
├── App.tsx
├── components/ui/       → Componentes base de design system
├── pages/               → Páginas/views (1 pasta por rota principal)
├── hooks/               → Custom React hooks
├── services/            → API clients e chamadas HTTP
├── stores/              → State management
├── types/               → TypeScript types/interfaces
├── utils/               → Helpers e funções utilitárias
├── styles/              → CSS global, temas, tokens
└── assets/              → Imagens, ícones, fontes estáticas
```

### Mobile (`apps/mobile/`)

```
mobile/
├── app/                 → Expo Router (já existente)
├── components/ui/       → Componentes base RN
├── hooks/               → Custom hooks
├── services/            → API clients, sync offline
├── stores/              → State management
├── types/               → TypeScript types
├── utils/               → Helpers
└── assets/              → Imagens, ícones, fontes
```

### Shared (`packages/shared/src/`)

```
src/
├── index.ts
├── types/               → Types compartilhados (DTOs, entities)
├── constants/           → Constantes compartilhadas
├── utils/               → Funções utilitárias compartilhadas
└── validators/          → Validações reutilizáveis (zod schemas, etc.)
```

### Infra (`infra/`)

```
infra/
├── docker/              → Dockerfiles e docker-compose
├── scripts/             → Scripts de automação (setup, deploy, seed)
└── env/                 → Templates de variáveis de ambiente (.env.example)
```

### Docs (`docs/`)

```
docs/
├── implementacao/       → Documentação de implementação por US/CA
├── arquitetura/         → Decisões de arquitetura (ADRs)
├── api/                 → Documentação de API (OpenAPI specs)
└── setup/               → Guias de setup e onboarding
```

## Decisões de design

### Por que `modules/` em vez de `controllers/` + `services/` separados?

- **Colocalização:** cada módulo agrupa controller, service, routes e types do mesmo domínio — facilita encontrar código relacionado.
- **Escalabilidade:** ao adicionar US-012 (Fazenda), cria-se `modules/farm/` com tudo dentro.
- **Alinhamento com user stories:** organização por domínio (EPIC-02: auth → `modules/auth/`, EPIC-03: farm → `modules/farm/`).

### Por que `infra/` na raiz?

- Separação clara entre código de aplicação (`apps/`, `packages/`) e infraestrutura.
- Docker, scripts de automação e templates de env não pertencem a nenhum workspace específico.

### Por que `.gitkeep`?

- Git não versiona pastas vazias. `.gitkeep` é uma convenção para garantir que a estrutura de pastas seja preservada no repositório.
- Serão removidos naturalmente quando arquivos reais forem adicionados nas pastas.

## Movimentação realizada

- `apps/backend/src/routes/health.ts` → `apps/backend/src/modules/health/health.routes.ts`
- Import em `main.ts` atualizado de `./routes/health` para `./modules/health/health.routes`
- Pasta `routes/` removida (vazia após movimentação)

## Verificação

- `pnpm --filter backend dev` funciona sem erros
- Health route responde em `GET /api/health`
- Todas as pastas criadas com `.gitkeep`
