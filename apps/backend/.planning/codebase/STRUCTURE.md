# Codebase Structure

**Analysis Date:** 2026-03-15

## Directory Layout

```
protos-farm/
├── apps/
│   ├── backend/               # Express API (TypeScript)
│   │   ├── src/
│   │   │   ├── app.ts         # Express app setup (middleware + routes)
│   │   │   ├── main.ts        # Entry point
│   │   │   ├── preload.ts     # Environment validation
│   │   │   ├── config/        # Configuration files
│   │   │   ├── database/      # Prisma client, RLS, Redis
│   │   │   ├── middleware/    # Auth, authorization, metrics, rate limit
│   │   │   ├── modules/       # Domain modules
│   │   │   ├── shared/        # Utilities, RBAC, audit, mail
│   │   │   └── types/         # Type augmentations
│   │   ├── prisma/
│   │   │   ├── schema.prisma  # Prisma schema (models + enums)
│   │   │   ├── migrations/    # Database migrations
│   │   │   └── fixtures/      # Seed data
│   │   ├── __tests__/         # E2E tests
│   │   └── package.json
│   ├── frontend/              # Vite + React (TypeScript)
│   │   ├── src/
│   │   │   ├── App.tsx        # Router setup
│   │   │   ├── main.tsx       # DOM mount + providers
│   │   │   ├── components/    # UI components + feature components
│   │   │   ├── pages/         # Page components (1 per route)
│   │   │   ├── hooks/         # Custom hooks
│   │   │   ├── stores/        # React Context providers
│   │   │   ├── services/      # API client
│   │   │   ├── types/         # Frontend-only types
│   │   │   ├── styles/        # CSS, design tokens
│   │   │   ├── utils/         # Utilities
│   │   │   ├── assets/        # Images, fonts
│   │   │   └── constants/     # UI constants
│   │   └── package.json
│   └── mobile/                # React Native + Expo (TypeScript)
│       ├── app/               # Expo Router file-based routes
│       │   ├── _layout.tsx    # Root layout
│       │   ├── (auth)/        # Auth screens
│       │   ├── (app)/         # Protected app screens
│       │   │   ├── (tabs)/    # Bottom tab navigation
│       │   │   └── *.tsx      # Feature screens
│       ├── components/        # Reusable components
│       ├── hooks/             # Custom hooks
│       ├── services/          # API client
│       ├── stores/            # State management
│       ├── types/             # Mobile-only types
│       ├── utils/             # Utilities
│       └── package.json
├── packages/
│   └── shared/                # Shared types, constants, utils
│       ├── src/
│       │   ├── index.ts       # Main export
│       │   ├── types/         # Shared type definitions
│       │   ├── constants/     # Shared constants (design tokens, etc.)
│       │   ├── utils/         # Shared utilities
│       │   └── validators/    # Shared validation functions
│       └── package.json
├── docs/                      # Project documentation
│   ├── design-system/         # UI/UX design documentation
│   ├── implementacao/         # Implementation notes per US
│   └── README.md
├── infra/                     # Infrastructure
│   ├── docker/                # Docker configurations
│   └── scripts/               # Deployment/setup scripts
├── package.json               # Root workspace package
├── pnpm-workspace.yaml        # pnpm workspace config
├── pnpm-lock.yaml             # Lockfile
├── CLAUDE.md                  # Code instructions for AI
└── README.md
```

## Directory Purposes

**apps/backend/src/modules/:**

- Purpose: Domain-driven modules, one per business domain
- Contains: Route handlers, services, types, test data for that domain
- Pattern: Each module `{domain}/` contains `{domain}.routes.ts`, `{domain}.service.ts`, `{domain}.types.ts`
- Example: `modules/animals/` (animals.routes.ts, animals.service.ts, animals.types.ts, **fixtures**/)

**apps/backend/src/middleware/:**

- Purpose: Cross-cutting concerns applied to all or specific routes
- Contains: `auth.ts`, `authorize.ts`, `check-farm-access.ts`, `metrics.ts`, `rate-limit.ts`, `request-logger.ts`
- Each file: One middleware function + helpers

**apps/backend/src/shared/:**

