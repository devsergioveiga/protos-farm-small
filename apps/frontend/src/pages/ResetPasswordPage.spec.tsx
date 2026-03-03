import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockResetPassword = vi.fn();
vi.mock('@/services/api', () => ({
  api: {
    resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  },
}));

import ResetPasswordPage from './ResetPasswordPage';

function renderPage(token?: string) {
  const entry = token ? `/reset-password?token=${token}` : '/reset-password';
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows error state when token is missing', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /link inválido/i })).toBeDefined();
    expect(screen.getByText(/incompleto/i)).toBeDefined();
    expect(screen.getByRole('link', { name: /solicitar novo link/i }).getAttribute('href')).toBe(
      '/forgot-password',
    );
  });

  it('renders the form when token is present', () => {
    renderPage('valid-token');

    expect(screen.getByRole('heading', { name: /redefinir senha/i })).toBeDefined();
    expect(screen.getByLabelText(/nova senha/i)).toBeDefined();
    expect(screen.getByLabelText(/confirmar senha/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /redefinir senha/i })).toBeDefined();
  });

  it('shows password strength indicator', async () => {
    const user = userEvent.setup();
    renderPage('valid-token');

    await user.type(screen.getByLabelText(/nova senha \*/i), 'Abc');

    expect(screen.getByText(/mínimo 8 caracteres/i)).toBeDefined();
    expect(screen.getByText(/pelo menos 1 letra maiúscula/i)).toBeDefined();
    expect(screen.getByText(/pelo menos 1 número/i)).toBeDefined();
    expect(screen.getByText(/pelo menos 1 caractere especial/i)).toBeDefined();
  });

  it('shows validation error when passwords do not match', async () => {
    const user = userEvent.setup();
    renderPage('valid-token');

    await user.type(screen.getByLabelText(/nova senha \*/i), 'StrongPass1!');
    await user.type(screen.getByLabelText(/confirmar senha/i), 'Different1!');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/as senhas não coincidem/i)).toBeDefined();
    });
  });

  it('shows validation error when password is weak', async () => {
    const user = userEvent.setup();
    renderPage('valid-token');

    await user.type(screen.getByLabelText(/nova senha \*/i), 'weak');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/não atende todos os critérios/i)).toBeDefined();
    });
  });

  it('submits and shows success state', async () => {
    mockResetPassword.mockResolvedValueOnce({ message: 'ok' });
    const user = userEvent.setup();
    renderPage('valid-token');

    await user.type(screen.getByLabelText(/nova senha \*/i), 'StrongPass1!');
    await user.type(screen.getByLabelText(/confirmar senha/i), 'StrongPass1!');
    await user.click(screen.getByRole('button', { name: /redefinir senha/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /senha redefinida com sucesso/i })).toBeDefined();
    });

    expect(mockResetPassword).toHaveBeenCalledWith('valid-token', 'StrongPass1!');
    expect(screen.getByRole('link', { name: /ir para o login/i }).getAttribute('href')).toBe(
      '/login',
    );
  });

  it('shows error from API on failure', async () => {
    mockResetPassword.mockRejectedValueOnce(new Error('Token expirado'));
    const user = userEvent.setup();
    renderPage('valid-token');

    await user.type(screen.getByLabelText(/nova senha \*/i), 'StrongPass1!');
    await user.type(screen.getByLabelText(/confirmar senha/i), 'StrongPass1!');
    await user.click(screen.getByRole('button', { name: /redefinir senha/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/token expirado/i);
    });
  });

  it('disables button while submitting', async () => {
    let resolvePromise: (v: unknown) => void;
    mockResetPassword.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );
    const user = userEvent.setup();
    renderPage('valid-token');

    await user.type(screen.getByLabelText(/nova senha \*/i), 'StrongPass1!');
    await user.type(screen.getByLabelText(/confirmar senha/i), 'StrongPass1!');
    await user.click(screen.getByRole('button', { name: /redefinir senha/i }));

    const button = screen.getByRole('button', { name: /redefinindo/i });
    expect(button.hasAttribute('disabled')).toBe(true);

    resolvePromise!({ message: 'ok' });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /senha redefinida com sucesso/i })).toBeDefined();
    });
  });
});
