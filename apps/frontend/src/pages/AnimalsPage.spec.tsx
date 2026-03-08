import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { AnimalListItem } from '@/types/animal';

const MOCK_ANIMALS: AnimalListItem[] = [
  {
    id: 'a1',
    farmId: 'farm-1',
    earTag: 'BR-001',
    rfidTag: null,
    name: 'Mimosa',
    sex: 'FEMALE',
    birthDate: '2022-03-15',
    birthDateEstimated: false,
    category: 'VACA_LACTACAO',
    categorySuggested: 'VACA_LACTACAO',
    origin: 'BORN',
    entryWeightKg: 450,
    bodyConditionScore: 3,
    isCompositionEstimated: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    compositions: [
      {
        id: 'c1',
        breedId: 'b1',
        percentage: 50,
        fraction: '1/2',
        breed: { id: 'b1', name: 'Holandesa', code: 'HOL' },
      },
      {
        id: 'c2',
        breedId: 'b2',
        percentage: 50,
        fraction: '1/2',
        breed: { id: 'b2', name: 'Gir Leiteiro', code: 'GIR' },
      },
    ],
    breedSummary: 'Holandesa 50% + Gir Leiteiro 50%',
    sire: null,
    dam: null,
    lotId: null,
    lotName: null,
  },
  {
    id: 'a2',
    farmId: 'farm-1',
    earTag: 'BR-002',
    rfidTag: 'RFID-002',
    name: null,
    sex: 'MALE',
    birthDate: '2025-06-01',
    birthDateEstimated: true,
    category: 'BEZERRO',
    categorySuggested: 'BEZERRO',
    origin: 'PURCHASED',
    entryWeightKg: 120,
    bodyConditionScore: null,
    isCompositionEstimated: true,
    createdAt: '2026-02-01T00:00:00.000Z',
    compositions: [],
    breedSummary: null,
    sire: null,
    dam: null,
    lotId: null,
    lotName: null,
  },
];

const mockUseAnimals = vi.fn();
const mockUseBreeds = vi.fn();
const mockUseLots = vi.fn();
const mockUseFarmLocations = vi.fn();
const mockGetBlob = vi.fn();

vi.mock('@/hooks/useAnimals', () => ({
  useAnimals: (...args: unknown[]) => mockUseAnimals(...args),
}));

vi.mock('@/hooks/useBreeds', () => ({
  useBreeds: () => mockUseBreeds(),
}));

vi.mock('@/hooks/useLots', () => ({
  useLots: (...args: unknown[]) => mockUseLots(...args),
}));

