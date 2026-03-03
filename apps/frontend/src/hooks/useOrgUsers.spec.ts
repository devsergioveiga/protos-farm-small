import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useOrgUsers } from './useOrgUsers';

const mockGet = vi.fn();
vi.mock('@/services/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));

const USERS_RESPONSE = {
  data: [
    {
      id: 'u1',
      name: 'João Silva',
      email: 'joao@test.com',
      phone: null,
      role: 'OPERATOR',
      status: 'ACTIVE' as const,
      lastLoginAt: '2026-03-01T10:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      farmAccess: [{ farm: { id: 'f1', name: 'Fazenda Sol' } }],
    },
  ],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

describe('useOrgUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch users list', async () => {
    mockGet.mockResolvedValue(USERS_RESPONSE);

    const { result } = renderHook(() => useOrgUsers());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith('/org/users');
    expect(result.current.users).toHaveLength(1);
    expect(result.current.users[0].name).toBe('João Silva');
    expect(result.current.meta?.total).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it('should pass search and filter params in query string', async () => {
    mockGet.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });

    const { result } = renderHook(() =>
      useOrgUsers({ search: 'João', page: 2, role: 'OPERATOR', status: 'ACTIVE' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith(
      '/org/users?search=Jo%C3%A3o&page=2&role=OPERATOR&status=ACTIVE',
    );
  });

  it('should handle errors', async () => {
    mockGet.mockRejectedValue(new Error('Falha de rede'));

    const { result } = renderHook(() => useOrgUsers());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Falha de rede');
    expect(result.current.users).toHaveLength(0);
  });
});
