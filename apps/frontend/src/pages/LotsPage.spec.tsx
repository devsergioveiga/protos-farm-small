import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockUseLots = vi.fn();
vi.mock('@/hooks/useLots', () => ({
  useLots: (...args: unknown[]) => mockUseLots(...args),
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

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({
    hasPermission: () => true,
    isLoading: false,
    permissions: {},
  }),
}));

vi.mock('@/components/lots/CreateLotModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="create-lot-modal">CreateLotModal</div> : null,
}));

vi.mock('@/components/lots/LotDetailModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="lot-detail-modal">LotDetailModal</div> : null,
}));

const MOCK_LOTS = [
  {
    id: 'lot-1',
    farmId: 'farm-1',
    name: 'Lote Maternidade',
    predominantCategory: 'BEZERRA' as const,
    currentLocation: 'Pasto 3',
    locationType: 'PASTO' as const,
    maxCapacity: 30,
    description: null,
    notes: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    _count: { animals: 12 },
  },
  {
    id: 'lot-2',
    farmId: 'farm-1',
    name: 'Lote Recria',
    predominantCategory: 'NOVILHA' as const,
    currentLocation: 'Galpão Norte',
    locationType: 'GALPAO' as const,
    maxCapacity: null,
    description: null,
    notes: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    _count: { animals: 8 },
  },
];

function defaultReturn() {
  return {
    lots: MOCK_LOTS,
    meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };
}

async function renderPage() {
  const { default: LotsPage } = await import('./LotsPage');
  return render(<LotsPage />);
}

describe('LotsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the page title and subtitle', async () => {
    mockUseLots.mockReturnValue(defaultReturn());
    await renderPage();

    expect(screen.getByText('Lotes')).toBeTruthy();
    expect(screen.getByText(/Lotes de manejo de Fazenda Santa Helena/)).toBeTruthy();
  });

  it('should render skeleton while loading', async () => {
    mockUseLots.mockReturnValue({
      ...defaultReturn(),
      lots: [],
      isLoading: true,
    });

    await renderPage();
    expect(document.querySelector('.lots__skeleton')).toBeTruthy();
  });

  it('should render lot cards', async () => {
    mockUseLots.mockReturnValue(defaultReturn());
    await renderPage();

    expect(screen.getByText('Lote Maternidade')).toBeTruthy();
    expect(screen.getByText('Lote Recria')).toBeTruthy();
    expect(screen.getByText('12 animais')).toBeTruthy();
    expect(screen.getByText('8 animais')).toBeTruthy();
  });

  it('should show category badges', async () => {
    mockUseLots.mockReturnValue(defaultReturn());
    await renderPage();

    const badges = document.querySelectorAll('.lots__badge--category');
    expect(badges.length).toBe(2);
    expect(badges[0].textContent).toBe('Bezerra');
    expect(badges[1].textContent).toBe('Novilha');
  });

  it('should show capacity bar for lots with maxCapacity', async () => {
    mockUseLots.mockReturnValue(defaultReturn());
    await renderPage();

    // Lot Maternidade has maxCapacity=30, animals=12, so 12/30
    expect(screen.getByText('12/30')).toBeTruthy();
  });

  it('should show empty state when no lots', async () => {
    mockUseLots.mockReturnValue({
      ...defaultReturn(),
      lots: [],
    });
    await renderPage();

    expect(screen.getByText('Nenhum lote encontrado')).toBeTruthy();
  });

  it('should show error message', async () => {
    mockUseLots.mockReturnValue({
      ...defaultReturn(),
      lots: [],
      error: 'Erro de conexão',
    });
    await renderPage();

    expect(screen.getByText('Erro de conexão')).toBeTruthy();
  });

  it('should render "Novo lote" button', async () => {
    mockUseLots.mockReturnValue(defaultReturn());
    await renderPage();

    expect(screen.getByText('Novo lote')).toBeTruthy();
  });

  it('should open create modal when clicking "Novo lote"', async () => {
    mockUseLots.mockReturnValue(defaultReturn());
    await renderPage();

    const btn = screen.getByText('Novo lote');
    await userEvent.click(btn);

    expect(screen.getByTestId('create-lot-modal')).toBeTruthy();
  });

  it('should open detail modal when clicking a lot card', async () => {
    mockUseLots.mockReturnValue(defaultReturn());
    await renderPage();

    const card = screen.getByText('Lote Maternidade');
    await userEvent.click(card);

    expect(screen.getByTestId('lot-detail-modal')).toBeTruthy();
  });

  it('should render search input', async () => {
    mockUseLots.mockReturnValue(defaultReturn());
    await renderPage();

    expect(screen.getByPlaceholderText('Buscar lotes...')).toBeTruthy();
  });

  it('should render filter selects', async () => {
    mockUseLots.mockReturnValue(defaultReturn());
    await renderPage();

    expect(screen.getByLabelText('Filtrar por categoria')).toBeTruthy();
    expect(screen.getByLabelText('Filtrar por tipo de local')).toBeTruthy();
  });

  it('should show pagination when multiple pages', async () => {
    mockUseLots.mockReturnValue({
      ...defaultReturn(),
      meta: { page: 1, limit: 20, total: 40, totalPages: 2 },
    });
    await renderPage();

    expect(screen.getByText('Página 1 de 2')).toBeTruthy();
    expect(screen.getByText('Próxima')).toBeTruthy();
  });
});
