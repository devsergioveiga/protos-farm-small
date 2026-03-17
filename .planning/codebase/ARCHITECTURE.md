# Architecture

**Analysis Date:** 2026-03-15

## Pattern Overview

**Overall:** Monorepo with modular layered architecture.

**Key Characteristics:**

- Three separate applications (backend, frontend, mobile) sharing types and utilities
- Backend uses Express 5 with module-per-domain pattern
- Frontend uses React 19 with context API for state management
- Mobile uses React Native with Expo Router for file-based routing
- Single PostgreSQL database with Prisma 7 ORM and PostGIS extension
- Row-Level Security (RLS) for multi-tenant data isolation
- RBAC with hierarchical role system

## Layers

**API Layer (Backend):**

- Purpose: Expose REST endpoints for all business logic
- Location: `apps/backend/src/modules/*/[module].routes.ts`
- Contains: Express Router definitions, request validation, parameter parsing
- Depends on: Service layer, middleware for auth/validation
- Used by: Frontend and mobile applications

**Service Layer (Backend):**

- Purpose: Encapsulate business logic and data transformations
- Location: `apps/backend/src/modules/*/[module].service.ts`
- Contains: CRUD operations, validations, calculations, integrations
- Depends on: Database (Prisma), shared utilities, constants
- Used by: Route handlers, other services for cross-domain operations

**Middleware Layer (Backend):**

- Purpose: Handle cross-cutting concerns before/after requests
- Location: `apps/backend/src/middleware/*.ts`
- Contains: Authentication (`auth.ts`), authorization (`authorize.ts`), rate limiting, request logging, metrics
- Depends on: Auth service, database
- Used by: Express app configuration in `app.ts`

**Database Layer (Backend):**

- Purpose: Provide ORM abstraction and connection management
- Location: `apps/backend/src/database/`
- Contains: Prisma client initialization, RLS context helpers, Redis connection
- Depends on: Environment configuration
- Used by: All services

**Component Layer (Frontend):**

- Purpose: Render UI and collect user input
- Location: `apps/frontend/src/components/`
- Contains: Presentational components (UI primitives), feature components (business logic wrappers)
- Depends on: Hooks, stores, services
- Used by: Pages

**Page/Route Layer (Frontend):**

- Purpose: Assemble complete page views from components
- Location: `apps/frontend/src/pages/*.tsx`
- Contains: One component per route, page composition
- Depends on: Components, hooks, stores
- Used by: Router in `App.tsx`

**Store/State Layer (Frontend):**

- Purpose: Manage application state
- Location: `apps/frontend/src/stores/`
- Contains: React Context providers (`AuthContext`, `FarmContext`)
- Depends on: API services
- Used by: Components and pages via hooks

**Hook Layer (Frontend):**

- Purpose: Encapsulate reusable stateful logic and API calls
- Location: `apps/frontend/src/hooks/use*.ts`
- Contains: Data fetching, form handling, derived state
- Depends on: Services, stores, React Query patterns
- Used by: Components and pages

**Service Layer (Frontend):**

- Purpose: Handle HTTP communication with backend
- Location: `apps/frontend/src/services/`
- Contains: API client initialization, HTTP requests with error handling
- Depends on: Environment configuration, shared types
- Used by: Hooks

**Shared Package:**

- Purpose: Centralize types, constants, and utilities consumed by all apps
- Location: `packages/shared/src/`
- Contains: Type definitions, design tokens, validators, UI constants
- Depends on: Nothing (leaf dependency)
- Used by: Backend, frontend, mobile

## Data Flow

**Request Flow (Backend → Frontend):**

1. Frontend hook (e.g., `useFarms.ts`) calls service method (e.g., `apiClient.getFarms()`)
2. Service makes HTTP GET request to backend endpoint
3. Express middleware chain processes request:
   - `requestLoggerMiddleware` logs entry
   - `authenticate` validates JWT token
   - `authorize` checks RBAC permissions
   - `metricsMiddleware` records metrics
4. Route handler (`farmsRouter`) receives request
5. Route calls service method with user context
6. Service:
   - Validates input against types from `farms.types.ts`
   - Applies RLS context with `withRlsContext()` to isolate tenant data
   - Queries database via Prisma with geo spatial operations if needed
   - Transforms response to DTO
7. Route handler returns JSON response
8. Frontend hook receives data, updates React state
9. Component re-renders with new data

**Frontend Data Flow (Component → Store → Hook → Service):**

1. Component needs data → calls hook (e.g., `const { farms, loading } = useFarms(farmId)`)
2. Hook manages fetch state and error handling
3. Hook calls service method with parameters
4. Service initiates HTTP request
5. Response flows back through hook to component
6. Component renders based on loading/error/data states

**Authentication Flow:**

1. User logs in via `POST /api/auth/login`
2. Backend validates credentials, returns JWT tokens (access + refresh)
3. Frontend stores access token (session storage or memory)
4. Frontend includes token in `Authorization: Bearer <token>` header on all requests
5. Backend middleware `authenticate` verifies token signature
6. Request proceeds with `req.user` populated from JWT payload
7. On token expiration, frontend calls `POST /api/auth/refresh-tokens`
8. Backend validates refresh token, returns new access token
9. Frontend retries original request with new token

## Key Abstractions

**RLS (Row-Level Security) Context:**

- Purpose: Isolate multi-tenant data at database level
- Files: `apps/backend/src/database/rls.ts`
- Pattern: Services wrap queries with `withRlsContext()` to apply current org/user filters
- Example: `await withRlsContext(userId, farmId, async (txClient) => { ... })`

**Module Pattern:**

