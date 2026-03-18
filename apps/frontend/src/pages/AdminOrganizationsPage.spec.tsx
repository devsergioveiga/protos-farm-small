import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Organization } from '@/types/admin';

const MOCK_ORGS: Organization[] = [
  {
    id: 'org-1',
    name: 'Agro Corp',
    type: 'PJ',
    document: '12345678000190',
    plan: 'basic',
    status: 'ACTIVE',
    maxUsers: 10,
    maxFarms: 5,
    allowMultipleSessions: false,
    allowSocialLogin: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    _count: { users: 3, farms: 2 },
  },
  {
    id: 'org-2',
    name: 'Fazenda Boa',
    type: 'PF',
    document: '12345678901',
    plan: 'professional',
    status: 'SUSPENDED',
    maxUsers: 20,
    maxFarms: 10,
    allowMultipleSessions: true,
    allowSocialLogin: false,
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    _count: { users: 5, farms: 3 },
  },
];

const mockUseAdminOrganizations = vi.fn();
vi.mock('@/hooks/useAdminOrganizations', () => ({
  useAdminOrganizations: () => mockUseAdminOrganizations(),
}));

const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockApiGet = vi.fn();
vi.mock('@/services/api', () => ({
  api: {
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    get: (...args: unknown[]) => mockApiGet(...args),
  },
}));

describe('AdminOrganizationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function defaultReturn() {
    return {
      organizations: MOCK_ORGS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
  }

  async function renderPage() {
    const { default: AdminOrganizationsPage } = await import('./AdminOrganizationsPage');
    return render(<AdminOrganizationsPage />);
  }

  it('should render organizations list', async () => {
    mockUseAdminOrganizations.mockReturnValue(defaultReturn());

    await renderPage();

    expect(screen.getByText('Organizações')).toBeDefined();
    // Both table and mobile cards render — use getAllByText
    expect(screen.getAllByText('Agro Corp').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Fazenda Boa').length).toBeGreaterThanOrEqual(1);
  });

  it('should render empty state when no organizations', async () => {
    mockUseAdminOrganizations.mockReturnValue({
      ...defaultReturn(),
      organizations: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    await renderPage();

    expect(screen.getByText('Nenhuma organização encontrada')).toBeDefined();
  });

  it('should render skeleton while loading', async () => {
    mockUseAdminOrganizations.mockReturnValue({
      ...defaultReturn(),
      organizations: [],
      isLoading: true,
    });

    await renderPage();

    const section = document.querySelector('[aria-live="polite"]');
    expect(section).toBeTruthy();
  });

  it('should open create modal', async () => {
    const user = userEvent.setup();
    mockUseAdminOrganizations.mockReturnValue(defaultReturn());

    await renderPage();

    const createBtn = screen.getAllByText('Nova organização')[0];
    await user.click(createBtn);

    expect(screen.getByLabelText('Nome *')).toBeDefined();
    expect(screen.getByLabelText('Documento *')).toBeDefined();
  });

  it('should open detail modal when clicking a row', async () => {
    const user = userEvent.setup();
    mockUseAdminOrganizations.mockReturnValue(defaultReturn());
    mockApiGet.mockResolvedValue(MOCK_ORGS[0]);

    await renderPage();

    const row = screen.getAllByLabelText('Ver detalhes de Agro Corp')[0];
    await user.click(row);

    expect(await screen.findByText('Alterar status')).toBeDefined();
    expect(screen.getByText('Alterar plano')).toBeDefined();
    expect(screen.getByText('Políticas')).toBeDefined();
  });

  it('should show pagination when multiple pages', async () => {
    mockUseAdminOrganizations.mockReturnValue({
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

  it('should show error message from hook', async () => {
    mockUseAdminOrganizations.mockReturnValue({
      ...defaultReturn(),
      organizations: MOCK_ORGS,
      error: 'Erro ao carregar organizações',
    });

    await renderPage();

    expect(screen.getByRole('alert').textContent).toContain('Erro ao carregar organizações');
  });
});
