# Testing Patterns

**Analysis Date:** 2026-03-15

## Test Framework

**Backend:**

- Runner: Jest
- Config: `apps/backend/jest.config.js`
- Environment: Node.js (no DOM)
- TypeScript: `preset: 'ts-jest'`
- Module aliases: `@/` → `src/`
- File pattern: `**/*.spec.ts`

**Frontend:**

- Runner: Vitest
- Config: `apps/frontend/vitest.config.ts`
- Environment: jsdom (browser-like)
- React: via `@vitejs/plugin-react`
- Module aliases: `@/` → `src/`
- File pattern: `**/*.spec.tsx`
- Globals: `true` (describe/it/expect available without imports)

**Shared package:**

- Runner: Jest
- Config: `packages/shared/jest.config.js`
- TypeScript: `preset: 'ts-jest'`

## Run Commands

**Backend:**

```bash
npm run test                # Run all tests once
npm run test:watch         # Watch mode
npm run test:cov           # Coverage report
npm run test:e2e           # E2E tests (separate config)
npm run lint               # ESLint check
npm run lint:fix           # Auto-fix lint errors
```

**Frontend:**

```bash
npm run test               # Run all tests once
npm run test:watch        # Watch mode (default in Vitest)
npm run lint              # ESLint check
npm run lint:fix          # Auto-fix lint errors
```

## Test File Organization

**Location:**

- Backend: co-located with source
  - Source: `src/modules/farms/farms.service.ts`
  - Test: `src/modules/farms/farms.routes.spec.ts` or `farms.service.spec.ts`
  - Integration tests: `src/__tests__/` (e.g., RLS isolation tests)

- Frontend: co-located with component
  - Source: `src/components/farm-form/FarmFormModal.tsx`
  - Test: `src/components/farm-form/FarmFormModal.spec.tsx`
  - Hook tests: `src/hooks/{hookName}.spec.ts`
  - Page tests: `src/pages/{PageName}.spec.tsx`

**Naming:**

- Test file = source file + `.spec.ts[x]` suffix
- One main test suite per file (describe block)

**Structure pattern:**

```
src/
├── modules/
│   └── {domain}/
│       ├── {domain}.service.ts
│       ├── {domain}.routes.ts
│       ├── {domain}.routes.spec.ts          # Main test file
│       └── {domain}.types.ts
└── __tests__/                               # Integration tests
    └── rls-isolation.spec.ts
```

## Test Structure

**Backend test suite organization:**

```typescript
import request from 'supertest';
import { app } from '../../app';
import * as farmsService from './farms.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { FarmError } from './farms.types';

// Jest mocks for service, auth, audit, middleware
jest.mock('../../shared/audit/audit.service', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('./farms.service', () => ({
  createFarm: jest.fn(),
  listFarms: jest.fn(),
  // ... all exported functions
}));
jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

const mockedService = jest.mocked(farmsService);
const mockedAuth = jest.mocked(authService);

// Auth test data
const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

// Helper to set auth context
function authAs(payload: typeof ADMIN_PAYLOAD) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  mockGetUserPermissions.mockResolvedValue(DEFAULT_ROLE_PERMISSIONS[payload.role]);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Farms endpoints', () => {
  describe('POST /org/farms', () => {
    it('should create farm and return 201', async () => {
      authAs(ADMIN_PAYLOAD);
      mockedService.createFarm.mockResolvedValue(mockFarm as never);

      const res = await request(app)
        .post('/api/org/farms')
        .set('Authorization', 'Bearer valid')
        .send({ name: 'Test Farm', state: 'MG', totalAreaHa: 100 });

      expect(res.status).toBe(201);
      expect(mockedService.createFarm).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        'admin-1',
        expect.objectContaining({ name: 'Test Farm' }),
      );
    });
  });
});
```

**Frontend test suite organization:**

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock API and hooks
const mockApiPost = vi.fn();
vi.mock('@/services/api', () => ({
  api: {
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: () => true, isLoading: false }),
}));

