import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockForgotPassword = vi.fn();
vi.mock('@/services/api', () => ({
  api: {
    forgotPassword: (...args: unknown[]) => mockForgotPassword(...args),
  },
}));

import ForgotPasswordPage from './ForgotPasswordPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <ForgotPasswordPage />
    </MemoryRouter>,
  );
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form with email field and submit button', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /esqueci minha senha/i })).toBeDefined();
    expect(screen.getByLabelText(/email/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /enviar link de recuperação/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /voltar para o login/i }).getAttribute('href')).toBe(
      '/login',
    );
  });

  it('shows error when submitting empty email', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /enviar link de recuperação/i }));

    expect(screen.getByRole('alert').textContent).toMatch(/informe seu email/i);
    expect(mockForgotPassword).not.toHaveBeenCalled();
  });

  it('submits email and shows success state', async () => {
    mockForgotPassword.mockResolvedValueOnce({ message: 'ok' });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), 'user@test.com');
    await user.click(screen.getByRole('button', { name: /enviar link de recuperação/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /verifique seu e-mail/i })).toBeDefined();
    });

    expect(mockForgotPassword).toHaveBeenCalledWith('user@test.com');
    expect(screen.getByText(/user@test.com/)).toBeDefined();
  });

  it('shows error state on API failure', async () => {
    mockForgotPassword.mockRejectedValueOnce(new Error('Usuário não encontrado'));
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), 'bad@test.com');
    await user.click(screen.getByRole('button', { name: /enviar link de recuperação/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/usuário não encontrado/i);
    });
  });

  it('disables button while submitting', async () => {
    let resolvePromise: (v: unknown) => void;
    mockForgotPassword.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), 'user@test.com');
    await user.click(screen.getByRole('button', { name: /enviar link de recuperação/i }));

    const button = screen.getByRole('button', { name: /enviando/i });
    expect(button.hasAttribute('disabled')).toBe(true);

    resolvePromise!({ message: 'ok' });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /verifique seu e-mail/i })).toBeDefined();
    });
  });
});
