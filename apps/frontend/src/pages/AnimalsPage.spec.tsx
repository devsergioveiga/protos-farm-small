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

vi.mock('@/hooks/useAnimals', () => ({
  useAnimals: (...args: unknown[]) => mockUseAnimals(...args),
}));

vi.mock('@/hooks/useBreeds', () => ({
  useBreeds: () => mockUseBreeds(),
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

vi.mock('@/components/auth/PermissionGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/animals/CreateAnimalModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="create-animal-modal">Modal</div> : null,
}));

function defaultReturn() {
  return {
    animals: MOCK_ANIMALS,
    meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
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

async function renderPage() {
  const { default: AnimalsPage } = await import('./AnimalsPage');
  return render(<AnimalsPage />);
}

describe('AnimalsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBreeds.mockReturnValue(defaultBreedsReturn());
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

    // Multiple Fêmea/Macho badges (table + mobile cards)
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

    // Set a filter
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

    // Both table + cards render categories
    const vacaLabels = screen.getAllByText('Vaca em Lactação');
    expect(vacaLabels.length).toBeGreaterThan(0);
  });
});
