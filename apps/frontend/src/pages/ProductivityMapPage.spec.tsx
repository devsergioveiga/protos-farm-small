import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductivityMapPage from './ProductivityMapPage';

// Mock leaflet — avoid DOM rendering issues in tests
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  GeoJSON: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="geojson-layer">{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
}));

vi.mock('leaflet', () => ({
  default: {
    geoJSON: vi.fn(() => ({
      getBounds: vi.fn(() => ({
        getSouthWest: () => ({ lat: -20, lng: -50 }),
        getNorthEast: () => ({ lat: -15, lng: -45 }),
      })),
    })),
  },
}));

vi.mock('@/components/map/MapAutoFit', () => ({
  default: () => <div data-testid="map-auto-fit" />,
}));

vi.mock('@/components/map/FarmMap', () => ({
  formatArea: (ha: number | null) => {
    if (ha == null) return '—';
    return `${Number(ha).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha`;
  },
}));

const mockFarmContext = {
  farms: [],
  selectedFarmId: 'farm-1' as string | null,
  selectedFarm: { id: 'farm-1', name: 'Fazenda Teste' } as { id: string; name: string } | null,
  selectFarm: vi.fn(),
  refreshFarms: vi.fn(),
};

vi.mock('@/stores/FarmContext', () => ({
  useFarmContext: () => mockFarmContext,
}));

const mockFarmMapData = {
  farm: { id: 'farm-1', name: 'Fazenda Teste', totalAreaHa: '100', registrations: [] },
  farmBoundary: {
    hasBoundary: true,
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
  plotBoundaries: [
    {
      plotId: 'plot-1',
      plot: {
        id: 'plot-1',
        name: 'Talhão A',
        boundaryAreaHa: 50,
        currentCrop: 'Soja',
        status: 'ACTIVE',
      },
      boundary: {
        hasBoundary: true,
        boundaryGeoJSON: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [0.5, 0],
              [0.5, 0.5],
              [0, 0.5],
              [0, 0],
            ],
          ],
        },
      },
    },
  ],
  locationBoundaries: [],
};

const mockUseFarmMap = vi.fn(() => ({
  data: mockFarmMapData,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
}));

vi.mock('@/hooks/useFarmMap', () => ({
  useFarmMap: (...args: unknown[]) => mockUseFarmMap(...args),
}));

const mockProductivityData = {
  plots: [
    {
      fieldPlotId: 'plot-1',
      fieldPlotName: 'Talhão A',
      fieldPlotAreaHa: 50,
      cultureType: 'GRAOS',
      crop: 'Soja',
      totalProduction: 300,
      productionUnit: 'sc',
      productivityPerHa: 60,
      productivityUnit: 'sc/ha',
      harvestCount: 5,
      level: 'ALTA',
      deviationFromAvg: 20,
      dateRange: { first: '2026-01-15', last: '2026-02-28' },
    },
  ],
  summary: {
    totalPlots: 2,
    plotsWithData: 1,
    avgProductivityPerHa: 50,
    productivityUnit: 'sc/ha',
    levels: { ALTA: 1, MEDIA: 0, BAIXA: 0, SEM_DADOS: 1 },
  },
  filters: {
    cultureType: null,
    crop: null,
    dateFrom: null,
    dateTo: null,
  },
};

const mockUseProductivityMap = vi.fn(() => ({
  data: mockProductivityData,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
}));

