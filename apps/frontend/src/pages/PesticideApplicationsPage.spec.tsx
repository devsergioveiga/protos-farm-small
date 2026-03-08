import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { PesticideApplicationItem } from '@/types/pesticide-application';

const MOCK_APPLICATIONS: PesticideApplicationItem[] = [
  {
    id: 'pa-1',
    farmId: 'farm-1',
    fieldPlotId: 'plot-1',
    fieldPlotName: 'Talhão Norte',
    appliedAt: '2026-03-08T10:00:00.000Z',
    productName: 'Roundup Ready',
    activeIngredient: 'Glifosato',
    dose: 2.5,
    doseUnit: 'L_HA',
    sprayVolume: 150,
    target: 'PLANTA_DANINHA',
    targetDescription: 'Buva',
    artNumber: 'ART-2026-001234',
    agronomistCrea: 'CREA-SP 5012345678',
    technicalJustification: 'Alta infestação de buva resistente',
    temperature: 28.5,
    relativeHumidity: 62.0,
    windSpeed: 8.0,
    sprayerType: 'BARRA_TRATORIZADO',
    nozzleType: 'LEQUE',
    workingPressure: 3.5,
    applicationSpeed: 6.0,
    adjuvant: 'Nimbus',
    adjuvantDose: 500,
    tankMixOrder: 'Água → Adjuvante → Herbicida',
    tankMixPh: 6.5,
    notes: null,
    recordedBy: 'admin-1',
    recorderName: 'Admin',
    createdAt: '2026-03-08T10:00:00.000Z',
    updatedAt: '2026-03-08T10:00:00.000Z',
  },
  {
    id: 'pa-2',
    farmId: 'farm-1',
    fieldPlotId: 'plot-2',
    fieldPlotName: 'Talhão Sul',
    appliedAt: '2026-03-07T08:00:00.000Z',
    productName: 'Engeo Pleno',
    activeIngredient: 'Tiametoxam + Lambda-cialotrina',
    dose: 0.25,
    doseUnit: 'L_HA',
    sprayVolume: 200,
    target: 'PRAGA',
    targetDescription: 'Lagarta-da-soja',
    artNumber: null,
    agronomistCrea: null,
    technicalJustification: null,
    temperature: null,
    relativeHumidity: null,
    windSpeed: null,
    sprayerType: null,
    nozzleType: null,
    workingPressure: null,
    applicationSpeed: null,
    adjuvant: null,
    adjuvantDose: null,
    tankMixOrder: null,
    tankMixPh: null,
    notes: 'Alta infestação',
    recordedBy: 'admin-1',
    recorderName: 'Admin',
    createdAt: '2026-03-07T08:00:00.000Z',
    updatedAt: '2026-03-07T08:00:00.000Z',
  },
];

const mockUsePesticideApplications = vi.fn();

