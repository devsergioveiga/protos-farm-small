/**
 * US-011 — Testes de isolamento RLS (Row-Level Security)
 *
 * Verifica que:
 * 1. withRlsContext seta app.current_org_id via SET LOCAL na transação
 * 2. withRlsBypass seta app.bypass_rls = 'true' via SET LOCAL
 * 3. Transações separadas têm contextos RLS independentes
 */

const mockExecuteRaw = jest.fn().mockResolvedValue(undefined);
const mockTransaction = jest.fn();

jest.mock('../database/prisma', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

import { withRlsContext, withRlsBypass, type RlsContext } from '../database/rls';

describe('RLS Isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const txClient = {
        $executeRaw: mockExecuteRaw,
        user: {
          findMany: jest.fn().mockResolvedValue([]),
          findUnique: jest.fn().mockResolvedValue(null),
          count: jest.fn().mockResolvedValue(0),
        },
        organization: {
          findUnique: jest.fn().mockResolvedValue(null),
          count: jest.fn().mockResolvedValue(0),
        },
        farm: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
        },
      };
      return fn(txClient);
    });
  });

  // ─── withRlsContext ──────────────────────────────────────────────

  describe('withRlsContext', () => {
    it('should set app.current_org_id via SET LOCAL inside transaction', async () => {
      const ctx: RlsContext = { organizationId: 'org-123' };

      await withRlsContext(ctx, async () => 'result');

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockExecuteRaw).toHaveBeenCalledTimes(1);

      const call = mockExecuteRaw.mock.calls[0];
      const templateStrings = call[0];
      expect(templateStrings[0]).toContain('set_config');
      expect(templateStrings[0]).toContain('app.current_org_id');
    });

    it('should return the value from the callback', async () => {
      const ctx: RlsContext = { organizationId: 'org-123' };
      const result = await withRlsContext(ctx, async () => ({ data: 'test' }));
      expect(result).toEqual({ data: 'test' });
    });

    it('should propagate errors from the callback', async () => {
      const ctx: RlsContext = { organizationId: 'org-123' };
      await expect(
        withRlsContext(ctx, async () => {
          throw new Error('Test error');
        }),
      ).rejects.toThrow('Test error');
    });

    it('should pass the organizationId as parameter', async () => {
      const ctx: RlsContext = { organizationId: 'org-specific-456' };

      await withRlsContext(ctx, async () => 'ok');

      const call = mockExecuteRaw.mock.calls[0];
      // Tagged template literal: args after template strings are interpolated values
      expect(call[1]).toBe('org-specific-456');
    });
  });

  // ─── withRlsBypass ───────────────────────────────────────────────

  describe('withRlsBypass', () => {
    it('should set app.bypass_rls to true via SET LOCAL inside transaction', async () => {
      await withRlsBypass(async () => 'bypassed');

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockExecuteRaw).toHaveBeenCalledTimes(1);

      const call = mockExecuteRaw.mock.calls[0];
      const templateStrings = call[0];
      expect(templateStrings[0]).toContain('set_config');
      expect(templateStrings[0]).toContain('app.bypass_rls');
    });

    it('should return the value from the callback', async () => {
      const result = await withRlsBypass(async () => ({ bypassed: true }));
      expect(result).toEqual({ bypassed: true });
    });

    it('should propagate errors from the callback', async () => {
      await expect(
        withRlsBypass(async () => {
          throw new Error('Bypass error');
        }),
      ).rejects.toThrow('Bypass error');
    });

    it('should not set current_org_id', async () => {
      await withRlsBypass(async () => 'ok');

      const call = mockExecuteRaw.mock.calls[0];
      const templateStrings = call[0];
      expect(templateStrings[0]).toContain('bypass_rls');
      expect(templateStrings[0]).not.toContain('current_org_id');
    });
  });

  // ─── Isolamento cross-tenant ──────────────────────────────────────

  describe('Cross-tenant isolation', () => {
    it('separate RLS contexts should set different org_ids', async () => {
      const orgIds: string[] = [];

      mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const txClient = {
          $executeRaw: (...args: unknown[]) => {
            const orgId = (args as unknown[])[1] as string | undefined;
            if (orgId) orgIds.push(orgId);
            return Promise.resolve(undefined);
          },
          user: { findMany: jest.fn().mockResolvedValue([]) },
        };
        return fn(txClient);
      });

      await withRlsContext({ organizationId: 'org-1' }, async (tx) => {
        await (tx as unknown as { user: { findMany: jest.Mock } }).user.findMany({});
      });

      await withRlsContext({ organizationId: 'org-2' }, async (tx) => {
        await (tx as unknown as { user: { findMany: jest.Mock } }).user.findMany({});
      });

      expect(orgIds).toEqual(['org-1', 'org-2']);
    });

    it('concurrent transactions should have independent contexts', async () => {
      const [r1, r2] = await Promise.all([
        withRlsContext({ organizationId: 'org-alpha' }, async () => 'alpha-result'),
        withRlsContext({ organizationId: 'org-beta' }, async () => 'beta-result'),
      ]);

      expect(r1).toBe('alpha-result');
      expect(r2).toBe('beta-result');
      expect(mockTransaction).toHaveBeenCalledTimes(2);
    });

    it('bypass transactions should be independent from RLS context transactions', async () => {
      await withRlsContext({ organizationId: 'org-1' }, async () => 'rls');
      await withRlsBypass(async () => 'bypass');

      expect(mockTransaction).toHaveBeenCalledTimes(2);

      // First call sets current_org_id, second sets bypass_rls
      const calls = mockExecuteRaw.mock.calls;
      expect(calls[0][0][0]).toContain('current_org_id');
      expect(calls[1][0][0]).toContain('bypass_rls');
    });
  });

  // ─── RlsContext type ──────────────────────────────────────────────

  describe('RlsContext type', () => {
    it('should require organizationId', () => {
      const ctx: RlsContext = { organizationId: 'org-required' };
      expect(ctx.organizationId).toBe('org-required');
    });
  });
});