- Purpose: Utilities and services shared across modules
- Contains:
  - `utils/` — logger, password validation, file parsing, geo calculations
  - `rbac/` — permissions system, role hierarchy
  - `audit/` — audit log recording
  - `mail/` — email sending

**apps/backend/src/database/:**

- Purpose: Database access and management
- Contains: `prisma.ts` (client), `redis.ts` (Redis), `rls.ts` (RLS context), `migrations/` (Prisma migrations)

**apps/backend/prisma/:**

- Purpose: Database schema and seed data
- Contains: `schema.prisma` (Prisma data model), `migrations/` (versioned DDL), `fixtures/` (seed data)
- Migrations: Numbered by timestamp, applied sequentially

**apps/frontend/src/components/:**

- Purpose: Reusable UI building blocks
- Organization:
  - `components/ui/` — Primitives (Button, Input, Card, Modal, etc.)
  - `components/{domain}/` — Feature-specific components
- Pattern: Each component lives in its own folder with `Component.tsx`, `Component.spec.tsx`, `Component.css`, `index.ts`

**apps/frontend/src/pages/:**

- Purpose: Page-level components mapped to routes
- Pattern: One file per route, component name matches route path
- Example: `FarmsPage.tsx` for `/farms` route, `AnimalDetailPage.tsx` for `/animals/:id`

**apps/frontend/src/hooks/:**

- Purpose: Reusable stateful logic
- Naming: `use{Feature}.ts`
- Example: `useFarms.ts` (fetches farms list), `useFarmMap.ts` (manages map state)

**apps/frontend/src/stores/:**

- Purpose: Application-wide state
- Contains: `AuthContext.tsx` (user auth state), `FarmContext.tsx` (selected farm)
- Pattern: React Context providers + consumer hooks

**apps/frontend/src/services/:**

- Purpose: HTTP client and API integration
- Contains: Axios/fetch instance setup, API base client
- Example: `api.ts` initializes HTTP client with auth interceptors

**apps/mobile/app/:**

- Purpose: File-based routing (Expo Router)
- Structure:
  - `_layout.tsx` — Root stack navigator
  - `(auth)/` — Auth screens (login, password reset)
  - `(app)/` — Protected app with nested navigation
    - `(tabs)/` — Bottom tab navigation
    - Other feature screens at `(app)` level
- Pattern: Each `*.tsx` file or `*/index.tsx` becomes a route

**packages/shared/src/types/:**

- Purpose: Type definitions used across backend, frontend, mobile
- Contains: API request/response types, domain models, enums
- Example: `User`, `Farm`, `Animal`, `Operation`, etc.

**packages/shared/src/constants/:**

- Purpose: Shared constants and design tokens
- Contains: `design-tokens.ts` (colors, spacing, typography), `role-permissions.ts`

## Key File Locations

**Entry Points:**

- Backend: `apps/backend/src/main.ts` (Express server startup)
- Frontend: `apps/frontend/src/main.tsx` (React DOM render)
- Mobile: `apps/mobile/app/_layout.tsx` (Expo Router root)

**Configuration:**

- Backend environment: `apps/backend/src/config/env.ts` (loads and validates .env)
- Frontend build: `apps/frontend/vite.config.ts`
- Mobile: `apps/mobile/app.json` (Expo configuration)

**Core Logic:**

- Backend API routes: `apps/backend/src/app.ts` (all route registrations)
- Frontend routing: `apps/frontend/src/App.tsx` (React Router setup)
- Database ORM: `apps/backend/prisma/schema.prisma` (all models)

**Testing:**

- Backend unit: `apps/backend/src/modules/*/[module].spec.ts` or `.service.spec.ts`
- Backend E2E: `apps/backend/__tests__/`
- Frontend: `apps/frontend/src/**/*.spec.tsx`
- Mobile: `apps/mobile/**/*.spec.tsx`

## Naming Conventions

**Files:**

- Component: PascalCase (e.g., `FarmCard.tsx`, `AnimalForm.tsx`)
- Service/hook: camelCase (e.g., `useFarms.ts`, `authService.ts`)
- Type/constant: camelCase or UPPER_SNAKE_CASE (e.g., `farmTypes.ts`, `COLORS.ts`)
- Route module: lowercase with hyphens (e.g., `animal-health.routes.ts`)
- Test: Same name as source + `.spec.ts` suffix (e.g., `farms.service.spec.ts`)

