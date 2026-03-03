import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { FarmListItem } from '@/types/farm';

const MOCK_FARMS: FarmListItem[] = [
  {
    id: 'farm-1',
    name: 'Fazenda Sol',
    nickname: null,
    city: 'Uberlândia',
    state: 'MG',
    totalAreaHa: 500,
    boundaryAreaHa: null,
    status: 'ACTIVE',
    landClassification: null,
    latitude: null,
    longitude: null,
    createdAt: '2026-01-01',
    _count: { registrations: 2, fieldPlots: 0 },
  },
  {
    id: 'farm-2',
    name: 'Fazenda Lua',
    nickname: null,
    city: 'Uberaba',
    state: 'MG',
    totalAreaHa: 300,
    boundaryAreaHa: null,
    status: 'ACTIVE',
    landClassification: null,
    latitude: null,
    longitude: null,
    createdAt: '2026-01-02',
    _count: { registrations: 1, fieldPlots: 0 },
  },
  {
    id: 'farm-3',
    name: 'Fazenda Estrela',
    nickname: null,
    city: 'Goiânia',
    state: 'GO',
    totalAreaHa: 800,
    boundaryAreaHa: null,
    status: 'ACTIVE',
    landClassification: null,
    latitude: null,
    longitude: null,
    createdAt: '2026-01-03',
    _count: { registrations: 0, fieldPlots: 0 },
  },
  {
    id: 'farm-4',
    name: 'Fazenda Rio',
    nickname: null,
    city: 'Campo Grande',
    state: 'MS',
    totalAreaHa: 1200,
    boundaryAreaHa: null,
    status: 'ACTIVE',
    landClassification: null,
    latitude: null,
    longitude: null,
    createdAt: '2026-01-04',
    _count: { registrations: 3, fieldPlots: 0 },
  },
];

const mockSelectFarm = vi.fn();
const mockUseFarmContext = vi.fn();

vi.mock('@/stores/FarmContext', () => ({
  useFarmContext: () => mockUseFarmContext(),
}));

describe('FarmSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFarmContext.mockReturnValue({
      farms: MOCK_FARMS,
      isLoadingFarms: false,
      selectedFarmId: null,
      selectedFarm: null,
      selectFarm: mockSelectFarm,
      refreshFarms: vi.fn(),
    });
  });

  async function renderSelector() {
    const { default: FarmSelector } = await import('./FarmSelector');
    return render(<FarmSelector />);
  }

  it('should show "Todas as fazendas" when none selected', async () => {
    await renderSelector();
    expect(screen.getByText('Todas as fazendas')).toBeDefined();
  });

  it('should show selected farm name in trigger', async () => {
    mockUseFarmContext.mockReturnValue({
      farms: MOCK_FARMS,
      isLoadingFarms: false,
      selectedFarmId: 'farm-1',
      selectedFarm: MOCK_FARMS[0],
      selectFarm: mockSelectFarm,
      refreshFarms: vi.fn(),
    });

    await renderSelector();
    expect(screen.getByText('Fazenda Sol')).toBeDefined();
  });

  it('should open dropdown and show all farms', async () => {
    const user = userEvent.setup();
    await renderSelector();

    await user.click(screen.getByRole('button', { name: /Fazenda selecionada/ }));

    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByText('Todas as fazendas')).toBeDefined();
    expect(within(listbox).getByText('Fazenda Sol')).toBeDefined();
    expect(within(listbox).getByText('Fazenda Lua')).toBeDefined();
  });

  it('should filter farms by search', async () => {
    const user = userEvent.setup();
    await renderSelector();

    await user.click(screen.getByRole('button', { name: /Fazenda selecionada/ }));

    const searchInput = screen.getByPlaceholderText('Buscar por nome ou cidade...');
    await user.type(searchInput, 'Goiânia');

    const listbox = screen.getByRole('listbox');
    expect(within(listbox).queryByText('Fazenda Sol')).toBeNull();
    expect(within(listbox).getByText('Fazenda Estrela')).toBeDefined();
  });

  it('should call selectFarm on item click', async () => {
    const user = userEvent.setup();
    await renderSelector();

    await user.click(screen.getByRole('button', { name: /Fazenda selecionada/ }));

    const listbox = screen.getByRole('listbox');
    await user.click(within(listbox).getByText('Fazenda Sol'));

    expect(mockSelectFarm).toHaveBeenCalledWith('farm-1');
  });

  it('should show loading state', async () => {
    mockUseFarmContext.mockReturnValue({
      farms: [],
      isLoadingFarms: true,
      selectedFarmId: null,
      selectedFarm: null,
      selectFarm: mockSelectFarm,
      refreshFarms: vi.fn(),
    });

    await renderSelector();
    expect(screen.getByText('Carregando fazendas...')).toBeDefined();
  });
});