vi.mock('@/hooks/usePesticideApplications', () => ({
  usePesticideApplications: (...args: unknown[]) => mockUsePesticideApplications(...args),
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

vi.mock('@/components/pesticide-applications/PesticideApplicationModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="pesticide-modal">Modal</div> : null,
}));

import PesticideApplicationsPage from './PesticideApplicationsPage';

describe('PesticideApplicationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render title and subtitle', () => {
    mockUsePesticideApplications.mockReturnValue({
      applications: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PesticideApplicationsPage />);
    expect(screen.getByText('Aplicações de defensivos')).toBeTruthy();
    expect(screen.getByText(/Registro de aplicações em Fazenda Santa Helena/)).toBeTruthy();
  });

  it('should show empty state when no applications', () => {
    mockUsePesticideApplications.mockReturnValue({
      applications: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PesticideApplicationsPage />);
    expect(screen.getByText('Nenhuma aplicação registrada')).toBeTruthy();
  });

  it('should show skeleton while loading', () => {
    mockUsePesticideApplications.mockReturnValue({
      applications: [],
      meta: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    const { container } = render(<PesticideApplicationsPage />);
    const skeletons = container.querySelectorAll('.pesticides__skeleton--card');
    expect(skeletons.length).toBe(6);
  });

  it('should show error message', () => {
    mockUsePesticideApplications.mockReturnValue({
      applications: [],
      meta: null,
      isLoading: false,
      error: 'Erro ao carregar aplicações',
      refetch: vi.fn(),
    });

    render(<PesticideApplicationsPage />);
    expect(screen.getByText('Erro ao carregar aplicações')).toBeTruthy();
  });

  it('should render application cards', () => {
    mockUsePesticideApplications.mockReturnValue({
      applications: MOCK_APPLICATIONS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PesticideApplicationsPage />);
    expect(screen.getByText('Roundup Ready')).toBeTruthy();
    expect(screen.getByText('Engeo Pleno')).toBeTruthy();
    expect(screen.getByText('Glifosato')).toBeTruthy();
    expect(screen.getByText('Talhão Norte')).toBeTruthy();
    expect(screen.getAllByText('Planta daninha').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Praga').length).toBeGreaterThan(0);
  });

  it('should open modal when clicking "Nova aplicação"', async () => {
    const user = userEvent.setup();
    mockUsePesticideApplications.mockReturnValue({
      applications: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PesticideApplicationsPage />);
    await user.click(screen.getByText('Nova aplicação'));
    expect(screen.getByTestId('pesticide-modal')).toBeTruthy();
  });

  it('should open modal when clicking a card', async () => {
    const user = userEvent.setup();
    mockUsePesticideApplications.mockReturnValue({
      applications: MOCK_APPLICATIONS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PesticideApplicationsPage />);
    await user.click(screen.getByText('Roundup Ready'));
    expect(screen.getByTestId('pesticide-modal')).toBeTruthy();
  });

  it('should have search and filter controls', () => {
    mockUsePesticideApplications.mockReturnValue({
      applications: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PesticideApplicationsPage />);
    expect(screen.getByLabelText('Buscar aplicações')).toBeTruthy();
    expect(screen.getByLabelText('Filtrar por tipo de alvo')).toBeTruthy();
  });

  it('should display environmental conditions on cards', () => {
    mockUsePesticideApplications.mockReturnValue({
      applications: MOCK_APPLICATIONS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PesticideApplicationsPage />);
    expect(screen.getByText('28.5°C')).toBeTruthy();
    expect(screen.getByText('62% UR')).toBeTruthy();
    expect(screen.getByText('8 km/h')).toBeTruthy();
  });

  it('should show warning icon for inadequate conditions', () => {
    const appWithBadConditions: PesticideApplicationItem[] = [
      {
        ...MOCK_APPLICATIONS[0],
        temperature: 35,
        relativeHumidity: 40,
        windSpeed: 15,
      },
    ];

    mockUsePesticideApplications.mockReturnValue({
      applications: appWithBadConditions,
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PesticideApplicationsPage />);
    expect(screen.getByTitle('Condições inadequadas')).toBeTruthy();
  });

  it('should display equipment info on cards', () => {
    mockUsePesticideApplications.mockReturnValue({
      applications: MOCK_APPLICATIONS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PesticideApplicationsPage />);
    expect(screen.getByText('Barra tratorizado')).toBeTruthy();
    expect(screen.getByText('Leque (plano)')).toBeTruthy();
  });

  it('should display tank mix info on cards', () => {
    mockUsePesticideApplications.mockReturnValue({
      applications: MOCK_APPLICATIONS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PesticideApplicationsPage />);
    expect(screen.getByText('Nimbus')).toBeTruthy();
    expect(screen.getByText('pH 6.5')).toBeTruthy();
  });

  it('should show pagination when multiple pages', () => {
    mockUsePesticideApplications.mockReturnValue({
      applications: MOCK_APPLICATIONS,
      meta: { page: 1, limit: 20, total: 40, totalPages: 2 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PesticideApplicationsPage />);
    expect(screen.getByText('Página 1 de 2')).toBeTruthy();
  });
});
