import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockLogout = vi.fn().mockResolvedValue(undefined);
const mockUseAuth = vi.fn();

vi.mock('@/stores/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { userId: 'u1', email: 'super@admin.com', role: 'SUPER_ADMIN', organizationId: 'o1' },
      isAuthenticated: true,
      isLoading: false,
      permissions: [],
      logout: mockLogout,
    });
  });

  async function renderLayout(initialPath = '/admin') {
    const { default: AdminLayout } = await import('./AdminLayout');
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<div>Admin Dashboard Content</div>} />
            <Route path="/admin/organizations" element={<div>Organizations Content</div>} />
            <Route path="/admin/audit-logs" element={<div>Audit Logs Content</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/dashboard" element={<div>App Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('should render sidebar with all navigation links', async () => {
    await renderLayout();

    expect(screen.getByText('Protos Farm')).toBeDefined();
    expect(screen.getByText('Admin')).toBeDefined();
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Organizações')).toBeDefined();
    expect(screen.getByText('Auditoria')).toBeDefined();
    expect(screen.getByText('Voltar ao app')).toBeDefined();
  });

  it('should render user email in footer', async () => {
    await renderLayout();
    expect(screen.getByText('super@admin.com')).toBeDefined();
  });

  it('should mark active link with aria-current', async () => {
    await renderLayout('/admin');

    const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });
    expect(dashboardLink.getAttribute('aria-current')).toBe('page');

    const orgsLink = screen.getByRole('link', { name: 'Organizações' });
    expect(orgsLink.getAttribute('aria-current')).toBeNull();
  });

  it('should render page content via Outlet', async () => {
    await renderLayout('/admin');
    expect(screen.getByText('Admin Dashboard Content')).toBeDefined();
  });

  it('should navigate between pages', async () => {
    const user = userEvent.setup();
    await renderLayout('/admin');

    await user.click(screen.getByRole('link', { name: 'Organizações' }));
    expect(screen.getByText('Organizations Content')).toBeDefined();
  });

  it('should call logout on button click', async () => {
    const user = userEvent.setup();
    await renderLayout();

    await user.click(screen.getByRole('button', { name: 'Sair da conta' }));
    expect(mockLogout).toHaveBeenCalledOnce();
  });

  it('should have hamburger button for mobile', async () => {
    await renderLayout();
    expect(screen.getByRole('button', { name: 'Abrir menu de navegação' })).toBeDefined();
  });

  it('should have proper accessibility labels on sidebar', async () => {
    await renderLayout();
    expect(screen.getByRole('complementary', { name: 'Navegação admin' })).toBeDefined();
    expect(screen.getByRole('navigation', { name: 'Menu admin' })).toBeDefined();
  });
});
