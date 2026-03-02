import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { FarmMapData } from '@/hooks/useFarmMap';

// Mock react-leaflet to avoid Canvas issues in jsdom
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  GeoJSON: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="geojson-layer">{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({ fitBounds: vi.fn() }),
}));

vi.mock('leaflet', () => ({
  default: {
    geoJSON: () => ({
      getBounds: () => [
        [0, 0],
        [1, 1],
      ],
    }),
    latLngBounds: (a: number[], b: number[]) => [a, b],
  },
}));

const MOCK_DATA: FarmMapData = {
  farm: {
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
    productive: null,
    cib: null,
    incraCode: null,
    carCode: null,
    ccirCode: null,
    appAreaHa: null,
    legalReserveHa: null,
    taxableAreaHa: null,
    usableAreaHa: null,
    latitude: -18.9,
    longitude: -48.3,
    registrations: [],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  farmBoundary: {
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
  },
  registrationBoundaries: [],
  plotBoundaries: [],
};

const mockUseFarmMap = vi.fn();
vi.mock('@/hooks/useFarmMap', () => ({
  useFarmMap: (...args: unknown[]) => mockUseFarmMap(...args),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/farms/farm-1/map']}>
      <Routes>
        <Route path="/farms/:farmId/map" element={<FarmMapPageWrapper />} />
      </Routes>
    </MemoryRouter>,
  );
}

function FarmMapPageWrapper() {
  // Dynamic import won't work in sync test, so we import at module level
  return <FarmMapPage />;
}

// We need a static import for the test wrapper
import FarmMapPage from './FarmMapPage';

describe('FarmMapPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render farm name in header when loaded', () => {
    mockUseFarmMap.mockReturnValue({
      data: MOCK_DATA,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByRole('heading', { name: 'Fazenda Sol' })).toBeDefined();
  });

  it('should render loading skeleton', () => {
    mockUseFarmMap.mockReturnValue({ data: null, isLoading: true, error: null, refetch: vi.fn() });
    renderPage();
    const loadingEl = document.querySelector('[aria-busy="true"]');
    expect(loadingEl).not.toBeNull();
  });

  it('should render error state', () => {
    mockUseFarmMap.mockReturnValue({
      data: null,
      isLoading: false,
      error: 'Fazenda não encontrada',
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('Não foi possível carregar o mapa')).toBeDefined();
    expect(screen.getByText('Fazenda não encontrada')).toBeDefined();
  });

  it('should toggle layer and basemap state', () => {
    mockUseFarmMap.mockReturnValue({
      data: MOCK_DATA,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();

    // Check basemap buttons exist
    const satBtn = screen.getByText('Satélite');
    const topoBtn = screen.getByText('Topo');
    expect(satBtn.closest('button')?.getAttribute('aria-pressed')).toBe('true');
    expect(topoBtn.closest('button')?.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(topoBtn);
    expect(topoBtn.closest('button')?.getAttribute('aria-pressed')).toBe('true');
    expect(satBtn.closest('button')?.getAttribute('aria-pressed')).toBe('false');
  });
});
