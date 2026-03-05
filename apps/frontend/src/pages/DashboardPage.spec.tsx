import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { OrgDashboardStats } from '@/types/dashboard';

const mockUseDashboard = vi.fn();
vi.mock('@/hooks/useDashboard', () => ({
  useDashboard: () => mockUseDashboard(),
}));

const MOCK_STATS: OrgDashboardStats = {
  summary: {
    totalFarms: 5,
    totalPlots: 12,
    totalAreaHa: 1500.5,
    activeUsers: 8,
  },
  farmsByUf: [
    { uf: 'MG', count: 3 },
    { uf: 'SP', count: 2 },
  ],
  recentActivity: [
    {
      id: 'log-1',
      actorEmail: 'joao@org.com',
      action: 'CREATE_FARM',
      targetType: 'farm',
      targetId: 'farm-1',
      metadata: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'log-2',
      actorEmail: 'maria@org.com',
      action: 'UPDATE_FIELD_PLOT',
      targetType: 'field_plot',
      targetId: 'plot-1',
      metadata: null,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ],
  alerts: {
    farmLimit: { current: 5, max: 10, percentage: 50, warning: false },
    userLimit: { current: 8, max: 10, percentage: 80, warning: true },
    expiringContracts: { total: 0, alerts: [] },
  },
};

async function renderPage() {
  const { default: DashboardPage } = await import('./DashboardPage');
  return render(<DashboardPage />);
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render skeleton loading state', async () => {
    mockUseDashboard.mockReturnValue({
      stats: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    await renderPage();
    const skeletons = document.querySelectorAll('.org-dashboard__skeleton');
    expect(skeletons.length).toBeGreaterThanOrEqual(4);
  });

  it('should render error state', async () => {
    mockUseDashboard.mockReturnValue({
      stats: null,
      isLoading: false,
      error: 'Não foi possível carregar',
      refetch: vi.fn(),
    });

    await renderPage();
    expect(screen.getByRole('alert').textContent).toContain('Não foi possível carregar');
  });

  it('should render 4 summary cards (CA1)', async () => {
    mockUseDashboard.mockReturnValue({
      stats: MOCK_STATS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    await renderPage();

    expect(screen.getByText('FAZENDAS')).toBeDefined();
    expect(screen.getByText('TALHÕES')).toBeDefined();
    expect(screen.getByText('ÁREA TOTAL')).toBeDefined();
    expect(screen.getByText('USUÁRIOS ATIVOS')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
    expect(screen.getByText('12')).toBeDefined();
    expect(screen.getByText('1.500,5 ha')).toBeDefined();
    expect(screen.getByText('8')).toBeDefined();
  });

  it('should render farms by UF bars (CA2)', async () => {
    mockUseDashboard.mockReturnValue({
      stats: MOCK_STATS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    await renderPage();

    expect(screen.getByText('MG')).toBeDefined();
    expect(screen.getByText('SP')).toBeDefined();

    const bars = screen.getAllByRole('progressbar');
    expect(bars.length).toBe(2);
  });

  it('should render recent activity (CA3)', async () => {
    mockUseDashboard.mockReturnValue({
      stats: MOCK_STATS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    await renderPage();

    expect(screen.getByText('joao')).toBeDefined();
    expect(screen.getByText('Cadastrou uma fazenda')).toBeDefined();
    expect(screen.getByText('maria')).toBeDefined();
    expect(screen.getByText('Editou um talhão')).toBeDefined();
  });

  it('should render alerts (CA4)', async () => {
    mockUseDashboard.mockReturnValue({
      stats: MOCK_STATS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    await renderPage();

    expect(screen.getByText('80% do limite de usuários utilizado')).toBeDefined();
    expect(screen.getByText('8 de 10')).toBeDefined();
  });

  it('should show empty state when no alerts', async () => {
    const noAlerts = {
      ...MOCK_STATS,
      alerts: {
        farmLimit: { current: 1, max: 10, percentage: 10, warning: false },
        userLimit: { current: 2, max: 10, percentage: 20, warning: false },
        expiringContracts: { total: 0, alerts: [] },
      },
    };

    mockUseDashboard.mockReturnValue({
      stats: noAlerts,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    await renderPage();
    expect(screen.getByText('Nenhum alerta no momento')).toBeDefined();
  });

  it('should show empty state for farms by UF', async () => {
    mockUseDashboard.mockReturnValue({
      stats: { ...MOCK_STATS, farmsByUf: [] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    await renderPage();
    expect(screen.getByText('Nenhuma fazenda cadastrada')).toBeDefined();
  });

  it('should show empty state for recent activity', async () => {
    mockUseDashboard.mockReturnValue({
      stats: { ...MOCK_STATS, recentActivity: [] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    await renderPage();
    expect(screen.getByText('Nenhuma atividade registrada')).toBeDefined();
  });
});
