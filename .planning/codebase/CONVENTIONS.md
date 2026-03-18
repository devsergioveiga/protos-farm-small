# Coding Conventions

**Analysis Date:** 2026-03-15

## Naming Patterns

**Files:**

- Backend services: `{domain}.service.ts` (e.g., `farms.service.ts`, `animals.service.ts`)
- Backend routes: `{domain}.routes.ts` (e.g., `farms.routes.ts`)
- Backend types: `{domain}.types.ts` containing domain-specific types and error classes
- Frontend components: PascalCase matching component name (e.g., `FarmFormModal.tsx`)
- Frontend hooks: `use{Domain}.ts` (e.g., `useFarmForm.ts`, `usePermissions.ts`)
- Frontend pages: PascalCase with "Page" suffix (e.g., `FarmsPage.tsx`, `LoginPage.tsx`)
- Test files: same name as source with `.spec.ts` or `.spec.tsx` suffix
- CSS files: match component/module name (e.g., `FarmFormModal.css`)

**Functions:**

- camelCase for all functions, methods, and variables
- Public exports: descriptive names (e.g., `createFarm`, `listFarms`, `validateBoundary`)
- Helper functions: prefix with descriptive verb (e.g., `validateUf`, `checkAreaDivergence`, `getClientIp`)
- Async functions: use `async/await`, never callback-based patterns

**Variables:**

- camelCase for all variables and parameters
- Boolean variables: prefix with `is`, `has`, `should`, `can` (e.g., `isDev`, `hasPermission`, `shouldValidate`)
- Constants: ALL_CAPS for module-level constants (e.g., `BCRYPT_ROUNDS`, `MAX_BULK_FEATURES`)
- Type-safe enums: use `as const` pattern (e.g., `['MINIFUNDIO', 'PEQUENA', 'MEDIA', 'GRANDE'] as const`)

**Types:**

- PascalCase for all type names: `interface CreateFarmInput`, `type TokenPayload`
- Error classes: PascalCase with "Error" suffix (e.g., `FarmError`, `AuthError`, `AnimalError`)
- Input/output types: suffix with `Input`, `Output`, `Result`, `Query` (e.g., `CreateFarmInput`, `ListFarmsQuery`)
- Type-safe discriminated unions: use literal types (e.g., `status: 'ACTIVE' | 'INACTIVE'`)

## Code Style

**Formatting:**

- Tool: Prettier (configured in `.prettierrc`)
- Print width: 100 characters
- Tab width: 2 spaces
- Semicolons: required
- Quotes: single quotes (`'`)
- Trailing commas: all (in objects, arrays, function params)
- Line endings: LF

**Linting:**

- Tool: ESLint 9 with flat config format
- Config: `eslint.config.mjs` at root, inherited by app/package configs
- Base rules: `@eslint/js` recommended + `typescript-eslint/recommended`
- ESLint config prettier: enforces Prettier compatibility

**Backend linting:**

- Node globals enabled via `globals.node`
- No `any` types allowed by default

**Frontend linting:**

- Browser globals enabled
- React plugin integration
- No `any` types allowed by default

## Import Organization

**Order:**

1. Node.js built-in imports (`import crypto from 'node:crypto'`)
2. External dependencies (`import express from 'express'`)
3. Type imports from external packages (`import type { Something } from '@package'`)
4. Relative path imports (`import { something } from '../utils'`)
5. Relative type imports (`import type { SomeType } from '../types'`)
6. CSS/asset imports (last)

**Path Aliases:**

- Backend: `@/` → `src/` (in `jest.config.js`)
- Frontend: `@/` → `src/` (in `vitest.config.ts` and `vite` config)
- Shared package: imported as `@protos-farm/shared`

**Module exports:**

- Backend: export named functions directly from services/utilities
- Frontend: `export default` for page components and modals; named exports for reusable UI components
- No barrel files (`index.ts` re-exports) for larger modules; import directly from service files

## Error Handling

**Patterns:**

1. **Custom error classes**: Extend `Error` with `statusCode` property

   ```typescript
   export class FarmError extends Error {
     constructor(
       message: string,
       public statusCode: number,
     ) {
       super(message);
       this.name = 'FarmError';
     }
   }
   ```

2. **Throwing errors**: Always with descriptive, Portuguese messages

   ```typescript
   throw new FarmError('Fazenda não encontrada', 404);
   throw new FarmError('Área total deve ser maior que zero', 400);
   ```

3. **Route error handling**: Routes catch and respond with status + error message

   ```typescript
   try {
     const result = await someService(ctx, input);
     res.status(200).json(result);
   } catch (err) {
     if (err instanceof DomainError) {
       res.status(err.statusCode).json({ error: err.message });
     } else {
       logger.error(err);
       res.status(500).json({ error: 'Erro interno do servidor' });
     }
   }
   ```

4. **Validation errors**: throw custom errors immediately with specific message
   - File: `src/modules/{domain}/{domain}.types.ts` — define error class
   - File: `src/modules/{domain}/{domain}.service.ts` — validate and throw in service layer

