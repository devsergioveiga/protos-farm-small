import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { WeighingItem, WeighingStats } from '@/types/animal';

const FARM_ID = 'farm-1';
const ANIMAL_ID = 'animal-1';

const MOCK_WEIGHINGS: WeighingItem[] = [
  {
    id: 'w1',
    animalId: ANIMAL_ID,
    farmId: FARM_ID,
    weightKg: 450.5,
    measuredAt: '2026-01-15',
    bodyConditionScore: 3,
    notes: 'Pesagem mensal',
    recordedBy: 'user-1',
    recorderName: 'Admin',
    createdAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'w2',
    animalId: ANIMAL_ID,
    farmId: FARM_ID,
    weightKg: 470.0,
    measuredAt: '2026-02-15',
    bodyConditionScore: 4,
    notes: null,
    recordedBy: 'user-1',
    recorderName: 'Admin',
    createdAt: '2026-02-15T10:00:00.000Z',
  },
];

const MOCK_STATS: WeighingStats = {
  currentWeightKg: 470,
  entryWeightKg: 420,
  totalGainKg: 50,
  gmdKgDay: 0.645,
  minWeightKg: 450.5,
  maxWeightKg: 470,
  totalWeighings: 2,
};

const mockUseAnimalWeighings = vi.fn();

vi.mock('@/hooks/useAnimalWeighings', () => ({
  useAnimalWeighings: (...args: unknown[]) => mockUseAnimalWeighings(...args),
}));

// Mock recharts to avoid lazy loading issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  CartesianGrid: () => <div />,
  ReferenceLine: () => <div />,
}));

import WeighingTab from './WeighingTab';

function defaultHookReturn() {
  return {
    weighings: MOCK_WEIGHINGS,
    stats: MOCK_STATS,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    createWeighing: vi.fn().mockResolvedValue(MOCK_WEIGHINGS[0]),
    updateWeighing: vi.fn().mockResolvedValue(MOCK_WEIGHINGS[0]),
    deleteWeighing: vi.fn().mockResolvedValue(undefined),
  };
}

function renderComponent() {
  return render(<WeighingTab farmId={FARM_ID} animalId={ANIMAL_ID} animalEarTag="BR-001" />);
}

describe('WeighingTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset confirm mock
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('renders skeleton while loading', () => {
    mockUseAnimalWeighings.mockReturnValue({
      ...defaultHookReturn(),
      weighings: [],
      stats: null,
      isLoading: true,
    });
    renderComponent();
    expect(document.querySelector('.weighing-tab__skeleton-card')).toBeTruthy();
  });

  it('renders error state with retry button', async () => {
    const refetch = vi.fn();
    mockUseAnimalWeighings.mockReturnValue({
      ...defaultHookReturn(),
      weighings: [],
      stats: null,
      error: 'Erro ao carregar pesagens',
      refetch,
    });
    renderComponent();

    expect(screen.getByText('Erro ao carregar pesagens')).toBeTruthy();
    await userEvent.click(screen.getByText('Tentar novamente'));
    expect(refetch).toHaveBeenCalled();
  });

  it('renders empty state when no weighings', () => {
    mockUseAnimalWeighings.mockReturnValue({
      ...defaultHookReturn(),
      weighings: [],
      stats: { ...MOCK_STATS, totalWeighings: 0 },
    });
    renderComponent();

    expect(screen.getByText('Nenhuma pesagem registrada')).toBeTruthy();
    expect(screen.getByText('Registrar pesagem')).toBeTruthy();
  });

  it('renders stats cards with correct values', () => {
    mockUseAnimalWeighings.mockReturnValue(defaultHookReturn());
    renderComponent();

    expect(screen.getByText('Peso atual')).toBeTruthy();
    expect(screen.getByText('470 kg')).toBeTruthy();
    expect(screen.getByText('GMD')).toBeTruthy();
    expect(screen.getByText(/0.645/)).toBeTruthy();
    expect(screen.getByText('Ganho total')).toBeTruthy();
    expect(screen.getByText('+50 kg')).toBeTruthy();
    expect(screen.getByText('Total pesagens')).toBeTruthy();
  });

  it('renders chart section', () => {
    mockUseAnimalWeighings.mockReturnValue(defaultHookReturn());
    renderComponent();

    expect(screen.getByText('Evolução de peso')).toBeTruthy();
  });

  it('renders records list with weighing data', () => {
    mockUseAnimalWeighings.mockReturnValue(defaultHookReturn());
    renderComponent();

    expect(screen.getByText('Registros de pesagem')).toBeTruthy();
    expect(screen.getByText('450,50')).toBeTruthy();
    expect(screen.getByText('470,00')).toBeTruthy();
  });

  it('opens create modal when clicking add button', async () => {
    mockUseAnimalWeighings.mockReturnValue(defaultHookReturn());
    renderComponent();

    // The "Registrar pesagem" button is in the header actions
    const addButtons = screen.getAllByText('Registrar pesagem');
    await userEvent.click(addButtons[0]);
    expect(screen.getByLabelText(/Peso/)).toBeTruthy();
    expect(screen.getByLabelText(/Data da pesagem/)).toBeTruthy();
  });

  it('opens edit modal when clicking edit on a record', async () => {
    mockUseAnimalWeighings.mockReturnValue(defaultHookReturn());
    renderComponent();

    const editButtons = screen.getAllByLabelText(/Editar pesagem/);
    await userEvent.click(editButtons[0]);
    expect(screen.getByText('Editar pesagem')).toBeTruthy();
  });

  it('calls deleteWeighing when confirming deletion', async () => {
    const deleteWeighing = vi.fn().mockResolvedValue(undefined);
    mockUseAnimalWeighings.mockReturnValue({
      ...defaultHookReturn(),
      deleteWeighing,
    });
    renderComponent();

    const deleteButtons = screen.getAllByLabelText(/Excluir pesagem/);
    await userEvent.click(deleteButtons[0]);
    expect(deleteWeighing).toHaveBeenCalledWith('w1');
  });

  it('shows export button when there are weighings', () => {
    mockUseAnimalWeighings.mockReturnValue(defaultHookReturn());
    renderComponent();

    expect(screen.getByLabelText('Exportar pesagens em CSV')).toBeTruthy();
  });

  it('does not show export button when empty', () => {
    mockUseAnimalWeighings.mockReturnValue({
      ...defaultHookReturn(),
      weighings: [],
      stats: { ...MOCK_STATS, totalWeighings: 0 },
    });
    renderComponent();

    expect(screen.queryByLabelText('Exportar pesagens em CSV')).toBeNull();
  });

  it('shows modal form fields correctly', async () => {
    mockUseAnimalWeighings.mockReturnValue(defaultHookReturn());
    renderComponent();

    await userEvent.click(screen.getByText('Registrar pesagem'));

    // Check all form fields are present
    expect(screen.getByLabelText(/Peso/)).toBeTruthy();
    expect(screen.getByLabelText(/Data da pesagem/)).toBeTruthy();
    expect(screen.getByLabelText(/Escore de condição corporal/)).toBeTruthy();
    expect(screen.getByLabelText(/Observações/)).toBeTruthy();
    expect(screen.getByText('Cancelar')).toBeTruthy();
  });
});
