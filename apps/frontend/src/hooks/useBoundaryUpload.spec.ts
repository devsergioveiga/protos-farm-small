import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useBoundaryUpload, extractPolygon } from './useBoundaryUpload';

const mockPostFormData = vi.fn();

vi.mock('@/services/api', () => ({
  api: {
    postFormData: (...args: unknown[]) => mockPostFormData(...args),
  },
}));

vi.mock('@turf/area', () => ({
  default: () => 1_000_000, // 100 ha
}));

vi.mock('@turf/helpers', () => ({
  polygon: (coords: unknown) => ({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: coords },
    properties: {},
  }),
}));

describe('extractPolygon', () => {
  it('should extract Polygon directly', () => {
    const poly: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    };
    expect(extractPolygon(poly)).toEqual(poly);
  });

  it('should extract from Feature', () => {
    const feature: GeoJSON.Feature = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      },
    };
    expect(extractPolygon(feature)?.type).toBe('Polygon');
  });

  it('should extract first polygon from FeatureCollection', () => {
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: [0, 0] },
        },
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 0],
              ],
            ],
          },
        },
      ],
    };
    expect(extractPolygon(fc)?.type).toBe('Polygon');
  });

  it('should extract first polygon from MultiPolygon', () => {
    const mp: GeoJSON.MultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
        [
          [
            [2, 2],
            [3, 2],
            [3, 3],
            [2, 2],
          ],
        ],
      ],
    };
    const result = extractPolygon(mp);
    expect(result?.type).toBe('Polygon');
    expect(result?.coordinates).toEqual([
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ]);
  });

  it('should return null for invalid data', () => {
    expect(extractPolygon(null)).toBeNull();
    expect(extractPolygon(42)).toBeNull();
    expect(extractPolygon({ type: 'Point', coordinates: [0, 0] })).toBeNull();
  });
});

describe('useBoundaryUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start in idle step', () => {
    const { result } = renderHook(() => useBoundaryUpload());
    expect(result.current.step).toBe('idle');
    expect(result.current.file).toBeNull();
    expect(result.current.clientPreview).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should reject unsupported file extensions', () => {
    const { result } = renderHook(() => useBoundaryUpload());
    const file = new File(['{}'], 'test.txt', { type: 'text/plain' });

    act(() => {
      result.current.selectFile(file, 100);
    });

    expect(result.current.step).toBe('idle');
    expect(result.current.error).toContain('Formato não suportado');
  });

  it('should transition to previewing for non-GeoJSON files', () => {
    const { result } = renderHook(() => useBoundaryUpload());
    const file = new File(['<kml></kml>'], 'test.kml', { type: 'application/xml' });

    act(() => {
      result.current.selectFile(file, 100);
    });

    expect(result.current.step).toBe('previewing');
    expect(result.current.canPreview).toBe(false);
    expect(result.current.clientPreview).toBeNull();
  });

  it('should parse GeoJSON files and transition to previewing', async () => {
    const geojson = JSON.stringify({
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    });
    const file = new File([geojson], 'boundary.geojson', { type: 'application/json' });

    const { result } = renderHook(() => useBoundaryUpload());

    act(() => {
      result.current.selectFile(file, 100);
    });

    // Wait for FileReader to complete
    await vi.waitFor(() => {
      expect(result.current.step).toBe('previewing');
    });

    expect(result.current.canPreview).toBe(true);
    expect(result.current.clientPreview).not.toBeNull();
    expect(result.current.clientPreview?.areaHa).toBe(100);
  });

  it('should handle invalid JSON in GeoJSON file', async () => {
    const file = new File(['not json!'], 'bad.geojson', { type: 'application/json' });

    const { result } = renderHook(() => useBoundaryUpload());

    act(() => {
      result.current.selectFile(file, 100);
    });

    await vi.waitFor(() => {
      expect(result.current.step).toBe('idle');
    });

    expect(result.current.error).toContain('GeoJSON inválido');
  });

  it('should handle GeoJSON with no polygon', async () => {
    const geojson = JSON.stringify({ type: 'Point', coordinates: [0, 0] });
    const file = new File([geojson], 'point.geojson', { type: 'application/json' });

    const { result } = renderHook(() => useBoundaryUpload());

    act(() => {
      result.current.selectFile(file, 100);
    });

    await vi.waitFor(() => {
      expect(result.current.step).toBe('idle');
    });

    expect(result.current.error).toContain('Nenhum polígono');
  });

  it('should upload file and transition to done', async () => {
    const uploadResult = {
      boundaryAreaHa: 100,
      areaDivergence: null,
      warnings: [],
    };
    mockPostFormData.mockResolvedValue(uploadResult);

    const { result } = renderHook(() => useBoundaryUpload());
    const file = new File(['<kml></kml>'], 'test.kml', { type: 'application/xml' });

    act(() => {
      result.current.selectFile(file, 100);
    });

    await act(async () => {
      await result.current.upload('farm-1');
    });

    expect(result.current.step).toBe('done');
    expect(result.current.result).toEqual(uploadResult);
    expect(mockPostFormData).toHaveBeenCalledWith(
      '/org/farms/farm-1/boundary',
      expect.any(FormData),
    );
  });

  it('should handle upload error and return to idle', async () => {
    mockPostFormData.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useBoundaryUpload());
    const file = new File(['<kml></kml>'], 'test.kml', { type: 'application/xml' });

    act(() => {
      result.current.selectFile(file, 100);
    });

    await act(async () => {
      await result.current.upload('farm-1');
    });

    expect(result.current.step).toBe('idle');
    expect(result.current.error).toBe('Network error');
  });

  it('should reset to idle state', async () => {
    const { result } = renderHook(() => useBoundaryUpload());
    const file = new File(['<kml></kml>'], 'test.kml', { type: 'application/xml' });

    act(() => {
      result.current.selectFile(file, 100);
    });

    expect(result.current.step).toBe('previewing');

    act(() => {
      result.current.reset();
    });

    expect(result.current.step).toBe('idle');
    expect(result.current.file).toBeNull();
    expect(result.current.clientPreview).toBeNull();
  });

  it('should calculate divergence percentage', async () => {
    const geojson = JSON.stringify({
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    });
    const file = new File([geojson], 'b.geojson', { type: 'application/json' });

    const { result } = renderHook(() => useBoundaryUpload());

    act(() => {
      result.current.selectFile(file, 50); // farm is 50ha, turf returns 100ha → 100% divergence
    });

    await vi.waitFor(() => {
      expect(result.current.step).toBe('previewing');
    });

    expect(result.current.clientPreview?.divergencePercentage).toBe(100);
  });
});
