import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { OrgUserListItem } from '@/types/org-user';

const MOCK_USERS: OrgUserListItem[] = [
  {
    id: 'u1',
    name: 'João Silva',
    email: 'joao@test.com',
    phone: '11999990000',
    role: 'OPERATOR',
    status: 'ACTIVE',
    lastLoginAt: '2026-03-01T10:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    farmAccess: [
      { farm: { id: 'f1', name: 'Fazenda Sol' } },
      { farm: { id: 'f2', name: 'Fazenda Lua' } },
      { farm: { id: 'f3', name: 'Fazenda Mar' } },
    ],
  },
  {
    id: 'u2',
    name: 'Maria Santos',
    email: 'maria@test.com',
    phone: null,
    role: 'AGRONOMIST',
    status: 'INACTIVE',
    lastLoginAt: null,
    createdAt: '2026-02-01T00:00:00.000Z',
    farmAccess: [],
  },
];

const mockUseOrgUsers = vi.fn();
vi.mock('@/hooks/useOrgUsers', () => ({
  useOrgUsers: (...args: unknown[]) => mockUseOrgUsers(...args),
}));

const mockUseUserLimit = vi.fn();
vi.mock('@/hooks/useUserLimit', () => ({
  useUserLimit: () => mockUseUserLimit(),
}));

const mockUseFarms = vi.fn();
vi.mock('@/hooks/useFarms', () => ({
  useFarms: (...args: unknown[]) => mockUseFarms(...args),
}));

vi.mock('@/components/auth/PermissionGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

describe('OrgUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function defaultOrgUsersReturn() {
    return {
      users: MOCK_USERS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
  }

  function defaultLimitReturn() {
    return {
      limit: { current: 2, max: 10, percentage: 20, warning: false, blocked: false },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
  }

  function defaultFarmsReturn() {
    return {
      farms: [
        { id: 'f1', name: 'Fazenda Sol' },
        { id: 'f2', name: 'Fazenda Lua' },
      ],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
  }

  async function renderPage() {
    const { default: OrgUsersPage } = await import('./OrgUsersPage');
    return render(<OrgUsersPage />);
  }

  it('should render users list', async () => {
    mockUseOrgUsers.mockReturnValue(defaultOrgUsersReturn());
    mockUseUserLimit.mockReturnValue(defaultLimitReturn());
    mockUseFarms.mockReturnValue(defaultFarmsReturn());

    await renderPage();

    expect(screen.getByText('Usuários')).toBeDefined();
    expect(screen.getAllByText('João Silva').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Maria Santos').length).toBeGreaterThanOrEqual(1);
  });

  it('should render skeleton while loading', async () => {
    mockUseOrgUsers.mockReturnValue({
      ...defaultOrgUsersReturn(),
      users: [],
      isLoading: true,
    });
    mockUseUserLimit.mockReturnValue(defaultLimitReturn());
    mockUseFarms.mockReturnValue(defaultFarmsReturn());

    await renderPage();

    const section = document.querySelector('[aria-live="polite"]');
    expect(section).toBeTruthy();
  });

  it('should render empty state when no users', async () => {
    mockUseOrgUsers.mockReturnValue({
      ...defaultOrgUsersReturn(),
      users: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    mockUseUserLimit.mockReturnValue(defaultLimitReturn());
    mockUseFarms.mockReturnValue(defaultFarmsReturn());

    await renderPage();

    expect(screen.getByText('Nenhum usuário encontrado')).toBeDefined();
  });

  it('should open create modal', async () => {
    const user = userEvent.setup();
    mockUseOrgUsers.mockReturnValue(defaultOrgUsersReturn());
    mockUseUserLimit.mockReturnValue(defaultLimitReturn());
    mockUseFarms.mockReturnValue(defaultFarmsReturn());

    await renderPage();

    const createBtn = screen.getAllByText('Novo usuário')[0];
    await user.click(createBtn);

    expect(screen.getByLabelText('Nome *')).toBeDefined();
    expect(screen.getByLabelText('Email *')).toBeDefined();
    expect(screen.getByLabelText('Papel *')).toBeDefined();
  });

  it('should open detail modal when clicking a row', async () => {
    const user = userEvent.setup();
    mockUseOrgUsers.mockReturnValue(defaultOrgUsersReturn());
    mockUseUserLimit.mockReturnValue(defaultLimitReturn());
    mockUseFarms.mockReturnValue(defaultFarmsReturn());
    mockApiGet.mockResolvedValue({
      ...MOCK_USERS[0],
      updatedAt: '2026-03-01T10:00:00.000Z',
    });

    await renderPage();

    const row = screen.getAllByLabelText('Ver detalhes de João Silva')[0];
    await user.click(row);

    expect(screen.getByText('Ações')).toBeDefined();
    expect(screen.getByText('Editar')).toBeDefined();
  });

  it('should show pagination when multiple pages', async () => {
    mockUseOrgUsers.mockReturnValue({
      ...defaultOrgUsersReturn(),
      meta: { page: 1, limit: 20, total: 50, totalPages: 3 },
    });
    mockUseUserLimit.mockReturnValue(defaultLimitReturn());
    mockUseFarms.mockReturnValue(defaultFarmsReturn());

    await renderPage();

    expect(screen.getByText('Página 1 de 3')).toBeDefined();
    const prevBtn = screen.getByLabelText('Página anterior');
    const nextBtn = screen.getByLabelText('Próxima página');
    expect(prevBtn.hasAttribute('disabled')).toBe(true);
    expect(nextBtn.hasAttribute('disabled')).toBe(false);
  });

  it('should show limit bar with warning', async () => {
    mockUseOrgUsers.mockReturnValue(defaultOrgUsersReturn());
    mockUseUserLimit.mockReturnValue({
      ...defaultLimitReturn(),
      limit: { current: 8, max: 10, percentage: 80, warning: true, blocked: false },
    });
    mockUseFarms.mockReturnValue(defaultFarmsReturn());

    await renderPage();

    expect(screen.getByText('8 de 10 usuários')).toBeDefined();
  });

  it('should show limit blocked warning in create modal', async () => {
    const user = userEvent.setup();
    mockUseOrgUsers.mockReturnValue(defaultOrgUsersReturn());
    mockUseUserLimit.mockReturnValue({
      ...defaultLimitReturn(),
      limit: { current: 10, max: 10, percentage: 100, warning: true, blocked: true },
    });
    mockUseFarms.mockReturnValue(defaultFarmsReturn());

    await renderPage();

    const createBtn = screen.getAllByText('Novo usuário')[0];
    await user.click(createBtn);

    expect(
      screen.getByText('Limite de usuários atingido. Não é possível criar novos usuários.'),
    ).toBeDefined();
  });

  it('should show error message from hook', async () => {
    mockUseOrgUsers.mockReturnValue({
      ...defaultOrgUsersReturn(),
      users: MOCK_USERS,
      error: 'Erro ao carregar usuários',
    });
    mockUseUserLimit.mockReturnValue(defaultLimitReturn());
    mockUseFarms.mockReturnValue(defaultFarmsReturn());

    await renderPage();

    expect(screen.getByRole('alert').textContent).toContain('Erro ao carregar usuários');
  });

  it('should show farm chips with +N for more than 2 farms', async () => {
    mockUseOrgUsers.mockReturnValue(defaultOrgUsersReturn());
    mockUseUserLimit.mockReturnValue(defaultLimitReturn());
    mockUseFarms.mockReturnValue(defaultFarmsReturn());

    await renderPage();

    // João has 3 farms, should show 2 + "+1"
    expect(screen.getAllByText('+1').length).toBeGreaterThanOrEqual(1);
  });
});
