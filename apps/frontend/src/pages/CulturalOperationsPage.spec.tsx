import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { CulturalOperationItem } from '@/types/cultural-operation';

const MOCK_OPERATIONS: CulturalOperationItem[] = [
  {
    id: 'co-1',
    farmId: 'farm-1',
    fieldPlotId: 'plot-1',
    fieldPlotName: 'Talhão Norte',
    performedAt: '2026-03-08T10:00:00.000Z',
    operationType: 'CAPINA_MANUAL',
    operationTypeLabel: 'Capina manual',
    durationHours: 4,
    machineName: null,
    laborCount: 3,
    laborHours: 12,
    irrigationDepthMm: null,
    irrigationTimeMin: null,
    irrigationSystem: null,
    pruningType: null,
    pruningTypeLabel: null,
    pruningPercentage: null,
    machineHourCost: null,
    laborHourCost: 150,
    supplyCost: null,
    totalCost: 150,
    notes: 'Capina na área norte',
    photoUrl: null,
    latitude: null,
    longitude: null,
    recordedBy: 'admin-1',
    recorderName: 'Admin',
    createdAt: '2026-03-08T10:00:00.000Z',
    updatedAt: '2026-03-08T10:00:00.000Z',
  },
  {
    id: 'co-2',
    farmId: 'farm-1',
    fieldPlotId: 'plot-2',
    fieldPlotName: 'Talhão Sul',
    performedAt: '2026-03-07T08:00:00.000Z',
    operationType: 'ROCAGEM_MECANICA',
    operationTypeLabel: 'Roçagem mecânica',
    durationHours: 6,
    machineName: 'Roçadeira lateral',
    laborCount: 1,
    laborHours: 6,
    irrigationDepthMm: null,
    irrigationTimeMin: null,
    irrigationSystem: null,
    pruningType: null,
    pruningTypeLabel: null,
    pruningPercentage: null,
    machineHourCost: 200,
    laborHourCost: 80,
    supplyCost: null,
    totalCost: 280,
    notes: null,
    photoUrl: null,
    latitude: null,
    longitude: null,
    recordedBy: 'admin-1',
    recorderName: 'Admin',
    createdAt: '2026-03-07T08:00:00.000Z',
    updatedAt: '2026-03-07T08:00:00.000Z',
  },
];

const mockUseCulturalOperations = vi.fn();

vi.mock('@/hooks/useCulturalOperations', () => ({
  useCulturalOperations: (...args: unknown[]) => mockUseCulturalOperations(...args),
}));

vi.mock('@/stores/FarmContext', () => ({
  useFarmContext: () => ({
    selectedFarm: { id: 'farm-1', name: 'Fazenda Santa Helena' },
    farms: [],
    isLoadingFarms: false,
    selectedFarmId: 'farm-1',
    selectFarm: vi.fn(),
    refreshFarms: vi.fn(),
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('@/components/auth/PermissionGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/cultural-operations/CulturalOperationModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="cultural-modal">Modal</div> : null,
}));

import CulturalOperationsPage from './CulturalOperationsPage';

describe('CulturalOperationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render title and subtitle', () => {
    mockUseCulturalOperations.mockReturnValue({
      operations: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CulturalOperationsPage />);
    expect(screen.getByText('Tratos culturais')).toBeTruthy();
    expect(screen.getByText(/Operações de trato cultural.*Fazenda Santa Helena/)).toBeTruthy();
  });

  it('should show empty state when no operations', () => {
    mockUseCulturalOperations.mockReturnValue({
      operations: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CulturalOperationsPage />);
    expect(screen.getByText('Nenhuma operação registrada')).toBeTruthy();
  });

  it('should show skeleton while loading', () => {
    mockUseCulturalOperations.mockReturnValue({
      operations: [],
      meta: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    const { container } = render(<CulturalOperationsPage />);
    const skeletons = container.querySelectorAll('.cultural-ops__skeleton--card');
    expect(skeletons.length).toBe(6);
  });

  it('should show error message', () => {
    mockUseCulturalOperations.mockReturnValue({
      operations: [],
      meta: null,
      isLoading: false,
      error: 'Erro ao carregar operações',
      refetch: vi.fn(),
    });

    render(<CulturalOperationsPage />);
    expect(screen.getByText('Erro ao carregar operações')).toBeTruthy();
  });

  it('should render operation cards with type labels', () => {
    mockUseCulturalOperations.mockReturnValue({
      operations: MOCK_OPERATIONS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CulturalOperationsPage />);
    expect(screen.getAllByText('Capina manual').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Roçagem mecânica').length).toBeGreaterThan(0);
    expect(screen.getByText('Talhão Norte')).toBeTruthy();
    expect(screen.getByText('Talhão Sul')).toBeTruthy();
  });

  it('should display duration on cards', () => {
    mockUseCulturalOperations.mockReturnValue({
      operations: MOCK_OPERATIONS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CulturalOperationsPage />);
    expect(screen.getByText('4h')).toBeTruthy();
    expect(screen.getByText('6h')).toBeTruthy();
  });

  it('should display labor info on cards', () => {
    mockUseCulturalOperations.mockReturnValue({
      operations: MOCK_OPERATIONS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CulturalOperationsPage />);
    expect(screen.getByText('3 trabalhadores')).toBeTruthy();
  });

  it('should display machine info on cards', () => {
    mockUseCulturalOperations.mockReturnValue({
      operations: MOCK_OPERATIONS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CulturalOperationsPage />);
    expect(screen.getByText('Roçadeira lateral')).toBeTruthy();
  });

  it('should open modal when clicking "Nova operação"', async () => {
    const user = userEvent.setup();
    mockUseCulturalOperations.mockReturnValue({
      operations: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CulturalOperationsPage />);
    await user.click(screen.getByText('Nova operação'));
    expect(screen.getByTestId('cultural-modal')).toBeTruthy();
  });

  it('should open modal when clicking a card', async () => {
    const user = userEvent.setup();
    mockUseCulturalOperations.mockReturnValue({
      operations: MOCK_OPERATIONS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CulturalOperationsPage />);
    const card = screen.getByLabelText(/Ver detalhes da operação Capina manual/);
    await user.click(card);
    expect(screen.getByTestId('cultural-modal')).toBeTruthy();
  });

  it('should have search and filter controls', () => {
    mockUseCulturalOperations.mockReturnValue({
      operations: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CulturalOperationsPage />);
    expect(screen.getByLabelText('Buscar operações')).toBeTruthy();
    expect(screen.getByLabelText('Filtrar por tipo de operação')).toBeTruthy();
  });

  it('should show all 7 operation types in filter', () => {
    mockUseCulturalOperations.mockReturnValue({
      operations: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CulturalOperationsPage />);
    const select = screen.getByLabelText('Filtrar por tipo de operação');
    const options = select.querySelectorAll('option');
    // "Todos os tipos" + 7 types = 8
    expect(options.length).toBe(8);
  });

  it('should show pagination when multiple pages', () => {
    mockUseCulturalOperations.mockReturnValue({
      operations: MOCK_OPERATIONS,
      meta: { page: 1, limit: 20, total: 40, totalPages: 2 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CulturalOperationsPage />);
    expect(screen.getByText('Página 1 de 2')).toBeTruthy();
  });

  it('should display cost badge on cards', () => {
    mockUseCulturalOperations.mockReturnValue({
      operations: MOCK_OPERATIONS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CulturalOperationsPage />);
    // R$ 150,00 and R$ 280,00
    expect(screen.getByText('R$ 150,00')).toBeTruthy();
    expect(screen.getByText('R$ 280,00')).toBeTruthy();
  });
});
