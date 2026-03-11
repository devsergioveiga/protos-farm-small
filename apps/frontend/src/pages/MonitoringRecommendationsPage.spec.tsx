import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MonitoringRecommendationsPage from './MonitoringRecommendationsPage';
import type { RecommendationsResponse } from '@/types/monitoring-record';

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('@/stores/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: 'u1', role: 'ADMIN', permissions: ['farms:read', 'farms:update'] },
    permissions: ['farms:read', 'farms:update'],
  }),
}));

import { api } from '@/services/api';

const mockedApi = vi.mocked(api);

const SAMPLE_RESPONSE: RecommendationsResponse = {
  data: [
    {
      pestId: 'pest-1',
      pestName: 'Lagarta-da-soja',
      pestCategory: 'INSETO',
      pestCategoryLabel: 'Inseto',
      severity: 'ALTO',
      severityLabel: 'Alto',
      controlThreshold: 'MODERADO',
      controlThresholdLabel: 'Moderado',
      ndeDescription: '20% folhas raspadas',
      ncDescription: '2 lagartas por planta',
      recommendedProducts: 'Clorantraniliprole 200g/L — 100-150 mL/ha',
      urgency: 'ALERTA',
      urgencyLabel: 'Alerta',
      affectedPoints: [
        {
          monitoringPointId: 'point-1',
          code: 'P01',
          latitude: -23.5,
          longitude: -46.6,
          currentLevel: 'ALTO',
          currentLevelLabel: 'Alto',
          lastObservedAt: '2026-03-09T10:00:00.000Z',
          damagePercentage: 15.5,
        },
        {
          monitoringPointId: 'point-2',
          code: 'P02',
          latitude: -23.51,
          longitude: -46.61,
          currentLevel: 'MODERADO',
          currentLevelLabel: 'Moderado',
          lastObservedAt: '2026-03-08T14:00:00.000Z',
          damagePercentage: null,
        },
      ],
      affectedPointCount: 2,
      maxLevel: 'ALTO',
      maxLevelLabel: 'Alto',
      avgDamagePercentage: 15.5,
      hasNaturalEnemies: true,
      trend: 'increasing',
      trendLabel: 'Em alta',
    },
  ],
  summary: {
    totalRecommendations: 1,
    criticalCount: 0,
    alertCount: 1,
    totalAffectedPoints: 2,
  },
};

const EMPTY_RESPONSE: RecommendationsResponse = {
  data: [],
  summary: {
    totalRecommendations: 0,
    criticalCount: 0,
    alertCount: 0,
    totalAffectedPoints: 0,
  },
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/farms/farm-1/plots/plot-1/monitoring-recommendations']}>
      <Routes>
        <Route
          path="/farms/:farmId/plots/:fieldPlotId/monitoring-recommendations"
          element={<MonitoringRecommendationsPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MonitoringRecommendationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeletons initially', () => {
    mockedApi.get.mockImplementation(() => new Promise(() => {}));
    renderPage();

    expect(screen.getByLabelText('Carregando resumo')).toBeDefined();
  });

  it('renders empty state when no recommendations', async () => {
    mockedApi.get.mockResolvedValue(EMPTY_RESPONSE);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nenhuma recomendação no momento')).toBeDefined();
    });
    expect(screen.getByText('Configurar pragas')).toBeDefined();
  });

  it('renders recommendation cards when data exists', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('monitoring-recommendations')) return Promise.resolve(SAMPLE_RESPONSE);
      if (url.includes('/plots'))
        return Promise.resolve({ plots: [{ id: 'plot-1', name: 'Talhão A' }] });
      return Promise.resolve({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0 } });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Lagarta-da-soja')).toBeDefined();
    });

    // Summary cards
    expect(screen.getByText('Total de alertas')).toBeDefined();
    expect(screen.getByText('Alertas')).toBeDefined();

    // Recommendation details
    expect(screen.getByText('Alerta')).toBeDefined();
    expect(screen.getByText('Inseto · Severidade Alto')).toBeDefined();
    expect(screen.getByText('Moderado')).toBeDefined(); // control threshold
    expect(screen.getByText('Em alta')).toBeDefined();

    // NDE/NC descriptions
    expect(screen.getByText('20% folhas raspadas')).toBeDefined();
    expect(screen.getByText('2 lagartas por planta')).toBeDefined();

    // Recommended products
    expect(screen.getByText('Clorantraniliprole 200g/L — 100-150 mL/ha')).toBeDefined();

    // Natural enemies
    expect(screen.getByText('Presentes')).toBeDefined();

    // Disclaimer
    expect(screen.getByText(/decisão final é do agrônomo/)).toBeDefined();
  });

  it('expands affected points on click', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('monitoring-recommendations')) return Promise.resolve(SAMPLE_RESPONSE);
      if (url.includes('/plots')) return Promise.resolve({ plots: [] });
      return Promise.resolve({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0 } });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Lagarta-da-soja')).toBeDefined();
    });

    // Click to expand affected points
    const expandBtn = screen.getByText(/Ver 2 pontos afetados/);
    fireEvent.click(expandBtn);

    await waitFor(() => {
      expect(screen.getAllByText('P01').length).toBeGreaterThan(0);
      expect(screen.getAllByText('P02').length).toBeGreaterThan(0);
    });

    // Heatmap link
    expect(screen.getByText('Ver no mapa de calor')).toBeDefined();
  });

  it('shows filter panel on button click', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('monitoring-recommendations')) return Promise.resolve(SAMPLE_RESPONSE);
      if (url.includes('/plots')) return Promise.resolve({ plots: [] });
      return Promise.resolve({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0 } });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Lagarta-da-soja')).toBeDefined();
    });

    const filterBtn = screen.getByText('Filtros');
    fireEvent.click(filterBtn);

    expect(screen.getByLabelText('Praga')).toBeDefined();
    expect(screen.getByLabelText('Urgência')).toBeDefined();
  });

  it('renders error state', async () => {
    mockedApi.get.mockRejectedValue(new Error('Erro de rede'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Erro de rede')).toBeDefined();
    });
  });

  it('renders page title and breadcrumb', async () => {
    mockedApi.get.mockResolvedValue(EMPTY_RESPONSE);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Recomendações de Controle')).toBeDefined();
    });

    expect(screen.getByText('Voltar aos pontos')).toBeDefined();
  });

  it('collapses expanded points on second click', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('monitoring-recommendations')) return Promise.resolve(SAMPLE_RESPONSE);
      if (url.includes('/plots')) return Promise.resolve({ plots: [] });
      return Promise.resolve({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0 } });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Lagarta-da-soja')).toBeDefined();
    });

    const expandBtn = screen.getByText(/Ver 2 pontos afetados/);
    fireEvent.click(expandBtn);

    await waitFor(() => {
      expect(screen.getAllByText('P01').length).toBeGreaterThan(0);
    });

    // Click again to collapse
    const collapseBtn = screen.getByText('Ocultar pontos afetados');
    fireEvent.click(collapseBtn);

    await waitFor(() => {
      expect(screen.queryAllByText('P01')).toHaveLength(0);
    });
  });

  it('shows plot name in subtitle', async () => {
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('monitoring-recommendations')) return Promise.resolve(SAMPLE_RESPONSE);
      if (url.includes('/plots'))
        return Promise.resolve({ plots: [{ id: 'plot-1', name: 'Talhão Norte' }] });
      return Promise.resolve({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0 } });
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Talhão Norte/)).toBeDefined();
    });
  });
});
