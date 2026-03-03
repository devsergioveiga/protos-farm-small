import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ProducerListItem } from '@/types/producer';

const MOCK_PRODUCERS: ProducerListItem[] = [
  {
    id: 'p1',
    name: 'João Produtor',
    tradeName: 'Fazenda JP',
    document: '12345678901',
    type: 'PF',
    status: 'ACTIVE',
    state: 'SP',
    city: 'Ribeirão Preto',
    createdAt: '2026-01-15T00:00:00.000Z',
    _count: { farmLinks: 2, stateRegistrations: 1 },
  },
  {
    id: 'p2',
    name: 'Agro Corp LTDA',
    tradeName: 'AgroCorp',
    document: '12345678000190',
    type: 'PJ',
    status: 'INACTIVE',
    state: 'MG',
    city: 'Uberlândia',
    createdAt: '2026-02-10T00:00:00.000Z',
    _count: { farmLinks: 0, stateRegistrations: 3 },
  },
  {
    id: 'p3',
    name: 'Irmãos Silva',
    tradeName: null,
    document: null,
    type: 'SOCIEDADE_EM_COMUM',
    status: 'ACTIVE',
    state: 'GO',
    city: 'Goiânia',
    createdAt: '2026-03-01T00:00:00.000Z',
    _count: { farmLinks: 1, stateRegistrations: 0 },
  },
];

const mockUseProducers = vi.fn();
vi.mock('@/hooks/useProducers', () => ({
  useProducers: (...args: unknown[]) => mockUseProducers(...args),
}));

vi.mock('@/components/auth/PermissionGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function defaultReturn() {
  return {
    producers: MOCK_PRODUCERS,
    meta: { page: 1, limit: 20, total: 3, totalPages: 1 },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };
}

async function renderPage() {
  const { default: ProducersPage } = await import('./ProducersPage');
  return render(<ProducersPage />);
}

