import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useFarmMap } from './useFarmMap';

const mockGet = vi.fn();
vi.mock('@/services/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));

const FARM_DETAIL = {
  id: 'farm-1',
  name: 'Fazenda Sol',
  nickname: null,
  address: null,
  city: 'Uberlândia',
  state: 'MG',
  zipCode: null,
  totalAreaHa: 500,
  boundaryAreaHa: 498,
  status: 'ACTIVE',
  landClassification: 'MEDIA',
  latitude: -18.9,
  longitude: -48.3,
  registrations: [
    {
      id: 'reg-1',
      farmId: 'farm-1',
      number: '12345',
      cartorioName: 'Cartório 1',
      comarca: 'Uberlândia',
      state: 'MG',
      areaHa: 250,
      cnsCode: null,
      livro: null,
      registrationDate: null,
      boundaryAreaHa: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'reg-2',
      farmId: 'farm-1',
      number: '67890',
      cartorioName: 'Cartório 2',
      comarca: 'Uberaba',
      state: 'MG',
      areaHa: 250,
      cnsCode: null,
      livro: null,
      registrationDate: null,
      boundaryAreaHa: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const FARM_BOUNDARY = {
  hasBoundary: true,
  boundaryAreaHa: 498,
  boundaryGeoJSON: {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
  },
};

const NO_BOUNDARY = { hasBoundary: false, boundaryAreaHa: null, boundaryGeoJSON: null };

describe('useFarmMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch farm detail and boundaries in parallel', async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === '/org/farms/farm-1') return Promise.resolve(FARM_DETAIL);
      if (path === '/org/farms/farm-1/plots') return Promise.resolve([]);
      if (path === '/org/farms/farm-1/boundary') return Promise.resolve(FARM_BOUNDARY);
      if (path.includes('/registrations/')) return Promise.resolve(NO_BOUNDARY);
      return Promise.reject(new Error('Unknown path'));
    });

    const { result } = renderHook(() => useFarmMap('farm-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).not.toBeNull();
    expect(result.current.data!.farm.name).toBe('Fazenda Sol');
    expect(result.current.data!.farmBoundary.hasBoundary).toBe(true);
    expect(result.current.data!.registrationBoundaries).toHaveLength(2);
    expect(result.current.data!.plotBoundaries).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it('should handle farm boundary being absent', async () => {
    mockGet.mockImplementation((path: string) => {
      if (path === '/org/farms/farm-1') return Promise.resolve(FARM_DETAIL);
      if (path === '/org/farms/farm-1/plots') return Promise.resolve([]);
      return Promise.resolve(NO_BOUNDARY);
    });

    const { result } = renderHook(() => useFarmMap('farm-1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data!.farmBoundary.hasBoundary).toBe(false);
  });

  it('should handle farm not found error', async () => {
    mockGet.mockRejectedValue(new Error('Fazenda não encontrada'));

    const { result } = renderHook(() => useFarmMap('nonexistent'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Fazenda não encontrada');
    expect(result.current.data).toBeNull();
  });

  it('should not fetch when farmId is undefined', async () => {
    const { result } = renderHook(() => useFarmMap(undefined));

    expect(result.current.isLoading).toBe(true);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
