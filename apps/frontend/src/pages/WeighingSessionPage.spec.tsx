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
    compositions: [],
    breedSummary: null,
    sire: null,
    dam: null,
    lotId: 'lot-1',
    lotName: 'Lote Maternidade',
  },
  {
    id: 'a2',
    farmId: 'farm-1',
    earTag: 'BR-002',
    rfidTag: null,
    name: 'Estrela',
    sex: 'FEMALE',
    birthDate: '2023-01-10',
    birthDateEstimated: false,
    category: 'NOVILHA',
    categorySuggested: 'NOVILHA',
    origin: 'PURCHASED',
    entryWeightKg: 320,
    bodyConditionScore: null,
    isCompositionEstimated: false,
    createdAt: '2026-02-01T00:00:00.000Z',
    compositions: [],
    breedSummary: null,
    sire: null,
    dam: null,
    lotId: null,
    lotName: null,
  },
  {
    id: 'a3',
    farmId: 'farm-1',
    earTag: 'BR-003',
    rfidTag: null,
    name: null,
    sex: 'MALE',
    birthDate: '2025-06-01',
    birthDateEstimated: true,
    category: 'BEZERRO',
    categorySuggested: 'BEZERRO',
    origin: 'BORN',
    entryWeightKg: 120,
    bodyConditionScore: null,
    isCompositionEstimated: false,
    createdAt: '2026-03-01T00:00:00.000Z',
    compositions: [],
    breedSummary: null,
    sire: null,
    dam: null,
    lotId: null,
    lotName: null,
  },
];

const mockUseAnimals = vi.fn();
const mockUseLots = vi.fn();
const mockApiPost = vi.fn();
let mockSelectedFarm: { id: string; name: string } | null = {
  id: 'farm-1',
  name: 'Fazenda Santa Helena',
};

vi.mock('@/hooks/useAnimals', () => ({
  useAnimals: (...args: unknown[]) => mockUseAnimals(...args),
}));

vi.mock('@/hooks/useLots', () => ({
  useLots: (...args: unknown[]) => mockUseLots(...args),
}));

vi.mock('@/stores/FarmContext', () => ({
  useFarmContext: () => ({
    selectedFarm: mockSelectedFarm,
    farms: [],
    isLoadingFarms: false,
    selectedFarmId: mockSelectedFarm?.id ?? null,
    selectFarm: vi.fn(),
    refreshFarms: vi.fn(),
  }),
}));