// Dynamic import for components that depend on lazy-loaded modules
async function importModal() {
  const mod = await import('./FarmFormModal');
  return mod.default;
}

// Test data mocks
const mockFarmDetail = {
  id: 'farm-1',
  name: 'Fazenda Santa Helena',
  state: 'MG',
  totalAreaHa: 250,
  // ... other fields
};

describe('FarmFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create mode', () => {
    async function renderCreateModal(props?: { onClose?: () => void; onSuccess?: () => void }) {
      const FarmFormModal = await importModal();
      const onClose = props?.onClose ?? vi.fn();
      const onSuccess = props?.onSuccess ?? vi.fn();
      const result = render(
        <MemoryRouter>
          <FarmFormModal isOpen={true} onClose={onClose} onSuccess={onSuccess} />
        </MemoryRouter>,
      );
      return { ...result, onClose, onSuccess };
    }

    it('should render with "Nova fazenda" title', async () => {
      await renderCreateModal();
      expect(screen.getByRole('heading', { name: 'Nova fazenda' })).toBeDefined();
    });

    it('should submit with POST /org/farms', async () => {
      mockApiPost.mockResolvedValue({ id: '1', name: 'Test' });
      const user = userEvent.setup();
      const { onSuccess } = await renderCreateModal();

      await user.type(screen.getByLabelText(/Nome da fazenda/), 'Test Farm');
      await user.selectOptions(screen.getByLabelText(/UF/), 'MG');
      await user.type(screen.getByLabelText(/Área total/), '100');
      await user.click(screen.getByRole('button', { name: /Cadastrar/ }));

      await waitFor(() => {
        expect(mockApiPost).toHaveBeenCalledWith('/org/farms', expect.any(Object));
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });
});
```

**Patterns:**

1. **Setup:** Mocks declared at top of file, not in individual tests
2. **Test isolation:** `beforeEach(() => jest.clearAllMocks())` clears all mocks before each test
3. **Auth testing:** Use `authAs(PAYLOAD)` helper to set token and permissions
4. **Async operations:** Use `waitFor()` and `await` for promises
5. **User interactions:** Use `userEvent` from `@testing-library/user-event`, not `fireEvent`

## Mocking

**Framework:**

- Backend: Jest mocks (`jest.mock()`, `jest.fn()`, `jest.mocked()`)
- Frontend: Vitest mocks (`vi.mock()`, `vi.fn()`, `vi.mocked()`)

**Patterns:**

1. **Service mocks:**

   ```typescript
   jest.mock('./farms.service', () => ({
     createFarm: jest.fn(),
     listFarms: jest.fn(),
     // Mock ALL exported functions
   }));
   const mockedService = jest.mocked(farmsService);
   ```

2. **Auth mocks:**

   ```typescript
   jest.mock('../auth/auth.service', () => {
     const actual = jest.requireActual('../auth/auth.service');
     return {
       ...actual,
       verifyAccessToken: jest.fn(), // Mock only what changes
     };
   });
   ```

3. **Middleware mocks:**

   ```typescript
   jest.mock('../../middleware/check-farm-access', () => ({
     checkFarmAccess: () => (_req: unknown, _res: unknown, next: () => void) => next(),
   }));
   ```

4. **Return value setup:**
   ```typescript
   mockedService.createFarm.mockResolvedValue(mockFarm);
   mockedService.getFarm.mockRejectedValue(new FarmError('Not found', 404));
   ```

**What to Mock:**

- External services (API calls, databases, email)
- Authentication/authorization services
- Middleware (auth, permissions, audit logging)
- Date/time if needed for deterministic tests

**What NOT to Mock:**

- Core business logic (service functions being tested should not be mocked)
- Pure utilities and helpers
- Type checking — mock only behavior
- Prisma client (use test database instead in integration tests)

## Fixtures and Factories

**Test Data:**

```typescript
// Backend: inline mock objects
const mockFarm = {
  id: 'farm-1',
  name: 'Santa Helena',
  state: 'MG',
  totalAreaHa: 250,
  organizationId: 'org-1',
  // ... required fields
};

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};
```

**Location:**

- Defined inline in test file, near top or in helper function
- Shared constants (like ADMIN_PAYLOAD) defined before test suites
- Domain-specific test data in describe blocks

**No factory libraries:** Use simple object literals and helper functions

## Coverage

**Requirements:** Not enforced by CI; aim for >70% coverage in critical paths

**View Coverage:**

```bash
# Backend
npm run test:cov

# Frontend
npm run test -- --coverage  # or configured in vitest.config.ts
```

**Focus areas:**

- Service business logic (critical)
- Route/handler validation logic
- Error conditions and edge cases
- Component user interactions (frontend)

## Test Types

**Unit Tests:**

- Scope: Single function/component
- Approach: Mock dependencies, test in isolation
- Location: `{domain}.service.spec.ts` or `Component.spec.tsx`
- Example: Test `createFarm` service with mocked database

**Integration Tests:**

- Scope: Multiple layers (route → service → database) or component + hooks
- Approach: Use real app instance (backend) or provider wrapper (frontend)
- Location: `src/__tests__/` (backend integration), component test with real hooks
- Example: Test POST /org/farms route with mocked audit service
- Database: Not used in standard tests (mocked); separate E2E suite uses test DB

**E2E Tests:**

- Framework: Jest with separate config (`test/jest-e2e.json`)
- Scope: Full stack against test database
- Command: `npm run test:e2e`
- Status: Configured but minimal coverage; focus on unit + integration tests

## Common Patterns

**Async Testing:**

```typescript
// Backend
it('should create farm', async () => {
  mockedService.createFarm.mockResolvedValue(mockFarm);
  const res = await request(app).post('/api/org/farms').send(input);
  expect(res.status).toBe(201);
});

// Frontend
it('should submit form', async () => {
  mockApiPost.mockResolvedValue({ id: '1' });
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /Submit/ }));

  await waitFor(() => {
    expect(mockApiPost).toHaveBeenCalled();
  });
});
```

**Error Testing:**

```typescript
// Backend
it('should return 404 when farm not found', async () => {
  mockedService.getFarm.mockRejectedValue(new FarmError('Not found', 404));

  const res = await request(app).get('/api/org/farms/invalid');

  expect(res.status).toBe(404);
  expect(res.body.error).toBe('Não encontrada');
});

