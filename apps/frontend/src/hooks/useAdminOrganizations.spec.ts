import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useAdminOrganizations } from './useAdminOrganizations';

const mockGet = vi.fn();
vi.mock('@/services/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));

const ORGS_RESPONSE = {
  data: [
    {
      id: 'org-1',
      name: 'Agro Corp',
      type: 'PJ' as const,
      document: '12345678000190',
      plan: 'basic',
      status: 'ACTIVE' as const,
      maxUsers: 10,
      maxFarms: 5,
      allowMultipleSessions: false,
      allowSocialLogin: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      _count: { users: 3, farms: 2 },
    },
  ],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

describe('useAdminOrganizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch organizations list', async () => {
    mockGet.mockResolvedValue(ORGS_RESPONSE);

    const { result } = renderHook(() => useAdminOrganizations());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith('/admin/organizations');
    expect(result.current.organizations).toHaveLength(1);
    expect(result.current.organizations[0].name).toBe('Agro Corp');
    expect(result.current.meta?.total).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it('should pass query params', async () => {
    mockGet.mockResolvedValue({ data: [], meta: { page: 2, limit: 10, total: 0, totalPages: 0 } });

    const { result } = renderHook(() =>
      useAdminOrganizations({ page: 2, limit: 10, status: 'ACTIVE', search: 'agro' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith(
      '/admin/organizations?page=2&limit=10&status=ACTIVE&search=agro',
    );
  });

  it('should handle errors', async () => {
    mockGet.mockRejectedValue(new Error('Erro de rede'));

    const { result } = renderHook(() => useAdminOrganizations());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Erro de rede');
    expect(result.current.organizations).toHaveLength(0);
    expect(result.current.meta).toBeNull();
  });
});
