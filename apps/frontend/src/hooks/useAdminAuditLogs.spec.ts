import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useAdminAuditLogs } from './useAdminAuditLogs';

const mockGet = vi.fn();
vi.mock('@/services/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));

const LOGS_RESPONSE = {
  data: [
    {
      id: 'log-1',
      actorId: 'user-1',
      actorEmail: 'admin@protos.farm',
      actorRole: 'SUPER_ADMIN',
      action: 'CREATE_ORGANIZATION',
      targetType: 'organization',
      targetId: 'org-1',
      metadata: { name: 'Agro Corp' },
      ipAddress: '192.168.1.1',
      farmId: null,
      organizationId: 'org-1',
      createdAt: '2026-03-01T10:00:00.000Z',
    },
  ],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

describe('useAdminAuditLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch audit logs', async () => {
    mockGet.mockResolvedValue(LOGS_RESPONSE);

    const { result } = renderHook(() => useAdminAuditLogs());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith('/admin/audit-logs');
    expect(result.current.logs).toHaveLength(1);
    expect(result.current.logs[0].action).toBe('CREATE_ORGANIZATION');
    expect(result.current.error).toBeNull();
  });

  it('should pass filter params', async () => {
    mockGet.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });

    const { result } = renderHook(() =>
      useAdminAuditLogs({
        action: 'CREATE_ORGANIZATION',
        dateFrom: '2026-01-01',
        dateTo: '2026-03-01',
        organizationId: 'org-1',
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith(
      '/admin/audit-logs?action=CREATE_ORGANIZATION&dateFrom=2026-01-01&dateTo=2026-03-01&organizationId=org-1',
    );
  });

  it('should handle errors', async () => {
    mockGet.mockRejectedValue(new Error('Falha na requisição'));

    const { result } = renderHook(() => useAdminAuditLogs());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Falha na requisição');
    expect(result.current.logs).toHaveLength(0);
  });
});
