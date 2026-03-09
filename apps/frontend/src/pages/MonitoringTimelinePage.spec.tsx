import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MonitoringTimelinePage from './MonitoringTimelinePage';
import type { TimelineResponse } from '@/types/monitoring-record';

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Legend: () => <div data-testid="legend" />,
}));

vi.mock('@/stores/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: 'u1', role: 'ADMIN', permissions: ['farms:read', 'farms:update'] },
    permissions: ['farms:read', 'farms:update'],
  }),
}));

import { api } from '@/services/api';

const mockedApi = vi.mocked(api);

const SAMPLE_TIMELINE: TimelineResponse = {
  data: [
    {
      date: '2026-03-01',
      pests: [
        {
          pestId: 'pest-1',
          pestName: 'Lagarta-da-soja',
          avgIntensity: 0.3,
          maxLevel: 'MODERADO',
          recordCount: 5,
        },
        {
          pestId: 'pest-2',
          pestName: 'Percevejo-marrom',
          avgIntensity: 0.1,
          maxLevel: 'BAIXO',
          recordCount: 2,
        },
      ],
    },
    {
      date: '2026-03-08',
      pests: [
        {
          pestId: 'pest-1',
          pestName: 'Lagarta-da-soja',
          avgIntensity: 0.6,
          maxLevel: 'ALTO',
          recordCount: 4,
        },
        {
          pestId: 'pest-2',
          pestName: 'Percevejo-marrom',
          avgIntensity: 0.25,
          maxLevel: 'BAIXO',
          recordCount: 3,
        },
      ],
    },
  ],
  summary: {
    totalRecords: 14,
    dateRange: { start: '2026-03-01', end: '2026-03-08' },
    pestsFound: ['Lagarta-da-soja', 'Percevejo-marrom'],
  },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/farms/farm-1/plots/plot-1/monitoring-timeline']}>
      <Routes>
        <Route
          path="/farms/:farmId/plots/:fieldPlotId/monitoring-timeline"
          element={<MonitoringTimelinePage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function mockApiEmpty() {
  mockedApi.get.mockImplementation((path: string) => {
    if (path.includes('monitoring-timeline')) return Promise.resolve({ data: [], summary: null });
    if (path.includes('/plots')) return Promise.resolve({ plots: [] });
    if (path.includes('/pests'))
      return Promise.resolve({
        data: [],
        meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
      });
    return Promise.resolve({});
  });
}

function mockApiWithData() {
  mockedApi.get.mockImplementation((path: string) => {
    if (path.includes('monitoring-timeline')) return Promise.resolve(SAMPLE_TIMELINE);
    if (path.includes('/plots'))
      return Promise.resolve({ plots: [{ id: 'plot-1', name: 'Talhão Norte' }] });
    if (path.includes('/pests'))
      return Promise.resolve({
        data: [
          {
            id: 'pest-1',
            commonName: 'Lagarta-da-soja',
            scientificName: '',
            category: 'INSETO',
            crops: [],
          },
          {
            id: 'pest-2',
            commonName: 'Percevejo-marrom',
            scientificName: '',
            category: 'INSETO',
            crops: [],
          },
        ],
        meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
      });
    return Promise.resolve({});
  });
}

describe('MonitoringTimelinePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading skeleton initially', () => {
    mockedApi.get.mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    renderPage();

    expect(screen.getByLabelText('Carregando gráfico')).toBeDefined();
    expect(screen.getByLabelText('Carregando tabela')).toBeDefined();
  });

  it('should render empty state when no timeline data', async () => {
    mockApiEmpty();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Sem dados de histórico')).toBeDefined();
    });
    expect(screen.getByText(/Registre observações nos pontos de monitoramento/)).toBeDefined();
    expect(screen.getByText('Ir para registros')).toBeDefined();
  });

  it('should render chart and summary cards with data', async () => {
    mockApiWithData();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Intensidade ao longo do tempo')).toBeDefined();
    });

    // Summary cards
    expect(screen.getByText('Total de registros')).toBeDefined();
    expect(screen.getByText('14')).toBeDefined();
    expect(screen.getByText('Pragas encontradas')).toBeDefined();
    const pestCountCards = screen.getAllByText('2');
    expect(pestCountCards.length).toBeGreaterThanOrEqual(1);

    // Chart container
    expect(screen.getByTestId('responsive-container')).toBeDefined();
  });

  it('should render data table with rows', async () => {
    mockApiWithData();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Dados detalhados')).toBeDefined();
    });

    // Table headers
    expect(screen.getByText('Data')).toBeDefined();
    expect(screen.getByText('Praga')).toBeDefined();
    const intensidadeElements = screen.getAllByText('Intensidade');
    expect(intensidadeElements.length).toBeGreaterThanOrEqual(1);

    // Table data
    const lagartaCells = screen.getAllByText('Lagarta-da-soja');
    expect(lagartaCells.length).toBeGreaterThanOrEqual(2);
  });

  it('should show plot name in subtitle', async () => {
    mockApiWithData();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Talhão Norte/)).toBeDefined();
    });
  });

  it('should toggle filter panel', async () => {
    mockApiWithData();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Intensidade ao longo do tempo')).toBeDefined();
    });

    // Filters should be hidden initially
    expect(screen.queryByText('Pragas')).toBeNull();

    fireEvent.click(screen.getByText('Filtros'));

    expect(screen.getByText('Pragas')).toBeDefined();
    expect(screen.getByLabelText('Data início')).toBeDefined();
    expect(screen.getByLabelText('Data fim')).toBeDefined();
    expect(screen.getByText('Diário')).toBeDefined();
    expect(screen.getByText('Semanal')).toBeDefined();
    expect(screen.getByText('Mensal')).toBeDefined();
  });

  it('should switch aggregation mode', async () => {
    mockApiWithData();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Intensidade ao longo do tempo')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Filtros'));

    const dailyBtn = screen.getByText('Diário');
    fireEvent.click(dailyBtn);

    expect(dailyBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('should show error state', async () => {
    mockedApi.get.mockImplementation((path: string) => {
      if (path.includes('monitoring-timeline'))
        return Promise.reject(new Error('Falha na conexão'));
      if (path.includes('/plots')) return Promise.resolve({ plots: [] });
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
    mockApiEmpty();

    renderPage();

    await waitFor(() => {
      const backLink = screen.getByText('Voltar aos pontos');
      expect(backLink.closest('a')?.getAttribute('href')).toBe(
        '/farms/farm-1/plots/plot-1/monitoring-points',
      );
    });
  });

  it('should render level badges in table', async () => {
    mockApiWithData();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Dados detalhados')).toBeDefined();
    });

    const altoBadges = screen.getAllByText('Alto');
    expect(altoBadges.length).toBeGreaterThanOrEqual(1);

    const moderadoBadges = screen.getAllByText('Moderado');
    expect(moderadoBadges.length).toBeGreaterThanOrEqual(1);
  });
});
