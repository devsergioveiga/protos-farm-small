import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { MonitoringRecordItem } from '@/types/monitoring-record';

const MOCK_RECORDS: MonitoringRecordItem[] = [
  {
    id: 'rec-1',
    farmId: 'farm-1',
    fieldPlotId: 'plot-1',
    monitoringPointId: 'point-1',
    monitoringPointCode: 'P01',
    pestId: 'pest-1',
    pestName: 'Lagarta-da-soja',
    pestCategory: 'INSETO',
    observedAt: '2026-03-09T10:00:00.000Z',
    infestationLevel: 'MODERADO',
    infestationLevelLabel: 'Moderado',
    sampleCount: 5,
    pestCount: 12,
    growthStage: 'V4',
    hasNaturalEnemies: true,
    naturalEnemiesDesc: 'Percevejos predadores',
    damagePercentage: 15.5,
    photoUrl: null,
    notes: 'Folhas com dano',
    createdAt: '2026-03-09T10:00:00.000Z',
    updatedAt: '2026-03-09T10:00:00.000Z',
  },
];

const mockUseMonitoringRecords = vi.fn();

vi.mock('@/hooks/useMonitoringRecords', () => ({
  useMonitoringRecords: (...args: unknown[]) => mockUseMonitoringRecords(...args),
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
    Link: ({
      children,
      to,
      ...props
    }: {
      children: React.ReactNode;
      to: string;
      className?: string;
    }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

vi.mock('@/components/auth/PermissionGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/monitoring-records/MonitoringRecordModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="record-modal">Modal</div> : null,
}));

describe('MonitoringRecordsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no records', async () => {
    mockUseMonitoringRecords.mockReturnValue({
      records: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const MonitoringRecordsPage = (await import('./MonitoringRecordsPage')).default;
    render(<MonitoringRecordsPage />);

    expect(screen.getByText('Nenhum registro de monitoramento')).toBeTruthy();
    expect(screen.getByText(/Registre observações de pragas/)).toBeTruthy();
  });

  it('renders records in table', async () => {
    mockUseMonitoringRecords.mockReturnValue({
      records: MOCK_RECORDS,
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const MonitoringRecordsPage = (await import('./MonitoringRecordsPage')).default;
    render(<MonitoringRecordsPage />);

    expect(screen.getAllByText('P01').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Lagarta-da-soja').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Moderado').length).toBeGreaterThan(0);
    expect(screen.getAllByText('V4').length).toBeGreaterThan(0);
    expect(screen.getAllByText('15.5%').length).toBeGreaterThan(0);
  });

  it('renders loading skeleton', async () => {
    mockUseMonitoringRecords.mockReturnValue({
      records: [],
      meta: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    const MonitoringRecordsPage = (await import('./MonitoringRecordsPage')).default;
    render(<MonitoringRecordsPage />);

    const skeletons = document.querySelectorAll('.mrp__skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders error state', async () => {
    mockUseMonitoringRecords.mockReturnValue({
      records: [],
      meta: null,
      isLoading: false,
      error: 'Erro de conexão',
      refetch: vi.fn(),
    });

    const MonitoringRecordsPage = (await import('./MonitoringRecordsPage')).default;
    render(<MonitoringRecordsPage />);

    expect(screen.getByText('Erro de conexão')).toBeTruthy();
  });

  it('opens modal on new record click', async () => {
    mockUseMonitoringRecords.mockReturnValue({
      records: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const MonitoringRecordsPage = (await import('./MonitoringRecordsPage')).default;
    render(<MonitoringRecordsPage />);

    const button = screen.getByText('Registrar primeira observação');
    await userEvent.click(button);

    expect(screen.getByTestId('record-modal')).toBeTruthy();
  });

  it('shows infestation level filter', async () => {
    mockUseMonitoringRecords.mockReturnValue({
      records: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const MonitoringRecordsPage = (await import('./MonitoringRecordsPage')).default;
    render(<MonitoringRecordsPage />);

    expect(screen.getByLabelText('Nível de infestação')).toBeTruthy();
  });

  it('renders breadcrumb back link', async () => {
    mockUseMonitoringRecords.mockReturnValue({
      records: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const MonitoringRecordsPage = (await import('./MonitoringRecordsPage')).default;
    render(<MonitoringRecordsPage />);

    const backLink = screen.getByText('Voltar aos pontos');
    expect(backLink).toBeTruthy();
    expect(backLink.closest('a')?.getAttribute('href')).toBe(
      '/farms/farm-1/plots/plot-1/monitoring-points',
    );
  });

  it('shows natural enemies indicator for records with natural enemies', async () => {
    mockUseMonitoringRecords.mockReturnValue({
      records: MOCK_RECORDS,
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const MonitoringRecordsPage = (await import('./MonitoringRecordsPage')).default;
    render(<MonitoringRecordsPage />);

    expect(screen.getByLabelText('Inimigos naturais presentes')).toBeTruthy();
  });
});