- Purpose: Organize code by domain (animals, farms, operations, etc.)
- Files per module: `[module].routes.ts`, `[module].service.ts`, `[module].types.ts`, `__fixtures__/` for test data
- Location: `apps/backend/src/modules/`
- Dependency: Modules are loosely coupled via Prisma queries; cross-domain calls go through services

**Error Handling:**

- Purpose: Standardize error responses
- Pattern: Services throw domain-specific errors (e.g., `FarmError`, `AnimalError`)
- Files: Each module can define custom error classes extending base pattern
- Route handlers catch errors and map to HTTP status codes

**Type System:**

- Purpose: Single source of truth for data shapes
- Location: `packages/shared/src/types/`, `apps/backend/src/modules/*/[module].types.ts`
- Pattern: Backend types are Prisma models; DTOs are derived types in `[module].types.ts`
- Frontend imports from shared and backend API responses match backend types

**RBAC (Role-Based Access Control):**

- Purpose: Fine-grained permission system
- Files: `apps/backend/src/shared/rbac/permissions.ts`, `apps/backend/src/middleware/authorize.ts`
- Pattern: Permissions are `module:action` (e.g., `farms:read`, `animals:create`)
- Roles have hierarchy: SUPER_ADMIN (100) > ADMIN (90) > MANAGER (70) > ... > CONSULTANT (10)

## Entry Points

**Backend Entry Point:**

- Location: `apps/backend/src/main.ts`
- Triggers: `pnpm dev:backend` or `npm start`
- Responsibilities: Load environment, initialize Express app, listen on port 3000

**Backend App Initialization:**

- Location: `apps/backend/src/app.ts`
- Triggers: Imported by `main.ts`
- Responsibilities: Configure Express middleware, register all route modules, export app instance

**Frontend Entry Point:**

- Location: `apps/frontend/src/main.tsx`
- Triggers: `pnpm dev:frontend` (Vite dev server)
- Responsibilities: Mount React app in DOM, initialize providers

**Frontend App Root:**

- Location: `apps/frontend/src/App.tsx`
- Triggers: Rendered by `main.tsx`
- Responsibilities: Set up router, lazy-load pages, wrap with providers (Auth, Farm contexts)

**Mobile Entry Point:**

- Location: `apps/mobile/app/index.tsx` (via Expo Router)
- Triggers: `pnpm start` (Expo server)
- Responsibilities: Route initial deep link or navigate to auth stack

**Mobile App Layout:**

- Location: `apps/mobile/app/_layout.tsx`
- Triggers: Loaded first by Expo Router
- Responsibilities: Set up root stack navigator, initialize fonts and providers

## Error Handling

**Strategy:** Domain-specific errors with descriptive messages in pt-BR.

**Patterns:**

1. **Validation Errors (400):** Input doesn't meet requirements
   - Example: Missing required field, invalid enum value
   - Message: "Campo obrigatório: [field]" or "Valor inválido para [field]: esperado [expected]"

2. **Authentication Errors (401):** Missing or invalid JWT token
   - Example: Expired token, malformed header
   - Message: "Token inválido ou expirado"

3. **Authorization Errors (403):** User lacks permission
   - Example: Non-admin trying to delete farm
   - Message: "Sem permissão para esta ação"

4. **Not Found Errors (404):** Resource doesn't exist
   - Example: Farm with given ID not in user's organization
   - Message: "Recurso não encontrado"

5. **Conflict Errors (409):** Operation violates business rules
   - Example: Duplicate email on user creation
   - Message: "E-mail já cadastrado" or "Talhão se sobrepõe a outro"

6. **Server Errors (500):** Unexpected failure
   - Frontend receives generic message, logs full error server-side

**Implementation:**

- Services define custom error classes or throw descriptive Error instances
- Route handlers catch and map to HTTP status + user-friendly message
- Middleware logs all errors with stack traces in development
- Frontend hooks wrap API calls with try-catch, store error message in state for display

## Cross-Cutting Concerns

**Logging:**

- Tool: Pino (structured JSON logging)
- Location: `apps/backend/src/shared/utils/logger.ts`
- Usage: Services and route handlers call `logger.info()`, `logger.warn()`, `logger.error()`
- Output: Console in development (with pino-pretty), JSON lines in production

**Validation:**

- Location: Backend routes perform manual validation before calling service
- Frontend hooks validate before submission using shared validators from `packages/shared/src/validators/`
- Pattern: Each module's service validates domain rules; routes validate HTTP contract

**Authentication:**

- Middleware: `apps/backend/src/middleware/auth.ts`
- Validates JWT token, populates `req.user` with user ID, email, role, org ID
- All protected routes apply middleware: `router.get('/', authenticate, handler)`

**Authorization:**

- Middleware: `apps/backend/src/middleware/authorize.ts`
- Checks if user role has required permission for action
- Usage: `router.post('/', authenticate, authorize('farms:create'), handler)`

**Audit Logging:**

- Location: `apps/backend/src/shared/audit/`
- Records: User, action, resource, timestamp, changes
- Usage: Service methods call audit log on mutations (create, update, delete)

**Rate Limiting:**

- Tool: Redis-backed sliding window
- Location: `apps/backend/src/middleware/rate-limit.ts`
- Apply to: Login endpoint (incremented on failure), and optionally other sensitive endpoints

**Metrics:**

- Tool: prom-client (Prometheus client)
- Location: `apps/backend/src/middleware/metrics.ts`
- Endpoint: `GET /metrics` returns Prometheus-formatted metrics
- Tracks: Request count, duration, status codes by endpoint

---

_Architecture analysis: 2026-03-15_
