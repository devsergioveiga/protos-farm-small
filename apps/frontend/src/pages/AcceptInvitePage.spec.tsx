import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockAcceptInvite = vi.fn();
const mockLoginWithTokens = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/services/api', () => ({
  api: {
    acceptInvite: (...args: unknown[]) => mockAcceptInvite(...args),
  },
}));

vi.mock('@/stores/AuthContext', () => ({
  useAuth: () => ({
    loginWithTokens: mockLoginWithTokens,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import AcceptInvitePage from './AcceptInvitePage';

function renderPage(token?: string) {
  const entry = token ? `/accept-invite?token=${token}` : '/accept-invite';
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AcceptInvitePage />
    </MemoryRouter>,
  );
}

describe('AcceptInvitePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows error state when token is missing', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /link inválido/i })).toBeDefined();
    expect(screen.getByText(/convite é inválido/i)).toBeDefined();
    expect(screen.getByRole('link', { name: /ir para o login/i }).getAttribute('href')).toBe(
      '/login',
    );
  });

  it('renders the form when token is present', () => {
    renderPage('invite-token');

    expect(screen.getByRole('heading', { name: /defina sua senha/i })).toBeDefined();
    expect(screen.getByLabelText(/^senha \*/i)).toBeDefined();
    expect(screen.getByLabelText(/confirmar senha/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /criar conta e entrar/i })).toBeDefined();
  });

  it('shows validation error when passwords do not match', async () => {
    const user = userEvent.setup();
    renderPage('invite-token');

    await user.type(screen.getByLabelText(/^senha \*/i), 'StrongPass1!');
    await user.type(screen.getByLabelText(/confirmar senha/i), 'Different1!');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/as senhas não coincidem/i)).toBeDefined();
    });
  });

  it('shows validation error when password is weak', async () => {
    const user = userEvent.setup();
    renderPage('invite-token');

    await user.type(screen.getByLabelText(/^senha \*/i), 'weak');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/não atende todos os critérios/i)).toBeDefined();
    });
  });

  it('submits, authenticates and redirects to dashboard', async () => {
    mockAcceptInvite.mockResolvedValueOnce({
      accessToken: 'access-123',
      refreshToken: 'refresh-456',
    });
    const user = userEvent.setup();
    renderPage('invite-token');

    await user.type(screen.getByLabelText(/^senha \*/i), 'StrongPass1!');
    await user.type(screen.getByLabelText(/confirmar senha/i), 'StrongPass1!');
    await user.click(screen.getByRole('button', { name: /criar conta e entrar/i }));

    await waitFor(() => {
      expect(mockAcceptInvite).toHaveBeenCalledWith('invite-token', 'StrongPass1!');
      expect(mockLoginWithTokens).toHaveBeenCalledWith('access-123', 'refresh-456');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  it('shows error from API on failure', async () => {
    mockAcceptInvite.mockRejectedValueOnce(new Error('Convite expirado'));
    const user = userEvent.setup();
    renderPage('invite-token');

    await user.type(screen.getByLabelText(/^senha \*/i), 'StrongPass1!');
    await user.type(screen.getByLabelText(/confirmar senha/i), 'StrongPass1!');
    await user.click(screen.getByRole('button', { name: /criar conta e entrar/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/convite expirado/i);
    });
  });

  it('disables button while submitting', async () => {
    let resolvePromise: (v: unknown) => void;
    mockAcceptInvite.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );
    const user = userEvent.setup();
    renderPage('invite-token');

    await user.type(screen.getByLabelText(/^senha \*/i), 'StrongPass1!');
    await user.type(screen.getByLabelText(/confirmar senha/i), 'StrongPass1!');
    await user.click(screen.getByRole('button', { name: /criar conta e entrar/i }));

    const button = screen.getByRole('button', { name: /criando conta/i });
    expect(button.hasAttribute('disabled')).toBe(true);

    resolvePromise!({ accessToken: 'a', refreshToken: 'b' });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  it('shows link back to login', () => {
    renderPage('invite-token');

    expect(screen.getByRole('link', { name: /já tenho uma conta/i }).getAttribute('href')).toBe(
      '/login',
    );
  });
});
