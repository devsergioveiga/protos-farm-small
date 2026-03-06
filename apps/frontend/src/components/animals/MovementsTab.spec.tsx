import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { AnimalMovementItem, AnimalMovementStats } from '@/types/animal';

const FARM_ID = 'farm-1';
const ANIMAL_ID = 'animal-1';

const MOCK_MOVEMENTS: AnimalMovementItem[] = [
  {
    id: 'mov-1',
    lotName: 'Lote Lactação',
    lotLocationType: 'GALPAO',
    locationName: 'Galpão de Ordenha',
    previousLotName: 'Lote Recria Fêmeas',
    enteredAt: '2026-02-01T00:00:00.000Z',
    exitedAt: null,
    durationDays: 33,
    reason: 'Início lactação',
    movedByName: 'Admin',
  },
  {
    id: 'mov-2',
    lotName: 'Lote Recria Fêmeas',
    lotLocationType: 'PASTO',
    locationName: 'Pasto Norte',
    previousLotName: 'Lote Maternidade',
    enteredAt: '2025-12-01T00:00:00.000Z',
    exitedAt: '2026-02-01T00:00:00.000Z',
    durationDays: 62,
    reason: 'Recria',
    movedByName: 'Admin',
  },
  {
    id: 'mov-3',
    lotName: 'Lote Maternidade',
    lotLocationType: 'BEZERREIRO',
    locationName: 'Bezerreiro',
    previousLotName: null,
    enteredAt: '2025-09-01T00:00:00.000Z',
    exitedAt: '2025-12-01T00:00:00.000Z',
    durationDays: 91,
    reason: 'Nascimento',
    movedByName: 'Admin',
  },
];

const MOCK_STATS: AnimalMovementStats = {
  totalMovements: 3,
  currentLotName: 'Lote Lactação',
  currentLocationName: 'Galpão de Ordenha',
  daysInCurrentLot: 33,
  distinctLots: 3,
};

const mockUseAnimalMovements = vi.fn();

vi.mock('@/hooks/useAnimalMovements', () => ({
  useAnimalMovements: (...args: unknown[]) => mockUseAnimalMovements(...args),
}));

import MovementsTab from './MovementsTab';

function defaultHookReturn() {
  return {
    movements: MOCK_MOVEMENTS,
    stats: MOCK_STATS,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };
}

function renderComponent() {
  return render(<MovementsTab farmId={FARM_ID} animalId={ANIMAL_ID} />);
}

describe('MovementsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders skeleton while loading', () => {
    mockUseAnimalMovements.mockReturnValue({
      ...defaultHookReturn(),
      movements: [],
      stats: null,
      isLoading: true,
    });
    renderComponent();
    expect(document.querySelector('.movements-tab__skeleton-card')).toBeTruthy();
  });

  it('renders error state with retry button', async () => {
    const refetch = vi.fn();
    mockUseAnimalMovements.mockReturnValue({
      ...defaultHookReturn(),
      movements: [],
      stats: null,
      error: 'Erro ao carregar movimentações',
      refetch,
    });
    renderComponent();

    expect(screen.getByText('Erro ao carregar movimentações')).toBeTruthy();
    await userEvent.click(screen.getByText('Tentar novamente'));
    expect(refetch).toHaveBeenCalled();
  });

  it('renders empty state when no movements', () => {
    mockUseAnimalMovements.mockReturnValue({
      ...defaultHookReturn(),
      movements: [],
      stats: { ...MOCK_STATS, totalMovements: 0 },
    });
    renderComponent();

    expect(screen.getByText('Nenhuma movimentação')).toBeTruthy();
  });

  it('renders stats cards with correct values', () => {
    mockUseAnimalMovements.mockReturnValue(defaultHookReturn());
    renderComponent();

    expect(screen.getByText('MOVIMENTAÇÕES')).toBeTruthy();
    expect(screen.getByText('LOTE ATUAL')).toBeTruthy();
    expect(screen.getByText('DIAS NO LOTE')).toBeTruthy();
    expect(screen.getAllByText('Lote Lactação').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Galpão de Ordenha').length).toBeGreaterThan(0);
  });

  it('renders movement list with history', () => {
    mockUseAnimalMovements.mockReturnValue(defaultHookReturn());
    renderComponent();

    expect(screen.getByText('Histórico de movimentações')).toBeTruthy();
    expect(screen.getAllByText('Lote Lactação').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Lote Recria Fêmeas').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Lote Maternidade').length).toBeGreaterThan(0);
  });

  it('shows Atual badge for current movement', () => {
    mockUseAnimalMovements.mockReturnValue(defaultHookReturn());
    renderComponent();

    expect(screen.getAllByText('Atual').length).toBeGreaterThan(0);
  });

  it('shows location type badges', () => {
    mockUseAnimalMovements.mockReturnValue(defaultHookReturn());
    renderComponent();

    expect(screen.getAllByText('Galpão').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pasto').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bezerreiro').length).toBeGreaterThan(0);
  });

  it('displays duration for each movement', () => {
    mockUseAnimalMovements.mockReturnValue(defaultHookReturn());
    renderComponent();

    expect(screen.getAllByText('33 dias').length).toBeGreaterThan(0);
    expect(screen.getAllByText('62 dias').length).toBeGreaterThan(0);
    expect(screen.getAllByText('91 dias').length).toBeGreaterThan(0);
  });
});
