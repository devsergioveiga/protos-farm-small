import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCultivarProductivity } from './useCultivarProductivity';

const mockGet = vi.fn();
vi.mock('@/services/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));

describe('useCultivarProductivity', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('should return empty data when no farmId', async () => {
    const { result } = renderHook(() => useCultivarProductivity({ farmId: null }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.productivity).toEqual([]);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('should fetch productivity comparison for a farm', async () => {
    const mockData = [
      {
        cultivarId: 'c1',
        cultivarName: 'TMG 7063 IPRO',
        crop: 'Soja',
        avgProductivityKgHa: 3800,
        totalPlantings: 3,
        entries: [],
      },
    ];
    mockGet.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useCultivarProductivity({ farmId: 'farm-1' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.productivity).toEqual(mockData);
    expect(result.current.error).toBeNull();
    expect(mockGet).toHaveBeenCalledWith('/org/farms/farm-1/cultivars/productivity');
  });

  it('should filter by crop when provided', async () => {
    mockGet.mockResolvedValueOnce([]);

    const { result } = renderHook(() =>
      useCultivarProductivity({ farmId: 'farm-1', crop: 'Soja' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockGet).toHaveBeenCalledWith('/org/farms/farm-1/cultivars/productivity?crop=Soja');
  });

  it('should handle errors', async () => {
    mockGet.mockRejectedValueOnce(new Error('Server error'));

    const { result } = renderHook(() => useCultivarProductivity({ farmId: 'farm-1' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Server error');
    expect(result.current.productivity).toEqual([]);
  });
});
