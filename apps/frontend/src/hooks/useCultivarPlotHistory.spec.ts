import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCultivarPlotHistory } from './useCultivarPlotHistory';

const mockGet = vi.fn();
vi.mock('@/services/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));

describe('useCultivarPlotHistory', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('should return empty data when no farmId', async () => {
    const { result } = renderHook(() => useCultivarPlotHistory({ farmId: null }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.plotHistory).toEqual([]);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('should fetch plot history for a farm', async () => {
    const mockData = [
      {
        plotId: 'p1',
        plotName: 'Talhão 1',
        seasons: [
          {
            seasonYear: '2025/2026',
            seasonType: 'SAFRA',
            cultivarId: 'c1',
            cultivarName: 'TMG 7063 IPRO',
            productivityKgHa: 3800,
            totalProductionKg: 38000,
            notes: null,
          },
        ],
      },
    ];
    mockGet.mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useCultivarPlotHistory({ farmId: 'farm-1' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.plotHistory).toEqual(mockData);
    expect(result.current.error).toBeNull();
    expect(mockGet).toHaveBeenCalledWith('/org/farms/farm-1/cultivars/plot-history');
  });

  it('should filter by plotId when provided', async () => {
    mockGet.mockResolvedValueOnce([]);

    const { result } = renderHook(() =>
      useCultivarPlotHistory({ farmId: 'farm-1', plotId: 'plot-1' }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockGet).toHaveBeenCalledWith('/org/farms/farm-1/cultivars/plot-history?plotId=plot-1');
  });

  it('should handle errors', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useCultivarPlotHistory({ farmId: 'farm-1' }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Network error');
    expect(result.current.plotHistory).toEqual([]);
  });
});
