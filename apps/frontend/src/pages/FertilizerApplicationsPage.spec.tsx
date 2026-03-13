import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { FertilizerApplicationItem } from '@/types/fertilizer-application';

const MOCK_APPLICATIONS: FertilizerApplicationItem[] = [
  {
    id: 'fa-1',
    farmId: 'farm-1',
    fieldPlotId: 'plot-1',
    fieldPlotName: 'Talhão Norte',
    appliedAt: '2026-03-08T10:00:00.000Z',
    applicationType: 'COBERTURA_LANCO',
    productName: 'Ureia',
    formulation: '45-00-00',
    dose: 200,
    doseUnit: 'KG_HA',
    nutrientSource: 'Ureia',
    phenologicalStage: 'V4',
    nitrogenN: 90,
    phosphorusP: null,
    potassiumK: null,
    machineName: 'Distribuidor centrífugo',
    operatorName: 'João Silva',
    areaAppliedHa: 15.5,
    plantsPerHa: null,
    dosePerPlantG: null,
    notes: null,
    photoUrl: null,
    latitude: null,
    longitude: null,
    recordedBy: 'admin-1',
    recorderName: 'Admin',
    createdAt: '2026-03-08T10:00:00.000Z',
    updatedAt: '2026-03-08T10:00:00.000Z',
    productId: null,
    stockOutputId: null,
    totalQuantityUsed: null,
  },
  {
    id: 'fa-2',
    farmId: 'farm-1',
    fieldPlotId: 'plot-2',
    fieldPlotName: 'Talhão Sul',
    appliedAt: '2026-03-07T08:00:00.000Z',
    applicationType: 'FOLIAR',
    productName: 'Sulfato de Zinco',
    formulation: null,
    dose: 3,
    doseUnit: 'L_HA',
    nutrientSource: null,
    phenologicalStage: 'R1',
    nitrogenN: null,
    phosphorusP: null,
    potassiumK: null,
    machineName: null,
    operatorName: null,
    areaAppliedHa: null,
    plantsPerHa: 3333,
    dosePerPlantG: 50,
    notes: null,
    photoUrl: null,
    latitude: null,
    longitude: null,
    recordedBy: 'admin-1',
    recorderName: 'Admin',
    createdAt: '2026-03-07T08:00:00.000Z',
    updatedAt: '2026-03-07T08:00:00.000Z',
    productId: null,
    stockOutputId: null,
    totalQuantityUsed: null,
  },
];

const mockUseFertilizerApplications = vi.fn();
const mockUseFertilizerNutrientSummary = vi.fn();

vi.mock('@/hooks/useFertilizerApplications', () => ({
  useFertilizerApplications: (...args: unknown[]) => mockUseFertilizerApplications(...args),
}));

