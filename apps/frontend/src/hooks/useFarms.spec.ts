import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useFarms } from './useFarms';

const mockGet = vi.fn();
vi.mock('@/services/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));

const FARMS_RESPONSE = {
  data: [
    {
      id: '1',
      name: 'Fazenda Sol',
      nickname: null,
      city: 'Uberlândia',
      state: 'MG',
      totalAreaHa: 500,
      boundaryAreaHa: null,
      status: 'ACTIVE' as const,
      landClassification: null,
      latitude: null,
      longitude: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      _count: { registrations: 2 },
    },
  ],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

describe('useFarms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch farms list', async () => {
    mockGet.mockResolvedValue(FARMS_RESPONSE);

    const { result } = renderHook(() => useFarms());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith('/org/farms');
    expect(result.current.farms).toHaveLength(1);
    expect(result.current.farms[0].name).toBe('Fazenda Sol');
    expect(result.current.meta?.total).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it('should pass search params in query string', async () => {
    mockGet.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });

    const { result } = renderHook(() => useFarms({ search: 'Sol', page: 2, state: 'MG' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith('/org/farms?search=Sol&page=2&state=MG');
  });

  it('should handle errors', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useFarms());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Network error');
    expect(result.current.farms).toHaveLength(0);
  });
});