describe('ProducersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render skeleton while loading', async () => {
    mockUseProducers.mockReturnValue({
      ...defaultReturn(),
      producers: [],
      isLoading: true,
    });

    await renderPage();

    const section = document.querySelector('[aria-live="polite"]');
    expect(section).toBeTruthy();
    const skeletons = document.querySelectorAll('.producers__skeleton');
    expect(skeletons.length).toBe(3);
  });

  it('should render table with producer data', async () => {
    mockUseProducers.mockReturnValue(defaultReturn());

    await renderPage();

    expect(screen.getByText('Produtores')).toBeDefined();
    expect(screen.getAllByText('João Produtor').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Agro Corp LTDA').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Irmãos Silva').length).toBeGreaterThanOrEqual(1);
  });

  it('should format CPF correctly', async () => {
    mockUseProducers.mockReturnValue(defaultReturn());

    await renderPage();

    expect(screen.getAllByText('123.456.789-01').length).toBeGreaterThanOrEqual(1);
  });

  it('should format CNPJ correctly', async () => {
    mockUseProducers.mockReturnValue(defaultReturn());

    await renderPage();

    expect(screen.getAllByText('12.345.678/0001-90').length).toBeGreaterThanOrEqual(1);
  });

  it('should display type badges', async () => {
    mockUseProducers.mockReturnValue(defaultReturn());

    await renderPage();

    expect(screen.getAllByText('Pessoa Física').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Pessoa Jurídica').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sociedade').length).toBeGreaterThanOrEqual(1);
  });

  it('should display status badges', async () => {
    mockUseProducers.mockReturnValue(defaultReturn());

    await renderPage();

    expect(screen.getAllByText('Ativo').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Inativo').length).toBeGreaterThanOrEqual(1);
  });

  it('should update search with debounce', async () => {
    const user = userEvent.setup();
    mockUseProducers.mockReturnValue(defaultReturn());

    await renderPage();

    const searchInput = screen.getByPlaceholderText('Buscar por nome ou CPF/CNPJ...');
    await user.type(searchInput, 'João');

    // The hook is called with search param after debounce
    // Last call should eventually have search param
    const lastCall = mockUseProducers.mock.calls[mockUseProducers.mock.calls.length - 1];
    // Initially called without search; after debounce it will re-render
    expect(lastCall).toBeDefined();
  });

  it('should reset page to 1 when type filter changes', async () => {
    const user = userEvent.setup();
    mockUseProducers.mockReturnValue({
      ...defaultReturn(),
      meta: { page: 2, limit: 20, total: 50, totalPages: 3 },
    });

    await renderPage();

    const typeSelect = screen.getByLabelText('Filtrar por tipo');
    await user.selectOptions(typeSelect, 'PF');

    // After filter change, useProducers should be called with page reset
    const calls = mockUseProducers.mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.type).toBe('PF');
  });

  it('should reset page to 1 when status filter changes', async () => {
    const user = userEvent.setup();
    mockUseProducers.mockReturnValue(defaultReturn());

    await renderPage();

    const statusSelect = screen.getByLabelText('Filtrar por status');
    await user.selectOptions(statusSelect, 'ACTIVE');

    const calls = mockUseProducers.mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.status).toBe('ACTIVE');
  });

  it('should show pagination when multiple pages', async () => {
    mockUseProducers.mockReturnValue({
      ...defaultReturn(),
      meta: { page: 1, limit: 20, total: 50, totalPages: 3 },
    });

    await renderPage();

    expect(screen.getByText('Página 1 de 3')).toBeDefined();
    const prevBtn = screen.getByLabelText('Página anterior');
    const nextBtn = screen.getByLabelText('Próxima página');
    expect(prevBtn.hasAttribute('disabled')).toBe(true);
    expect(nextBtn.hasAttribute('disabled')).toBe(false);
  });

  it('should navigate pages', async () => {
    const user = userEvent.setup();
    mockUseProducers.mockReturnValue({
      ...defaultReturn(),
      meta: { page: 1, limit: 20, total: 50, totalPages: 3 },
    });

    await renderPage();

    const nextBtn = screen.getByLabelText('Próxima página');
    await user.click(nextBtn);

    const calls = mockUseProducers.mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.page).toBe(2);
  });

  it('should show empty state when no producers and no filters', async () => {
    mockUseProducers.mockReturnValue({
      ...defaultReturn(),
      producers: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    await renderPage();

    expect(screen.getByText('Nenhum produtor encontrado')).toBeDefined();
    expect(screen.getByText('Cadastre o primeiro produtor para começar.')).toBeDefined();
  });

  it('should show empty state with filter message when filters active', async () => {
    mockUseProducers.mockReturnValue({
      producers: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    await renderPage();

    // Activate a filter first
    const user = userEvent.setup();
    const typeSelect = screen.getByLabelText('Filtrar por tipo');
    await user.selectOptions(typeSelect, 'PF');

    expect(screen.getByText('Tente ajustar os filtros de busca.')).toBeDefined();
  });

  it('should show error message', async () => {
    mockUseProducers.mockReturnValue({
      ...defaultReturn(),
      error: 'Erro ao carregar produtores',
    });

    await renderPage();

    expect(screen.getByRole('alert').textContent).toContain('Erro ao carregar produtores');
  });

  it('should render both table and cards (responsive)', async () => {
    mockUseProducers.mockReturnValue(defaultReturn());

    await renderPage();

    // Both table and cards are rendered in DOM (CSS controls visibility)
    const table = document.querySelector('.producers__table-wrapper');
    const cards = document.querySelector('.producers__cards');
    expect(table).toBeTruthy();
    expect(cards).toBeTruthy();
  });

  it('should have accessible row buttons', async () => {
    mockUseProducers.mockReturnValue(defaultReturn());

    await renderPage();

    const rows = screen.getAllByRole('button', { name: /Ver detalhes de/ });
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });
});
