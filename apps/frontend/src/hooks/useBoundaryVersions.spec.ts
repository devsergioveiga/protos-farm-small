import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { BoundaryVersionItem, BoundaryVersionDetail } from '@/types/farm';

const mockGet = vi.fn();

vi.mock('@/services/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

import { useBoundaryVersions } from './useBoundaryVersions';

const mockVersions: BoundaryVersionItem[] = [
  {
    id: 'v-1',
    farmId: 'farm-1',
    registrationId: null,
    boundaryAreaHa: 100,
    uploadedBy: 'user-1',
    uploadedAt: '2026-01-01T00:00:00.000Z',
    filename: 'test.geojson',
    version: 1,
  },
];

const mockDetail: BoundaryVersionDetail = {
  ...mockVersions[0],
  boundaryGeoJSON: {
    type: 'Polygon',
    coordinates: [
      [
        [-47.0, -15.0],
        [-47.0, -16.0],
        [-46.0, -16.0],
        [-46.0, -15.0],
        [-47.0, -15.0],
      ],
    ],
  },
};

describe('useBoundaryVersions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch versions list for farm', async () => {
    mockGet.mockResolvedValueOnce(mockVersions);

    const { result } = renderHook(() => useBoundaryVersions('farm-1'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGet).toHaveBeenCalledWith('/org/farms/farm-1/boundary/versions');
    expect(result.current.versions).toEqual(mockVersions);
    expect(result.current.error).toBeNull();
  });

  it('should fetch versions list for registration', async () => {
    mockGet.mockResolvedValueOnce(mockVersions);

    const { result } = renderHook(() => useBoundaryVersions('farm-1', 'reg-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGet).toHaveBeenCalledWith('/org/farms/farm-1/registrations/reg-1/boundary/versions');
  });

  it('should set error on fetch failure', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useBoundaryVersions('farm-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.versions).toEqual([]);
  });

  it('should fetch version geometry', async () => {
    mockGet.mockResolvedValueOnce(mockVersions);

    const { result } = renderHook(() => useBoundaryVersions('farm-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    mockGet.mockResolvedValueOnce(mockDetail);

    const detail = await result.current.fetchVersionGeometry('v-1');
    expect(detail).toEqual(mockDetail);
    expect(mockGet).toHaveBeenCalledWith('/org/farms/farm-1/boundary/versions/v-1');
  });

  it('should return null on geometry fetch error', async () => {
    mockGet.mockResolvedValueOnce(mockVersions);

    const { result } = renderHook(() => useBoundaryVersions('farm-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    mockGet.mockRejectedValueOnce(new Error('Not found'));

    const detail = await result.current.fetchVersionGeometry('v-999');
    expect(detail).toBeNull();
  });
});
