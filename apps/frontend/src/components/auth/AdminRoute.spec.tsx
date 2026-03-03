import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockUseAuth = vi.fn();
vi.mock('@/stores/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('AdminRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function renderRoute(initialPath = '/admin') {
    const { default: AdminRoute } = await import('./AdminRoute');
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<div>Admin Page</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('should redirect to /login when not authenticated', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    });

    await renderRoute();
    expect(screen.getByText('Login Page')).toBeDefined();
  });

  it('should redirect to /dashboard when authenticated but not SUPER_ADMIN', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { userId: 'u1', email: 'a@a.com', role: 'ADMIN', organizationId: 'o1' },
    });

    await renderRoute();
    expect(screen.getByText('Dashboard Page')).toBeDefined();
  });

  it('should render outlet when authenticated as SUPER_ADMIN', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { userId: 'u1', email: 'super@admin.com', role: 'SUPER_ADMIN', organizationId: 'o1' },
    });

    await renderRoute();
    expect(screen.getByText('Admin Page')).toBeDefined();
  });

  it('should render nothing while loading', async () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      user: null,
    });

    const { container } = await renderRoute();
    expect(container.innerHTML).toBe('');
  });
});