vi.mock('@/hooks/useProductivityMap', () => ({
  useProductivityMap: (...args: unknown[]) => mockUseProductivityMap(...args),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ProductivityMapPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFarmContext.selectedFarmId = 'farm-1';
  mockFarmContext.selectedFarm = { id: 'farm-1', name: 'Fazenda Teste' };
  mockUseFarmMap.mockReturnValue({
    data: mockFarmMapData,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
  mockUseProductivityMap.mockReturnValue({
    data: mockProductivityData,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
});

describe('ProductivityMapPage', () => {
  it('renders the page title and subtitle', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Mapa de produtividade' })).toBeDefined();
    expect(screen.getByText('Fazenda Teste')).toBeDefined();
  });

  it('shows empty state when no farm selected', () => {
    mockFarmContext.selectedFarmId = null;
    renderPage();
    expect(screen.getByText('Selecione uma fazenda')).toBeDefined();
  });

  it('shows error state when there is an error', () => {
    mockUseProductivityMap.mockReturnValue({
      data: null,
      isLoading: false,
      error: 'Falha ao carregar dados',
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('Erro ao carregar dados')).toBeDefined();
    expect(screen.getByText('Falha ao carregar dados')).toBeDefined();
  });

  it('renders the map container', () => {
    renderPage();
    expect(screen.getByTestId('map-container')).toBeDefined();
  });

  it('renders the legend with productivity levels', () => {
    renderPage();
    expect(screen.getByText('Acima da meta')).toBeDefined();
    expect(screen.getByText('Na meta')).toBeDefined();
    expect(screen.getByText('Abaixo da meta')).toBeDefined();
    expect(screen.getByText('Sem dados')).toBeDefined();
  });

  it('shows the ranking sidebar', () => {
    renderPage();
    expect(screen.getByText('Ranking por talhão')).toBeDefined();
    expect(screen.getByLabelText('Ranking de talhões')).toBeDefined();
  });

  it('shows ranking with productivity details', () => {
    renderPage();
    expect(screen.getByText(/1 de 2 talhões com dados/)).toBeDefined();
  });

  it('toggles filter panel', async () => {
    renderPage();
    const filterBtn = screen.getByRole('button', { name: /filtros/i });
    expect(screen.queryByLabelText('Cultura')).toBeNull();

    fireEvent.click(filterBtn);
    await waitFor(() => {
      expect(screen.getByLabelText('Cultura')).toBeDefined();
      expect(screen.getByLabelText('Data início')).toBeDefined();
      expect(screen.getByLabelText('Data fim')).toBeDefined();
    });
  });

  it('calls useProductivityMap with correct params when filter changes', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /filtros/i }));

    const cultureSelect = screen.getByLabelText('Cultura');
    fireEvent.change(cultureSelect, { target: { value: 'GRAOS' } });

    await waitFor(() => {
      expect(mockUseProductivityMap).toHaveBeenCalledWith(
        expect.objectContaining({ cultureType: 'GRAOS' }),
      );
    });
  });

  it('shows loading skeleton when loading', () => {
    mockUseFarmMap.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(document.querySelector('[aria-busy="true"]')).toBeDefined();
  });

  it('shows base map toggle buttons', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Mapa satélite' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Mapa topográfico' })).toBeDefined();
  });

  it('shows average productivity in legend', () => {
    renderPage();
    expect(screen.getByText(/Média: 50/)).toBeDefined();
  });

  it('shows empty ranking when no harvest data', () => {
    mockUseProductivityMap.mockReturnValue({
      data: {
        ...mockProductivityData,
        plots: [
          {
            ...mockProductivityData.plots[0],
            level: 'SEM_DADOS',
            harvestCount: 0,
            productivityPerHa: 0,
          },
        ],
        summary: { ...mockProductivityData.summary, plotsWithData: 0 },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText(/Nenhum dado de colheita encontrado/)).toBeDefined();
  });

  it('renders breadcrumb navigation', () => {
    renderPage();
    expect(screen.getByLabelText('Breadcrumb')).toBeDefined();
  });

  it('shows clear filters button when filters are active', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /filtros/i }));

    const cultureSelect = screen.getByLabelText('Cultura');
    fireEvent.change(cultureSelect, { target: { value: 'CAFE' } });

    await waitFor(() => {
      expect(screen.getByText('Limpar filtros')).toBeDefined();
    });
  });
});
