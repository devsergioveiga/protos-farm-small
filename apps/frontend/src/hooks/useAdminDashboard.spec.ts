import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useAdminDashboard } from './useAdminDashboard';

const mockGet = vi.fn();
vi.mock('@/services/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));

const DASHBOARD_STATS = {
  organizations: {
    total: 5,
    active: 3,
    suspended: 1,
    cancelled: 1,
    byPlan: [
      { plan: 'basic', count: 3 },
      { plan: 'professional', count: 2 },
    ],
  },
  users: { total: 42 },
  farms: { total: 18 },
};

describe('useAdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch dashboard stats', async () => {
    mockGet.mockResolvedValue(DASHBOARD_STATS);

    const { result } = renderHook(() => useAdminDashboard());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith('/admin/dashboard');
    expect(result.current.stats?.organizations.total).toBe(5);
    expect(result.current.stats?.users.total).toBe(42);
    expect(result.current.stats?.farms.total).toBe(18);
    expect(result.current.error).toBeNull();
  });

  it('should handle errors', async () => {
    mockGet.mockRejectedValue(new Error('Acesso negado'));

    const { result } = renderHook(() => useAdminDashboard());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Acesso negado');
    expect(result.current.stats).toBeNull();
  });
});