vi.mock('@/services/api', () => ({
  api: {
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

function defaultAnimalsReturn() {
  return {
    animals: MOCK_ANIMALS,
    meta: { page: 1, limit: 200, total: 3, totalPages: 1 },
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

async function renderPage() {
  const { default: WeighingSessionPage } = await import('./WeighingSessionPage');
  return render(<WeighingSessionPage />);
}

describe('WeighingSessionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedFarm = { id: 'farm-1', name: 'Fazenda Santa Helena' };
    mockUseAnimals.mockReturnValue(defaultAnimalsReturn());
    mockUseLots.mockReturnValue(defaultLotsReturn());
    mockApiPost.mockResolvedValue({ id: 'w1' });
  });

  it('renders empty state when no farm is selected', async () => {
    mockSelectedFarm = null;
    await renderPage();
    expect(screen.getByText('Selecione uma fazenda')).toBeTruthy();
  });

  it('renders animal list with correct columns', async () => {
    await renderPage();
    expect(screen.getAllByText('BR-001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mimosa').length).toBeGreaterThan(0);
    expect(screen.getAllByText('BR-002').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Estrela').length).toBeGreaterThan(0);
    expect(screen.getAllByText('450 kg').length).toBeGreaterThan(0);
  });

  it('renders empty state when no animals found', async () => {
    mockUseAnimals.mockReturnValue({
      ...defaultAnimalsReturn(),
      animals: [],
      meta: { page: 1, limit: 200, total: 0, totalPages: 0 },
    });
    await renderPage();
    expect(screen.getByText('Nenhum animal encontrado')).toBeTruthy();
  });

  it('passes lotId filter to useAnimals', async () => {
    const user = userEvent.setup();
    await renderPage();

    const lotSelect = screen.getByLabelText('Filtrar por lote');
    await user.selectOptions(lotSelect, 'lot-1');

    expect(mockUseAnimals).toHaveBeenCalledWith(expect.objectContaining({ lotId: 'lot-1' }));
  });

  it('starts weighing session showing inline form with first animal', async () => {
    const user = userEvent.setup();
    await renderPage();

    const startBtn = screen.getByRole('button', { name: /Iniciar sessão/i });
    await user.click(startBtn);

    expect(screen.getByText('Sessão de pesagem')).toBeTruthy();
    expect(screen.getByLabelText('Peso (kg) *')).toBeTruthy();
    // First animal visible in animal card
    expect(screen.getAllByText('BR-001').length).toBeGreaterThan(0);
    // Progress bar
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('saves weighing and advances to next animal', async () => {
    const user = userEvent.setup();
    await renderPage();

    // Start session
    await user.click(screen.getByRole('button', { name: /Iniciar sessão/i }));

    // Fill weight
    const weightInput = screen.getByLabelText('Peso (kg) *');
    await user.clear(weightInput);
    await user.type(weightInput, '455');

    // Save
    await user.click(screen.getByRole('button', { name: /Salvar e próximo/i }));

    expect(mockApiPost).toHaveBeenCalledWith(
      '/org/farms/farm-1/animals/a1/weighings',
      expect.objectContaining({ weightKg: 455 }),
    );

    // Should advance — animal card now shows BR-002
    const animalCard = document.querySelector('.weighing__animal-tag');
    expect(animalCard?.textContent).toBe('BR-002');
  });

  it('skips animal without calling API', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: /Iniciar sessão/i }));
    await user.click(screen.getByRole('button', { name: /Pular/i }));

    expect(mockApiPost).not.toHaveBeenCalled();
    // Advances: animal card now shows BR-002
    const animalCard = document.querySelector('.weighing__animal-tag');
    expect(animalCard?.textContent).toBe('BR-002');
  });

  it('updates progress bar correctly', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: /Iniciar sessão/i }));

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar.getAttribute('aria-valuenow')).toBe('0');
    expect(progressbar.getAttribute('aria-valuemax')).toBe('3');

    // Skip first
    await user.click(screen.getByRole('button', { name: /Pular/i }));

    expect(progressbar.getAttribute('aria-valuenow')).toBe('1');
  });

  it('shows summary after last animal', async () => {
    // Only 1 animal for simplicity
    mockUseAnimals.mockReturnValue({
      ...defaultAnimalsReturn(),
      animals: [MOCK_ANIMALS[0]],
      meta: { page: 1, limit: 200, total: 1, totalPages: 1 },
    });

    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: /Iniciar sessão/i }));

    const weightInput = screen.getByLabelText('Peso (kg) *');
    await user.clear(weightInput);
    await user.type(weightInput, '460');
    await user.click(screen.getByRole('button', { name: /Salvar e próximo/i }));

    expect(screen.getByText('Resumo da sessão')).toBeTruthy();
    expect(screen.getByText('460.0 kg')).toBeTruthy();
  });

  it('ends session early showing summary', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: /Iniciar sessão/i }));
    await user.click(screen.getByRole('button', { name: /Encerrar sessão/i }));

    expect(screen.getByText('Resumo da sessão')).toBeTruthy();
  });

  it('resets to selection phase when farm changes', async () => {
    const { unmount } = await renderPage();
    unmount();

    // Simulate farm change by re-rendering with different farm
    mockSelectedFarm = { id: 'farm-2', name: 'Outra Fazenda' };
    await renderPage();

    // Should be in selection phase
    expect(screen.getByText(/Selecione os animais/i)).toBeTruthy();
  });
});