// Frontend
it('should show error message on failure', async () => {
  mockApiPost.mockRejectedValue(new Error('Network error'));
  const user = userEvent.setup();

  await user.click(screen.getByRole('button'));

  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar');
  });
});
```

**Mocked API responses:**

```typescript
// Mock successful response
mockApiPost.mockResolvedValue({ id: 'farm-1', name: 'Test' });

// Mock error response
mockApiPost.mockRejectedValue(new Error('Validation error'));

// Mock different behavior per call
mockApiPost.mockResolvedValueOnce({ id: '1' }).mockRejectedValueOnce(new Error('Error'));
```

**Testing permissions:**

```typescript
it('should return 403 when user lacks permission', async () => {
  authAs(OPERATOR_PAYLOAD); // Lower-privilege user
  mockGetUserPermissions.mockResolvedValue(['animals:read']); // Missing farms:create

  const res = await request(app)
    .post('/api/org/farms')
    .set('Authorization', 'Bearer valid')
    .send(input);

  expect(res.status).toBe(403);
});
```

**Waiting for async state updates:**

```typescript
// Vitest/React Testing Library pattern
await waitFor(() => {
  expect(screen.getByText('Success')).toBeDefined();
});

// User event waits automatically
const user = userEvent.setup();
await user.click(button); // Automatically waits for state updates
```

---

_Testing analysis: 2026-03-15_
