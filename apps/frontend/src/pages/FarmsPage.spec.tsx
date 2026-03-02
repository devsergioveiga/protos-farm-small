import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { FarmListItem, FarmsListResponse } from '@/types/farm';

const MOCK_FARMS: FarmListItem[] = [
  {
    id: '1',
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
    _count: { registrations: 2 },
  },
  {
    id: '2',
    name: 'Fazenda Lua',
    nickname: null,
    city: 'Uberaba',
    state: 'MG',
    totalAreaHa: 300,
    boundaryAreaHa: null,
    status: 'INACTIVE',
    landClassification: null,
    latitude: null,
    longitude: null,
    createdAt: '2026-01-02',
    _count: { registrations: 1 },
  },
];

const mockUseFarms = vi.fn();
vi.mock('@/hooks/useFarms', () => ({
  useFarms: (...args: unknown[]) => mockUseFarms(...args),
}));

describe('FarmsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function renderPage() {
    const { default: FarmsPage } = await import('./FarmsPage');
    return render(
      <MemoryRouter>
        <FarmsPage />
      </MemoryRouter>,
    );
  }

  it('should render farm cards when data is loaded', async () => {
    mockUseFarms.mockReturnValue({
      farms: MOCK_FARMS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 } as FarmsListResponse['meta'],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    await renderPage();

    expect(screen.getByText('Fazenda Sol')).toBeDefined();
    expect(screen.getByText('Fazenda Lua')).toBeDefined();
    expect(screen.getByText('Ativa')).toBeDefined();
    expect(screen.getByText('Inativa')).toBeDefined();
  });

  it('should render skeleton loading state', async () => {
    mockUseFarms.mockReturnValue({
      farms: [],
      meta: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    await renderPage();

    expect(screen.getByLabelText('Carregando fazendas')).toBeDefined();
  });

  it('should render empty state when no farms', async () => {
    mockUseFarms.mockReturnValue({
      farms: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    await renderPage();

    expect(screen.getByText('Nenhuma fazenda ainda')).toBeDefined();
  });

  it('should render map links for each farm', async () => {
    mockUseFarms.mockReturnValue({
      farms: MOCK_FARMS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    await renderPage();

    const links = screen.getAllByText('Ver no mapa');
    expect(links).toHaveLength(2);
    expect(links[0].closest('a')?.getAttribute('href')).toBe('/farms/1/map');
    expect(links[1].closest('a')?.getAttribute('href')).toBe('/farms/2/map');
  });
});
