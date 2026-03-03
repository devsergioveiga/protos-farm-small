import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useFarmLimit } from './useFarmLimit';

const mockGet = vi.fn();
vi.mock('@/services/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));

const LIMIT_RESPONSE = {
  current: 3,
  max: 10,
  percentage: 30,
  warning: false,
  blocked: false,
};

describe('useFarmLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch farm limit info', async () => {
    mockGet.mockResolvedValue(LIMIT_RESPONSE);

    const { result } = renderHook(() => useFarmLimit());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith('/org/farms/limit');
    expect(result.current.limit).toEqual(LIMIT_RESPONSE);
    expect(result.current.error).toBeNull();
  });

  it('should handle errors', async () => {
    mockGet.mockRejectedValue(new Error('Falha ao carregar'));

    const { result } = renderHook(() => useFarmLimit());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Falha ao carregar');
    expect(result.current.limit).toBeNull();
  });

  it('should detect warning state', async () => {
    mockGet.mockResolvedValue({ ...LIMIT_RESPONSE, current: 8, percentage: 80, warning: true });

    const { result } = renderHook(() => useFarmLimit());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.limit?.warning).toBe(true);
    expect(result.current.limit?.blocked).toBe(false);
  });

  it('should detect blocked state', async () => {
    mockGet.mockResolvedValue({
      ...LIMIT_RESPONSE,
      current: 10,
      percentage: 100,
      warning: true,
      blocked: true,
    });

    const { result } = renderHook(() => useFarmLimit());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.limit?.blocked).toBe(true);
  });
});