**Directories:**

- Domain modules: kebab-case plural (e.g., `field-operations`, `animal-lots`)
- Feature folders: kebab-case (e.g., `components/bulk-import`, `components/farm-form`)
- Exported components: match component name (e.g., `FarmCard/index.ts` exports `FarmCard`)

**Types:**

- Models/DTOs: PascalCase (e.g., `Farm`, `Animal`, `CreateFarmInput`)
- Enums: PascalCase values (e.g., `UserRole.ADMIN`, `FarmStatus.ACTIVE`)
- Utility types: camelCase with Type suffix (e.g., `ApiResponse<T>`, `ListQuery`)

**Variables:**

- Constants: UPPER_SNAKE_CASE (e.g., `MAX_FILE_SIZE`, `DEFAULT_PAGE_SIZE`)
- Functions: camelCase (e.g., `calculateArea()`, `validateEmail()`)
- React state: camelCase (e.g., `const [selectedFarm, setSelectedFarm] = useState()`)

## Where to Add New Code

**New Feature (full stack):**

- Backend: Create `src/modules/{domain}/` with routes, service, types, fixtures
- Frontend: Create `src/pages/{Feature}Page.tsx`, `src/components/{domain}/` for UI
- Mobile: Create `app/(app)/{feature}.tsx`
- Shared types: Add to `packages/shared/src/types/{domain}.ts`

**New Backend Module:**

1. Create directory: `apps/backend/src/modules/{new-domain}/`
2. Create files:
   - `{domain}.routes.ts` — Express router with endpoints
   - `{domain}.service.ts` — Business logic
   - `{domain}.types.ts` — Input/output types
   - `{domain}.routes.spec.ts` — Route tests
   - `__fixtures__/` — Test data
3. Register router in `apps/backend/src/app.ts`: `app.use('/api', newDomainRouter)`

**New Frontend Page:**

1. Create: `src/pages/{FeatureName}Page.tsx` (export default function)
2. Create style: `src/pages/{FeatureName}Page.css`
3. Create test: `src/pages/{FeatureName}Page.spec.tsx`
4. Register in `App.tsx` router:
   ```tsx
   const FeaturePage = lazy(() => import('@/pages/FeaturePage'));
   // In Routes:
   <Route
     path="/feature"
     element={
       <ProtectedRoute>
         <FeaturePage />
       </ProtectedRoute>
     }
   />;
   ```

**New Frontend Component:**

1. Create folder: `src/components/{domain}/{ComponentName}/`
2. Create files:
   - `{ComponentName}.tsx` (export default function)
   - `{ComponentName}.css` (styling)
   - `{ComponentName}.spec.tsx` (tests)
   - `index.ts` (export)
3. Import in page: `import { ComponentName } from '@/components/{domain}/{ComponentName}'`

**New React Hook:**

1. Create: `src/hooks/use{Feature}.ts`
2. Structure:
   ```typescript
   export function use{Feature}() {
     const [state, setState] = useState();
     const { data, loading, error } = useQuery();
     return { state, data, loading, error };
   }
   ```
3. Use in components: `const { data, loading } = use{Feature}()`

**New Mobile Screen:**

1. Create file: `app/(app)/{screen-name}.tsx` (file becomes route)
2. Or create folder: `app/(app)/{screen-name}/index.tsx`
3. Export default function component
4. Use Expo Router navigation: `<Link href="/screen-name">Go</Link>`

## Special Directories

**apps/backend/prisma/migrations/:**

- Purpose: Versioned database schema changes
- Generated: Automatically by `prisma migrate dev`
- Committed: Yes (essential for schema reproduction)
- Never modify existing migrations — create new ones

**apps/backend/**tests**/:**

- Purpose: End-to-end integration tests
- Generated: No (developer-written)
- Committed: Yes
- Setup: Jest with custom config, may require test database

**apps/frontend/src/types/:**

- Purpose: Frontend-only types not shared with backend
- Generated: No
- Committed: Yes
- Example: Component prop types, store state shapes

**docs/implementacao/:**

- Purpose: Implementation notes per user story
- Generated: No (manual documentation)
- Committed: Yes
- Format: Markdown with code snippets, decisions, gotchas

---

_Structure analysis: 2026-03-15_
