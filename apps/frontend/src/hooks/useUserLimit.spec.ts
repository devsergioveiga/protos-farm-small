import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useUserLimit } from './useUserLimit';

const mockGet = vi.fn();
vi.mock('@/services/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));

const LIMIT_RESPONSE = {
  current: 5,
  max: 10,
  percentage: 50,
  warning: false,
  blocked: false,
};

describe('useUserLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch user limit info', async () => {
    mockGet.mockResolvedValue(LIMIT_RESPONSE);

    const { result } = renderHook(() => useUserLimit());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith('/org/users/limit');
    expect(result.current.limit).toEqual(LIMIT_RESPONSE);
    expect(result.current.error).toBeNull();
  });

  it('should handle errors', async () => {
    mockGet.mockRejectedValue(new Error('Falha ao carregar'));

    const { result } = renderHook(() => useUserLimit());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Falha ao carregar');
    expect(result.current.limit).toBeNull();
  });

  it('should detect warning state', async () => {
    mockGet.mockResolvedValue({ ...LIMIT_RESPONSE, current: 8, percentage: 80, warning: true });

    const { result } = renderHook(() => useUserLimit());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.limit?.warning).toBe(true);
    expect(result.current.limit?.blocked).toBe(false);
  });
});
