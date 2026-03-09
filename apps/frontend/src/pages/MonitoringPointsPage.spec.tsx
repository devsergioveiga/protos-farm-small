import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { MonitoringPointItem } from '@/types/monitoring-point';

const MOCK_POINTS: MonitoringPointItem[] = [
  {
    id: 'point-1',
    farmId: 'farm-1',
    fieldPlotId: 'plot-1',
    code: 'P01',
    latitude: -23.5505199,
    longitude: -46.6333094,
    notes: 'Próximo à cerca',
    createdAt: '2026-03-09T00:00:00.000Z',
    updatedAt: '2026-03-09T00:00:00.000Z',
  },
  {
    id: 'point-2',
    farmId: 'farm-1',
    fieldPlotId: 'plot-1',
    code: 'P02',
    latitude: -23.551,
    longitude: -46.634,
    notes: null,
    createdAt: '2026-03-09T00:00:00.000Z',
    updatedAt: '2026-03-09T00:00:00.000Z',
  },
];

const mockUseMonitoringPoints = vi.fn();

vi.mock('@/hooks/useMonitoringPoints', () => ({
  useMonitoringPoints: (...args: unknown[]) => mockUseMonitoringPoints(...args),
}));

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ plots: [{ id: 'plot-1', name: 'Talhão Norte' }] }),
    post: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ farmId: 'farm-1', fieldPlotId: 'plot-1' }),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  };
});

vi.mock('@/components/auth/PermissionGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/monitoring-points/MonitoringPointModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="mp-modal">Modal</div> : null,
}));

import MonitoringPointsPage from './MonitoringPointsPage';

describe('MonitoringPointsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render title', () => {
    mockUseMonitoringPoints.mockReturnValue({
      points: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<MonitoringPointsPage />);
    expect(screen.getByText('Pontos de Monitoramento MIP')).toBeTruthy();
  });

  it('should show empty state when no points', () => {
    mockUseMonitoringPoints.mockReturnValue({
      points: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<MonitoringPointsPage />);
    expect(screen.getByText('Nenhum ponto de monitoramento')).toBeTruthy();
    expect(screen.getByText(/Configure pontos de amostragem/)).toBeTruthy();
  });

  it('should show skeleton while loading', () => {
    mockUseMonitoringPoints.mockReturnValue({
      points: [],
      meta: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    const { container } = render(<MonitoringPointsPage />);
    const skeletons = container.querySelectorAll('.mp-page__skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should show error message', () => {
    mockUseMonitoringPoints.mockReturnValue({
      points: [],
      meta: null,
      isLoading: false,
      error: 'Erro ao carregar pontos de monitoramento',
      refetch: vi.fn(),
    });

    render(<MonitoringPointsPage />);
    expect(screen.getByText('Erro ao carregar pontos de monitoramento')).toBeTruthy();
  });

  it('should render monitoring points table', () => {
    mockUseMonitoringPoints.mockReturnValue({
      points: MOCK_POINTS,
      meta: { page: 1, limit: 50, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<MonitoringPointsPage />);
    // Table headers
    expect(screen.getAllByText('Código').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Latitude').length).toBeGreaterThan(0);
    // Point data
    expect(screen.getAllByText('P01').length).toBeGreaterThan(0);
    expect(screen.getAllByText('P02').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Próximo à cerca').length).toBeGreaterThan(0);
  });

  it('should open modal when "Novo ponto" clicked', async () => {
    const user = userEvent.setup();
    mockUseMonitoringPoints.mockReturnValue({
      points: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<MonitoringPointsPage />);
    const addButtons = screen.getAllByText('Adicionar ponto manualmente');
    await user.click(addButtons[0]);

    expect(screen.getByTestId('mp-modal')).toBeTruthy();
  });

  it('should show grid generation form when "Gerar grade" clicked', async () => {
    const user = userEvent.setup();
    mockUseMonitoringPoints.mockReturnValue({
      points: MOCK_POINTS,
      meta: { page: 1, limit: 50, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<MonitoringPointsPage />);
    const gridBtn = screen.getByText('Gerar grade');
    await user.click(gridBtn);

    expect(screen.getByText(/Gera pontos de monitoramento em grade regular/)).toBeTruthy();
    expect(screen.getByLabelText('Espaçamento (metros)')).toBeTruthy();
  });

  it('should show back link to farm map', () => {
    mockUseMonitoringPoints.mockReturnValue({
      points: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<MonitoringPointsPage />);
    const backLink = screen.getByText('Voltar ao mapa');
    expect(backLink.closest('a')?.getAttribute('href')).toBe('/farms/farm-1/map');
  });
});