vi.mock('@/hooks/useFarmLocations', () => ({
  useFarmLocations: (...args: unknown[]) => mockUseFarmLocations(...args),
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

vi.mock('@/services/api', () => ({
  api: {
    getBlob: (...args: unknown[]) => mockGetBlob(...args),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('@/components/auth/PermissionGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/animals/CreateAnimalModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="create-animal-modal">Modal</div> : null,
}));

vi.mock('@/components/animal-bulk-import/AnimalBulkImportModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="bulk-import-modal">Modal</div> : null,
}));

function defaultReturn() {
  return {
    animals: MOCK_ANIMALS,
    meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    groupStats: { totalCount: 2, averageWeightKg: 375 },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };
}

function defaultBreedsReturn() {
  return {
    breeds: [
      {
        id: 'b1',
        name: 'Holandesa',
        code: 'HOL',
        species: 'BOVINO',
        category: 'LEITEIRA',
        isDefault: true,
        organizationId: null,
      },
      {
        id: 'b2',
        name: 'Gir Leiteiro',
        code: 'GIR',
        species: 'BOVINO',
        category: 'LEITEIRA',
        isDefault: true,
        organizationId: null,
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };
}

function defaultLotsReturn() {
  return {
    lots: [
      { id: 'lot-1', name: 'Lote Maternidade', farmId: 'farm-1' },
      { id: 'lot-2', name: 'Lote Engorda', farmId: 'farm-1' },
    ],
    meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };
}

function defaultLocationsReturn() {
  return {
    locations: [
      {
        id: 'loc-1',
        name: 'Pasto Norte',
        type: 'PASTURE' as const,
        boundaryGeoJSON: null,
        boundaryAreaHa: 10,
        capacityUA: 20,
        capacityAnimals: 30,
        forageType: null,
        pastureStatus: 'EM_USO' as const,
        facilityType: null,
        facilityStatus: null,
        description: null,
        occupancy: {
          totalAnimals: 5,
          capacityUA: 20,
          capacityAnimals: 30,
          occupancyPercent: 16,
          level: 'green' as const,
        },
      },
      {
        id: 'loc-2',
        name: 'Curral Principal',
        type: 'FACILITY' as const,
        boundaryGeoJSON: null,
        boundaryAreaHa: null,
        capacityUA: null,
        capacityAnimals: 50,
        forageType: null,
        pastureStatus: null,
        facilityType: 'CURRAL' as const,
        facilityStatus: 'ATIVO' as const,
        description: null,
        occupancy: {
          totalAnimals: 10,
          capacityUA: null,
          capacityAnimals: 50,
          occupancyPercent: 20,
          level: 'green' as const,
        },
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };
}

async function renderPage() {
  const { default: AnimalsPage } = await import('./AnimalsPage');
  return render(<AnimalsPage />);
}

describe('AnimalsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBreeds.mockReturnValue(defaultBreedsReturn());
    mockUseLots.mockReturnValue(defaultLotsReturn());
    mockUseFarmLocations.mockReturnValue(defaultLocationsReturn());
  });

  it('should render skeleton while loading', async () => {
    mockUseAnimals.mockReturnValue({
      ...defaultReturn(),
      animals: [],
      isLoading: true,
    });

    await renderPage();
    expect(document.querySelector('.animals__skeleton')).toBeTruthy();
  });

  it('should render the page title and subtitle', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    expect(screen.getByText('Animais')).toBeTruthy();
    expect(screen.getByText(/Rebanho de Fazenda Santa Helena/)).toBeTruthy();
  });

  it('should render animal table with data', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    expect(screen.getAllByText('BR-001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mimosa').length).toBeGreaterThan(0);
    expect(screen.getAllByText('BR-002').length).toBeGreaterThan(0);
  });

  it('should show breed summary in table', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    expect(screen.getAllByText('Holandesa 50% + Gir Leiteiro 50%').length).toBeGreaterThan(0);
  });

  it('should show sex badges', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    const femaleLabels = screen.getAllByText('Fêmea');
    const maleLabels = screen.getAllByText('Macho');
    expect(femaleLabels.length).toBeGreaterThan(0);
    expect(maleLabels.length).toBeGreaterThan(0);
  });

  it('should show empty state when no animals', async () => {
    mockUseAnimals.mockReturnValue({
      ...defaultReturn(),
      animals: [],
    });
    await renderPage();

    expect(screen.getByText('Nenhum animal encontrado')).toBeTruthy();
    expect(screen.getByText(/Cadastre o primeiro animal/)).toBeTruthy();
  });

  it('should show empty state with filter message when filters active', async () => {
    mockUseAnimals.mockReturnValue({
      ...defaultReturn(),
      animals: [],
    });
    await renderPage();

    const sexSelect = screen.getByLabelText('Filtrar por sexo');
    await userEvent.selectOptions(sexSelect, 'FEMALE');

    expect(screen.getByText(/Tente ajustar os filtros/)).toBeTruthy();
  });

  it('should show error message', async () => {
    mockUseAnimals.mockReturnValue({
      ...defaultReturn(),
      animals: [],
      error: 'Erro de rede',
    });
    await renderPage();

    expect(screen.getByText('Erro de rede')).toBeTruthy();
  });

  it('should render "Novo animal" button', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    expect(screen.getByText('Novo animal')).toBeTruthy();
  });

  it('should open create modal when clicking "Novo animal"', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    const btn = screen.getByText('Novo animal');
    await userEvent.click(btn);

    expect(screen.getByTestId('create-animal-modal')).toBeTruthy();
  });

  it('should render filter selects', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    expect(screen.getByLabelText('Filtrar por sexo')).toBeTruthy();
    expect(screen.getByLabelText('Filtrar por categoria')).toBeTruthy();
    expect(screen.getByLabelText('Filtrar por raça')).toBeTruthy();
  });

  it('should have search input', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    const searchInput = screen.getByPlaceholderText(/Buscar por brinco/);
    expect(searchInput).toBeTruthy();
  });

  it('should render category labels correctly', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    const vacaLabels = screen.getAllByText('Vaca em Lactação');
    expect(vacaLabels.length).toBeGreaterThan(0);
  });

  // ─── Advanced Filters Tests ─────────────────────────────────────

  it('should show "Mais filtros" button', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    expect(screen.getByText('Mais filtros')).toBeTruthy();
  });

  it('should toggle advanced filters panel on click', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    // Panel should be hidden initially
    expect(screen.queryByLabelText('Origem')).toBeNull();

    // Click to expand
    await userEvent.click(screen.getByText('Mais filtros'));

    // Panel should be visible
    expect(screen.getByLabelText('Origem')).toBeTruthy();
    expect(screen.getByLabelText('Lote')).toBeTruthy();
    expect(screen.getByLabelText('Peso mínimo (kg)')).toBeTruthy();
    expect(screen.getByLabelText('Peso máximo (kg)')).toBeTruthy();
    expect(screen.getByLabelText('Idade mínima (dias)')).toBeTruthy();
    expect(screen.getByLabelText('Idade máxima (dias)')).toBeTruthy();
    expect(screen.getByLabelText('Ordenar por')).toBeTruthy();

    // Click to collapse
    await userEvent.click(screen.getByText('Mais filtros'));
    expect(screen.queryByLabelText('Origem')).toBeNull();
  });

  it('should pass lotId to useAnimals when lot filter is selected', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    await userEvent.click(screen.getByText('Mais filtros'));

    const lotSelect = screen.getByLabelText('Lote');
    await userEvent.selectOptions(lotSelect, 'lot-1');

    // useAnimals should have been called with lotId
    const lastCall = mockUseAnimals.mock.calls[mockUseAnimals.mock.calls.length - 1][0];
    expect(lastCall.lotId).toBe('lot-1');
  });

  it('should pass locationId to useAnimals when location filter is selected', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    await userEvent.click(screen.getByText('Mais filtros'));

    const locationSelect = screen.getByLabelText('Local');
    await userEvent.selectOptions(locationSelect, 'loc-1');

    const lastCall = mockUseAnimals.mock.calls[mockUseAnimals.mock.calls.length - 1][0];
    expect(lastCall.locationId).toBe('loc-1');
  });

  it('should render location options with type label', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    await userEvent.click(screen.getByText('Mais filtros'));

    expect(screen.getByText('Pasto Norte (Pasto)')).toBeTruthy();
    expect(screen.getByText('Curral Principal (Instalação)')).toBeTruthy();
  });

  it('should pass specialFilter to useAnimals when special filter is selected', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    await userEvent.click(screen.getByText('Mais filtros'));

    const specialSelect = screen.getByLabelText('Filtro especial');
    await userEvent.selectOptions(specialSelect, 'PREGNANT');

    const lastCall = mockUseAnimals.mock.calls[mockUseAnimals.mock.calls.length - 1][0];
    expect(lastCall.specialFilter).toBe('PREGNANT');
  });

  it('should pass origin to useAnimals when origin filter is selected', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    await userEvent.click(screen.getByText('Mais filtros'));

    const originSelect = screen.getByLabelText('Origem');
    await userEvent.selectOptions(originSelect, 'BORN');

    const lastCall = mockUseAnimals.mock.calls[mockUseAnimals.mock.calls.length - 1][0];
    expect(lastCall.origin).toBe('BORN');
  });

  it('should render weight filter inputs in advanced panel', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    await userEvent.click(screen.getByText('Mais filtros'));

    const minWeight = screen.getByLabelText('Peso mínimo (kg)');
    const maxWeight = screen.getByLabelText('Peso máximo (kg)');
    expect(minWeight).toBeTruthy();
    expect(maxWeight).toBeTruthy();
    expect(minWeight.getAttribute('type')).toBe('number');
    expect(maxWeight.getAttribute('type')).toBe('number');
  });

  it('should show filter count badge when advanced filters are active', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    await userEvent.click(screen.getByText('Mais filtros'));

    const originSelect = screen.getByLabelText('Origem');
    await userEvent.selectOptions(originSelect, 'PURCHASED');

    // Badge should appear on "Mais filtros" button area
    const badge = document.querySelector('.animals__filter-badge');
    expect(badge).toBeTruthy();
  });

  it('should show "Limpar filtros" when filters are active and clear them', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    // Apply a basic filter
    const sexSelect = screen.getByLabelText('Filtrar por sexo');
    await userEvent.selectOptions(sexSelect, 'FEMALE');

    // "Limpar filtros" should appear
    const clearBtn = screen.getByText('Limpar filtros');
    expect(clearBtn).toBeTruthy();

    // Click to clear
    await userEvent.click(clearBtn);

    // Filter should be reset
    expect((sexSelect as HTMLSelectElement).value).toBe('');
  });

  it('should show group stats with total count and average weight', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    // Group stats bar is always visible
    expect(screen.getByText(/animal\(is\)/)).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('375 kg')).toBeTruthy();
  });

  it('should hide average weight when null', async () => {
    mockUseAnimals.mockReturnValue({
      ...defaultReturn(),
      groupStats: { totalCount: 2, averageWeightKg: null },
    });
    await renderPage();

    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.queryByText(/Peso médio/)).toBeNull();
  });

  // ─── CSV Export Tests ───────────────────────────────────────────

  it('should render CSV and Excel export buttons', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    expect(screen.getByLabelText('Exportar animais em CSV')).toBeTruthy();
  });

  it('should call api.getBlob when export button is clicked', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    mockGetBlob.mockResolvedValue(new Blob(['test'], { type: 'text/csv' }));
    await renderPage();

    const exportBtn = screen.getByLabelText('Exportar animais em CSV');
    await userEvent.click(exportBtn);

    expect(mockGetBlob).toHaveBeenCalledWith('/org/farms/farm-1/animals/export');
  });

  it('should pass active filters to export URL', async () => {
    // Pre-set the filter by making useAnimals return with a sex filter already active
    let capturedParams: Record<string, unknown> = {};
    mockUseAnimals.mockImplementation((params: Record<string, unknown>) => {
      capturedParams = params;
      return defaultReturn();
    });
    mockGetBlob.mockResolvedValue(new Blob(['test'], { type: 'text/csv' }));
    await renderPage();

    // Set a filter first
    const sexSelect = screen.getByLabelText('Filtrar por sexo');
    await userEvent.selectOptions(sexSelect, 'FEMALE');

    expect(capturedParams.sex).toBe('FEMALE');

    const exportBtn = screen.getByLabelText('Exportar animais em CSV');
    await userEvent.click(exportBtn);

    expect(mockGetBlob).toHaveBeenCalledWith('/org/farms/farm-1/animals/export?sex=FEMALE');
  });

  it('should have aria-expanded on "Mais filtros" button', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    const toggleBtn = screen.getByText('Mais filtros').closest('button')!;
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(toggleBtn);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
  });

  it('should render lot options from useLots', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    await userEvent.click(screen.getByText('Mais filtros'));

    expect(screen.getByText('Lote Maternidade')).toBeTruthy();
    expect(screen.getByText('Lote Engorda')).toBeTruthy();
  });

  it('should render sort options', async () => {
    mockUseAnimals.mockReturnValue(defaultReturn());
    await renderPage();

    await userEvent.click(screen.getByText('Mais filtros'));

    const sortSelect = screen.getByLabelText('Ordenar por');
    expect(sortSelect).toBeTruthy();

    // Check sort options exist
    const options = sortSelect.querySelectorAll('option');
    const optionTexts = Array.from(options).map((o) => o.textContent);
    expect(optionTexts).toContain('Brinco');
    expect(optionTexts).toContain('Nome');
    expect(optionTexts).toContain('Nascimento');
    expect(optionTexts).toContain('Peso');
    expect(optionTexts).toContain('Cadastro');
  });
});
