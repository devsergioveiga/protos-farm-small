import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  function defaultReturn() {
    return {
      farms: MOCK_FARMS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 } as FarmsListResponse['meta'],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
  }

  async function renderPage() {
    const { default: FarmsPage } = await import('./FarmsPage');
    return render(
      <MemoryRouter>
        <FarmsPage />
      </MemoryRouter>,
    );
  }

  it('should render farm cards when data is loaded', async () => {
    mockUseFarms.mockReturnValue(defaultReturn());

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
    mockUseFarms.mockReturnValue(defaultReturn());

    await renderPage();

    const links = screen.getAllByText('Ver no mapa');
    expect(links).toHaveLength(2);
    expect(links[0].closest('a')?.getAttribute('href')).toBe('/farms/1/map');
    expect(links[1].closest('a')?.getAttribute('href')).toBe('/farms/2/map');
  });

  it('should render view toggle buttons', async () => {
    mockUseFarms.mockReturnValue(defaultReturn());

    await renderPage();

    const cardBtn = screen.getByRole('radio', { name: 'Visualização em cards' });
    const listBtn = screen.getByRole('radio', { name: 'Visualização em lista' });
    expect(cardBtn.getAttribute('aria-checked')).toBe('true');
    expect(listBtn.getAttribute('aria-checked')).toBe('false');
  });

  it('should switch to list view on click', async () => {
    const user = userEvent.setup();
    mockUseFarms.mockReturnValue(defaultReturn());

    await renderPage();

    await user.click(screen.getByRole('radio', { name: 'Visualização em lista' }));

    expect(
      screen.getByRole('radio', { name: 'Visualização em lista' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      screen.getByRole('radio', { name: 'Visualização em cards' }).getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('should render filter controls', async () => {
    mockUseFarms.mockReturnValue(defaultReturn());

    await renderPage();

    expect(screen.getByLabelText('UF')).toBeDefined();
    expect(screen.getByLabelText('Área min (ha)')).toBeDefined();
    expect(screen.getByLabelText('Área máx (ha)')).toBeDefined();
    expect(screen.getByLabelText('Cultura')).toBeDefined();
  });

  it('should render placeholder data in cards', async () => {
    mockUseFarms.mockReturnValue(defaultReturn());

    await renderPage();

    const talhoes = screen.getAllByText('0 talhões');
    expect(talhoes.length).toBe(2);
  });
});