vi.mock('@/hooks/useFertilizerNutrientSummary', () => ({
  useFertilizerNutrientSummary: (...args: unknown[]) => mockUseFertilizerNutrientSummary(...args),
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

vi.mock('@/components/fertilizer-applications/FertilizerApplicationModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="fertilizer-modal">Modal</div> : null,
}));

import FertilizerApplicationsPage from './FertilizerApplicationsPage';

describe('FertilizerApplicationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFertilizerNutrientSummary.mockReturnValue({
      summary: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('should render title and subtitle', () => {
    mockUseFertilizerApplications.mockReturnValue({
      applications: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FertilizerApplicationsPage />);
    expect(screen.getByText('Adubação')).toBeTruthy();
    expect(screen.getByText(/Registro de adubação.*Fazenda Santa Helena/)).toBeTruthy();
  });

  it('should show empty state when no applications', () => {
    mockUseFertilizerApplications.mockReturnValue({
      applications: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FertilizerApplicationsPage />);
    expect(screen.getByText('Nenhuma adubação registrada')).toBeTruthy();
  });

  it('should show skeleton while loading', () => {
    mockUseFertilizerApplications.mockReturnValue({
      applications: [],
      meta: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    const { container } = render(<FertilizerApplicationsPage />);
    const skeletons = container.querySelectorAll('.fertilizers__skeleton--card');
    expect(skeletons.length).toBe(6);
  });

  it('should show error message', () => {
    mockUseFertilizerApplications.mockReturnValue({
      applications: [],
      meta: null,
      isLoading: false,
      error: 'Erro ao carregar aplicações',
      refetch: vi.fn(),
    });

    render(<FertilizerApplicationsPage />);
    expect(screen.getByText('Erro ao carregar aplicações')).toBeTruthy();
  });

  it('should render application cards', () => {
    mockUseFertilizerApplications.mockReturnValue({
      applications: MOCK_APPLICATIONS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FertilizerApplicationsPage />);
    expect(screen.getAllByText('Ureia').length).toBeGreaterThan(0);
    expect(screen.getByText('Sulfato de Zinco')).toBeTruthy();
    expect(screen.getByText('Talhão Norte')).toBeTruthy();
    expect(screen.getAllByText('Cobertura a lanço').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Foliar').length).toBeGreaterThan(0);
  });

  it('should display nutrient info on cards', () => {
    mockUseFertilizerApplications.mockReturnValue({
      applications: MOCK_APPLICATIONS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FertilizerApplicationsPage />);
    expect(screen.getByText('90')).toBeTruthy(); // nitrogenN value
  });

  it('should display equipment info on cards', () => {
    mockUseFertilizerApplications.mockReturnValue({
      applications: MOCK_APPLICATIONS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FertilizerApplicationsPage />);
    expect(screen.getByText('Distribuidor centrífugo')).toBeTruthy();
  });

  it('should open modal when clicking "Nova adubação"', async () => {
    const user = userEvent.setup();
    mockUseFertilizerApplications.mockReturnValue({
      applications: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FertilizerApplicationsPage />);
    await user.click(screen.getByText('Nova adubação'));
    expect(screen.getByTestId('fertilizer-modal')).toBeTruthy();
  });

  it('should open modal when clicking a card', async () => {
    const user = userEvent.setup();
    mockUseFertilizerApplications.mockReturnValue({
      applications: MOCK_APPLICATIONS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FertilizerApplicationsPage />);
    await user.click(screen.getAllByText('Ureia')[0]);
    expect(screen.getByTestId('fertilizer-modal')).toBeTruthy();
  });

  it('should have search and filter controls', () => {
    mockUseFertilizerApplications.mockReturnValue({
      applications: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FertilizerApplicationsPage />);
    expect(screen.getByLabelText('Buscar aplicações')).toBeTruthy();
    expect(screen.getByLabelText('Filtrar por tipo de aplicação')).toBeTruthy();
  });

  it('should have export CSV button', () => {
    mockUseFertilizerApplications.mockReturnValue({
      applications: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FertilizerApplicationsPage />);
    expect(screen.getByText('Exportar CSV')).toBeTruthy();
  });

  it('should show nutrient summary when available', () => {
    mockUseFertilizerApplications.mockReturnValue({
      applications: MOCK_APPLICATIONS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseFertilizerNutrientSummary.mockReturnValue({
      summary: [
        {
          fieldPlotId: 'plot-1',
          fieldPlotName: 'Talhão Norte',
          totalN: 180,
          totalP: 80,
          totalK: 120,
          applicationCount: 3,
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FertilizerApplicationsPage />);
    expect(screen.getByText('Acumulado de nutrientes por talhão')).toBeTruthy();
  });

  it('should show pagination when multiple pages', () => {
    mockUseFertilizerApplications.mockReturnValue({
      applications: MOCK_APPLICATIONS,
      meta: { page: 1, limit: 20, total: 40, totalPages: 2 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<FertilizerApplicationsPage />);
    expect(screen.getByText('Página 1 de 2')).toBeTruthy();
  });
});
