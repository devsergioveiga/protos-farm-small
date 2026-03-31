import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { FarmWeighingItem } from '@/types/animal';

const MOCK_WEIGHINGS: FarmWeighingItem[] = [
  {
    id: 'w1',
    animalId: 'a1',
    earTag: 'BR-001',
    animalName: 'Mimosa',
    weightKg: 455,
    measuredAt: '2026-03-20',
    bodyConditionScore: 3,
    notes: null,
    recorderName: 'João',
  },
  {
    id: 'w2',
    animalId: 'a2',
    earTag: 'BR-002',
    animalName: 'Estrela',
    weightKg: 320,
    measuredAt: '2026-03-20',
    bodyConditionScore: null,
    notes: 'Animal agitado',
    recorderName: 'Maria',
  },
];

const mockUseFarmWeighings = vi.fn();
const mockUseLots = vi.fn();
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPatch = vi.fn();
const mockApiDelete = vi.fn();
let mockSelectedFarm: { id: string; name: string } | null = {
  id: 'farm-1',
  name: 'Fazenda Santa Helena',
};

vi.mock('@/hooks/useFarmWeighings', () => ({
  useFarmWeighings: (...args: unknown[]) => mockUseFarmWeighings(...args),
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
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
  },
}));

vi.mock('@/components/auth/PermissionGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/ConfirmModal', () => ({
  default: () => null,
}));

function defaultWeighingsReturn() {
  return {
    weighings: MOCK_WEIGHINGS,
    meta: { page: 1, limit: 30, total: 2, totalPages: 1 },
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
    mockUseFarmWeighings.mockReturnValue(defaultWeighingsReturn());
    mockUseLots.mockReturnValue(defaultLotsReturn());
    mockApiPost.mockResolvedValue({ id: 'w-new' });
  });

  it('renders empty state when no farm is selected', async () => {
    mockSelectedFarm = null;
    await renderPage();
    expect(screen.getByText('Selecione uma fazenda')).toBeTruthy();
  });

  it('renders history with weighing records', async () => {
    await renderPage();
    expect(screen.getByText('Pesagens')).toBeTruthy();
    expect(screen.getAllByText('BR-001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('BR-002').length).toBeGreaterThan(0);
    // weightKg.toFixed(1) => "455.0"
    expect(screen.getAllByText('455.0').length).toBeGreaterThan(0);
  });

  it('renders empty state when no weighings found', async () => {
    mockUseFarmWeighings.mockReturnValue({
      ...defaultWeighingsReturn(),
      weighings: [],
      meta: { page: 1, limit: 30, total: 0, totalPages: 0 },
    });
    await renderPage();
    expect(screen.getByText('Nenhuma pesagem registrada')).toBeTruthy();
  });

  it('navigates to start phase when clicking Nova pesagem', async () => {
    const user = userEvent.setup();
    await renderPage();

    const btn = screen.getByRole('button', { name: /Nova pesagem/i });
    await user.click(btn);

    expect(screen.getByText('Nova sessão de pesagem')).toBeTruthy();
    expect(screen.getByLabelText(/Data da pesagem/i)).toBeTruthy();
  });

  it('navigates to weighing phase from start', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: /Nova pesagem/i }));
    await user.click(screen.getByRole('button', { name: /Iniciar sessão/i }));

    expect(screen.getByText('Sessão de pesagem')).toBeTruthy();
  });

  it('shows summary when ending session', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: /Nova pesagem/i }));
    await user.click(screen.getByRole('button', { name: /Iniciar sessão/i }));
    await user.click(screen.getByRole('button', { name: /Encerrar sessão/i }));

    expect(screen.getByText('Resumo da sessão')).toBeTruthy();
  });

  it('returns to history from summary', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: /Nova pesagem/i }));
    await user.click(screen.getByRole('button', { name: /Iniciar sessão/i }));
    await user.click(screen.getByRole('button', { name: /Encerrar sessão/i }));
    await user.click(screen.getByRole('button', { name: /Voltar ao histórico/i }));

    expect(screen.getByText('Pesagens')).toBeTruthy();
  });

  it('returns to history from start phase', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: /Nova pesagem/i }));
    await user.click(screen.getByRole('button', { name: /Voltar/i }));

    expect(screen.getByText('Pesagens')).toBeTruthy();
  });

  it('resets to history when farm changes', async () => {
    const { unmount } = await renderPage();
    unmount();

    mockSelectedFarm = { id: 'farm-2', name: 'Outra Fazenda' };
    await renderPage();

    expect(screen.getByText('Pesagens')).toBeTruthy();
    expect(screen.getByText(/Outra Fazenda/)).toBeTruthy();
  });

  it('passes sort params to useFarmWeighings', async () => {
    await renderPage();

    expect(mockUseFarmWeighings).toHaveBeenCalledWith(
      expect.objectContaining({
        farmId: 'farm-1',
        sortBy: 'measuredAt',
        sortOrder: 'desc',
      }),
    );
  });

  it('passes lot filter from start phase', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: /Nova pesagem/i }));

    const lotSelect = screen.getByLabelText(/Filtrar por lote/i);
    await user.selectOptions(lotSelect, 'lot-1');

    expect((lotSelect as HTMLSelectElement).value).toBe('lot-1');
  });
});
