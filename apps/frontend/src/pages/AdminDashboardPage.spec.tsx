import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockUseAdminDashboard = vi.fn();
vi.mock('@/hooks/useAdminDashboard', () => ({
  useAdminDashboard: () => mockUseAdminDashboard(),
}));

const MOCK_STATS = {
  organizations: {
    total: 5,
    active: 3,
    suspended: 1,
    cancelled: 1,
    byPlan: [
      { plan: 'basic', count: 3 },
      { plan: 'professional', count: 2 },
    ],
  },
  users: { total: 42 },
  farms: { total: 18 },
};

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function renderPage() {
    const { default: AdminDashboardPage } = await import('./AdminDashboardPage');
    return render(<AdminDashboardPage />);
  }

  it('should render skeleton while loading', async () => {
    mockUseAdminDashboard.mockReturnValue({
      stats: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    await renderPage();

    const section = document.querySelector('[aria-live="polite"]');
    expect(section).toBeTruthy();
  });

  it('should render stats when loaded', async () => {
    mockUseAdminDashboard.mockReturnValue({
      stats: MOCK_STATS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    await renderPage();

    expect(screen.getByText('Dashboard Admin')).toBeDefined();
    expect(screen.getByText('Organizações')).toBeDefined();
    expect(screen.getByText('Usuários')).toBeDefined();
    expect(screen.getByText('Fazendas')).toBeDefined();
    expect(screen.getByText('5')).toBeDefined();
    expect(screen.getByText('42')).toBeDefined();
    expect(screen.getByText('18')).toBeDefined();
    expect(screen.getByText('Ativas')).toBeDefined();
    expect(screen.getByText('Suspensas')).toBeDefined();
    expect(screen.getByText('Canceladas')).toBeDefined();
  });

  it('should render plan distribution', async () => {
    mockUseAdminDashboard.mockReturnValue({
      stats: MOCK_STATS,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    await renderPage();

    expect(screen.getByText('Distribuição por plano')).toBeDefined();
    expect(screen.getByText('Básico')).toBeDefined();
    expect(screen.getByText('Profissional')).toBeDefined();
  });

  it('should render error message', async () => {
    mockUseAdminDashboard.mockReturnValue({
      stats: null,
      isLoading: false,
      error: 'Não foi possível carregar estatísticas',
      refetch: vi.fn(),
    });

    await renderPage();

    expect(screen.getByRole('alert').textContent).toContain(
      'Não foi possível carregar estatísticas',
    );
  });
});
