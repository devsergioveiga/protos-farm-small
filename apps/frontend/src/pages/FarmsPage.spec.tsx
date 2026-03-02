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
    _count: { registrations: 2, fieldPlots: 0 },
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
    _count: { registrations: 1, fieldPlots: 0 },
  },
];

const mockUseFarms = vi.fn();
vi.mock('@/hooks/useFarms', () => ({
  useFarms: (...args: unknown[]) => mockUseFarms(...args),
}));

const mockUseAuth = vi.fn();
vi.mock('@/stores/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/services/api', () => ({
  api: { deleteWithBody: vi.fn() },
}));

describe('FarmsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { userId: 'u1', email: 'a@a.com', role: 'ADMIN', organizationId: 'o1' },
      permissions: ['farms:create', 'farms:read', 'farms:update', 'farms:delete'],
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      loginWithTokens: vi.fn(),
      logout: vi.fn(),
    });
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

  it('should render field plot count in cards', async () => {
    mockUseFarms.mockReturnValue(defaultReturn());

    await renderPage();

    const talhoes = screen.getAllByText('0 talhões');
    expect(talhoes.length).toBe(2);
  });

  it('should show delete button when user has farms:delete permission', async () => {
    mockUseFarms.mockReturnValue(defaultReturn());

    await renderPage();

    const deleteBtns = screen.getAllByLabelText(/^Excluir /);
    expect(deleteBtns).toHaveLength(2);
  });

  it('should NOT show delete button when user lacks farms:delete permission', async () => {
    mockUseAuth.mockReturnValue({
      user: { userId: 'u1', email: 'a@a.com', role: 'MANAGER', organizationId: 'o1' },
      permissions: ['farms:create', 'farms:read', 'farms:update'],
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      loginWithTokens: vi.fn(),
      logout: vi.fn(),
    });
    mockUseFarms.mockReturnValue(defaultReturn());

    await renderPage();

    expect(screen.queryAllByLabelText(/^Excluir /)).toHaveLength(0);
  });

  it('should open delete modal when delete button is clicked', async () => {
    const user = userEvent.setup();
    mockUseFarms.mockReturnValue(defaultReturn());

    await renderPage();

    const deleteBtns = screen.getAllByLabelText(/^Excluir /);
    await user.click(deleteBtns[0]);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Excluir fazenda' })).toBeDefined();
  });
});
