import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MonitoringHeatmapPage from './MonitoringHeatmapPage';
import type { HeatmapPoint } from '@/types/monitoring-record';

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  CircleMarker: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="circle-marker">{children}</div>
  ),
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip">{children}</div>
  ),
  GeoJSON: () => <div data-testid="geojson-layer" />,
}));

vi.mock('@/components/map/MapAutoFit', () => ({
  default: () => null,
}));

vi.mock('@/stores/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: 'u1', role: 'ADMIN', permissions: ['farms:read', 'farms:update'] },
    permissions: ['farms:read', 'farms:update'],
  }),
}));

import { api } from '@/services/api';

const mockedApi = vi.mocked(api);

const SAMPLE_POINTS: HeatmapPoint[] = [
  {
    monitoringPointId: 'point-1',
    code: 'P01',
    latitude: -15.5,
    longitude: -47.5,
    intensity: 0.75,
    maxLevel: 'ALTO',
    recordCount: 3,
    topPests: [{ pestId: 'pest-1', pestName: 'Lagarta-da-soja', count: 2 }],
  },
  {
    monitoringPointId: 'point-2',
    code: 'P02',
    latitude: -15.51,
    longitude: -47.51,
    intensity: 0.25,
    maxLevel: 'BAIXO',
    recordCount: 1,
    topPests: [{ pestId: 'pest-2', pestName: 'Percevejo-marrom', count: 1 }],
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/farms/farm-1/plots/plot-1/monitoring-heatmap']}>
      <Routes>
        <Route
          path="/farms/:farmId/plots/:fieldPlotId/monitoring-heatmap"
          element={<MonitoringHeatmapPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MonitoringHeatmapPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render empty state when no heatmap data', async () => {
    mockedApi.get.mockImplementation((path: string) => {
      if (path.includes('monitoring-heatmap')) return Promise.resolve({ data: [] });
      if (path.includes('/plots')) return Promise.resolve({ plots: [] });
      if (path.includes('/boundary')) return Promise.resolve({ hasBoundary: false });
      if (path.includes('/pests'))
        return Promise.resolve({
          data: [],
          meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
        });
      return Promise.resolve({});
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Sem dados para o mapa de calor')).toBeDefined();
    });
  });

  it('should render map with heatmap markers', async () => {
    mockedApi.get.mockImplementation((path: string) => {
      if (path.includes('monitoring-heatmap')) return Promise.resolve({ data: SAMPLE_POINTS });
      if (path.includes('/plots'))
        return Promise.resolve({ plots: [{ id: 'plot-1', name: 'Talhão Norte' }] });
      if (path.includes('/boundary')) return Promise.resolve({ hasBoundary: false });
      if (path.includes('/pests'))
        return Promise.resolve({
          data: [],
          meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
        });
      return Promise.resolve({});
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('map-container')).toBeDefined();
    });

    expect(screen.getAllByTestId('circle-marker')).toHaveLength(2);
  });

  it('should show plot name in subtitle', async () => {
    mockedApi.get.mockImplementation((path: string) => {
      if (path.includes('monitoring-heatmap')) return Promise.resolve({ data: SAMPLE_POINTS });
      if (path.includes('/plots'))
        return Promise.resolve({ plots: [{ id: 'plot-1', name: 'Talhão Norte' }] });
      if (path.includes('/boundary')) return Promise.resolve({ hasBoundary: false });
      if (path.includes('/pests'))
        return Promise.resolve({
          data: [],
          meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
        });
      return Promise.resolve({});
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Talhão Norte/)).toBeDefined();
    });
  });

  it('should render legend with all infestation levels', async () => {
    mockedApi.get.mockImplementation((path: string) => {
      if (path.includes('monitoring-heatmap')) return Promise.resolve({ data: SAMPLE_POINTS });
      if (path.includes('/plots')) return Promise.resolve({ plots: [] });
      if (path.includes('/boundary')) return Promise.resolve({ hasBoundary: false });
      if (path.includes('/pests'))
        return Promise.resolve({
          data: [],
          meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
        });
      return Promise.resolve({});
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Legenda do mapa de calor' })).toBeDefined();
    });
    const legend = screen.getByRole('img', { name: 'Legenda do mapa de calor' });
    expect(legend.textContent).toContain('Ausente');
    expect(legend.textContent).toContain('Baixo');
    expect(legend.textContent).toContain('Moderado');
    expect(legend.textContent).toContain('Alto');
    expect(legend.textContent).toContain('Crítico');
  });

  it('should render summary cards for each point', async () => {
    mockedApi.get.mockImplementation((path: string) => {
      if (path.includes('monitoring-heatmap')) return Promise.resolve({ data: SAMPLE_POINTS });
      if (path.includes('/plots')) return Promise.resolve({ plots: [] });
      if (path.includes('/boundary')) return Promise.resolve({ hasBoundary: false });
      if (path.includes('/pests'))
        return Promise.resolve({
          data: [],
          meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
        });
      return Promise.resolve({});
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Resumo por ponto')).toBeDefined();
    });
    const summaryCards = screen.getAllByText(/^P0[12]$/);
    expect(summaryCards.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('3 registros')).toBeDefined();
    expect(screen.getByText('1 registro')).toBeDefined();
    expect(screen.getByText('Lagarta-da-soja (2)')).toBeDefined();
  });

  it('should toggle filter panel', async () => {
    mockedApi.get.mockImplementation((path: string) => {
      if (path.includes('monitoring-heatmap')) return Promise.resolve({ data: SAMPLE_POINTS });
      if (path.includes('/plots')) return Promise.resolve({ plots: [] });
      if (path.includes('/boundary')) return Promise.resolve({ hasBoundary: false });
      if (path.includes('/pests'))
        return Promise.resolve({
          data: [],
          meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
        });
      return Promise.resolve({});
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Mapa de Calor MIP')).toBeDefined();
    });

    expect(screen.queryByLabelText('Praga')).toBeNull();

    fireEvent.click(screen.getByText('Filtros'));

    expect(screen.getByLabelText('Praga')).toBeDefined();
    expect(screen.getByLabelText('Data início')).toBeDefined();
    expect(screen.getByLabelText('Data fim')).toBeDefined();
  });

  it('should show error state', async () => {
    mockedApi.get.mockImplementation((path: string) => {
      if (path.includes('monitoring-heatmap')) return Promise.reject(new Error('Falha na conexão'));
      if (path.includes('/plots')) return Promise.resolve({ plots: [] });
      if (path.includes('/boundary')) return Promise.resolve({ hasBoundary: false });
      if (path.includes('/pests'))
        return Promise.resolve({
          data: [],
          meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
        });
      return Promise.resolve({});
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Falha na conexão')).toBeDefined();
    });
  });

  it('should have back link to monitoring points', async () => {
    mockedApi.get.mockImplementation((path: string) => {
      if (path.includes('monitoring-heatmap')) return Promise.resolve({ data: [] });
      if (path.includes('/plots')) return Promise.resolve({ plots: [] });
      if (path.includes('/boundary')) return Promise.resolve({ hasBoundary: false });
      if (path.includes('/pests'))
        return Promise.resolve({
          data: [],
          meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
        });
      return Promise.resolve({});
    });

    renderPage();

    await waitFor(() => {
      const backLink = screen.getByText('Voltar aos pontos');
      expect(backLink.closest('a')?.getAttribute('href')).toBe(
        '/farms/farm-1/plots/plot-1/monitoring-points',
      );
    });
  });
});