5. **Frontend error handling**: Use toast notifications for user feedback
   - Success toasts: auto-dismiss after 5 seconds
   - Error toasts: persistent until user dismisses
   - Error messages: always Portuguese, user-friendly ("Não foi possível salvar..." not "Error 500")

## Logging

**Framework:** Pino (structured logging)

**Configuration:** `src/shared/utils/logger.ts`

- Development: debug level, pretty-printed output
- Production/Staging: info level, JSON structured logs
- Service metadata: `service: 'backend'` + `environment`

**Patterns:**

- Use `logger.info()`, `logger.debug()`, `logger.error()` from shared logger
- Log audit events via `logAudit()` service (file: `src/shared/audit/audit.service.ts`)
- Audit includes: action type, actor, organization, farm, resource, changes
- Never log sensitive data (passwords, tokens, PII)

## Comments

**When to Comment:**

- Above helper functions with non-obvious purpose
- Before major logical sections (use divider: `// ─── Section Name ───`)
- Explaining business logic constraints (area divergence >5%, etc.)
- Never redundant comments that repeat code

**JSDoc/TSDoc:**

- Not used consistently in codebase; favor self-documenting code
- Type system is primary documentation

**Dividers:**

- Use ASCII dividers for major sections in services/routes
- Pattern: `// ─── Section Name ────────────────────────────────────`
- Improves readability of large files (200+ lines)

## Function Design

**Size:** Aim for <100 lines per function; break complex logic into helpers

**Parameters:**

- Objects over tuples: prefer `{ name, email }` over `(name, email)`
- Use input type interfaces for services: `CreateFarmInput`, `ListFarmsQuery`
- Context parameter first: `(ctx: RlsContext, farmId: string, input: CreateFarmInput)`

**Return Values:**

- Explicit return types on all exported functions
- Services return domain models (from Prisma) or typed interfaces
- Routes return JSON via `res.status(code).json(data)`
- Use discriminated unions for multiple return types

**Async/await:**

- Always use `async/await` for promises, never `.then()` chains
- Wrap in try/catch in routes; let service-layer errors bubble

## Module Design

**Exports:**

- Backend: export named functions directly: `export async function createFarm(...) { ... }`
- Frontend components: `export default ComponentName` for pages/modals
- Frontend UI components: named exports if reusable
- Constants: export as named exports

**Colocation:**

- Backend modules at `src/modules/{domain}/` contain:
  - `{domain}.service.ts` — business logic, RLS context, database queries
  - `{domain}.routes.ts` — HTTP handlers, authentication, request validation, audit logging
  - `{domain}.types.ts` — type definitions, error classes, constants
  - Additional: `.routes.spec.ts`, sub-routers, utilities

- Frontend modules at `src/components/` contain:
  - Component file: `ComponentName.tsx`
  - Component test: `ComponentName.spec.tsx`
  - Styles: `ComponentName.css` (if not using Tailwind)
  - Co-located in same directory

**Type organization:**

- Domain types in `{domain}.types.ts`
- Shared types in `packages/shared/src/types/`
- Frontend-only types in `src/types/`
- Database types imported from `@prisma/client`

## Accessibility (Frontend)

**HTML structure:**

- Semantic elements: `<button>`, `<a>`, `<nav>`, `<main>`, `<section>`, `<form>`
- Never `<div onClick>` — always use `<button>` for actions
- Forms: `<label htmlFor>` always visible, never placeholder-only
- Required fields: mark with `*` and `aria-required="true"`

**ARIA attributes:**

- `aria-label` for icon-only buttons
- `aria-hidden="true"` for decorative icons
- `aria-invalid` and `aria-describedby` for form errors
- `role="alert"` for error messages in forms

**Focus management:**

- Focus visible outline: 2px primary color, never removed
- Tab order follows logical document flow
- Escape key closes modals/dropdowns
- Modal auto-focuses first form field or close button

## Component Patterns (Frontend)

**Modal forms:**

- Always use modal, never dedicated page for create/edit
- File: `components/{domain}/{ActionName}Modal.tsx`
- Props: `isOpen: boolean`, `onClose: () => void`, `onSuccess: () => void`, optional `itemId?: string`
- Success callback: modal closes, parent gets `onSuccess` callback to refresh data + show toast

**Custom hooks:**

- File: `hooks/use{Domain}.ts` or `hooks/{purpose}.ts`
- Return object with state + handlers: `{ formData, errors, handleSubmit, isLoading }`
- Call `onSuccess` callback instead of navigating

**Context providers:**

- File: `stores/{ContextName}.tsx`
- Export context + hook: `export const FarmContext`, `export const useFarm`
- Provide at app root or page level
- Never perform side effects; that's for routes + components

## Type Safety

**Always:**

- Explicitly type function parameters and return values
- Type all props interfaces for components
- Type all hook return values
- Never use `any` — use `unknown` and narrow with type guards if needed
- Use `const` assertions for literal types: `as const`

**Prisma model usage:**

- Import models from `@prisma/client`: `import { Farm, Animal } from '@prisma/client'`
- Use domain-specific input types (`CreateFarmInput`) for operations
- Return Prisma models or typed response interfaces from services

---

_Convention analysis: 2026-03-15_
