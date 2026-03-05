import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPost = vi.fn();
vi.mock('@/services/api', () => ({
  api: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

import AddSoilAnalysisModal from './AddSoilAnalysisModal';

const defaultProps = {
  isOpen: true,
  farmId: 'farm-1',
  plotId: 'plot-1',
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

function renderModal(props = {}) {
  return render(<AddSoilAnalysisModal {...defaultProps} {...props} />);
}

describe('AddSoilAnalysisModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the modal with title and required date field', () => {
    renderModal();

    expect(screen.getByRole('heading', { name: /nova análise de solo/i })).toBeDefined();
    expect(screen.getByLabelText(/data da análise/i)).toBeDefined();
    expect(screen.getByLabelText(/laboratório/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /salvar análise/i })).toBeDefined();
  });

  it('renders all chemical parameter fields', () => {
    renderModal();

    expect(screen.getByLabelText(/pH/)).toBeDefined();
    expect(screen.getByLabelText(/matéria orgânica/i)).toBeDefined();
    expect(screen.getByLabelText(/fósforo/i)).toBeDefined();
    expect(screen.getByLabelText(/potássio/i)).toBeDefined();
    expect(screen.getByLabelText(/cálcio/i)).toBeDefined();
    expect(screen.getByLabelText(/magnésio/i)).toBeDefined();
    expect(screen.getByLabelText(/alumínio/i)).toBeDefined();
    expect(screen.getByLabelText(/CTC/)).toBeDefined();
    expect(screen.getByLabelText(/saturação de bases/i)).toBeDefined();
    expect(screen.getByLabelText(/enxofre/i)).toBeDefined();
    expect(screen.getByLabelText(/argila/i)).toBeDefined();
  });

  it('does not render when isOpen is false', () => {
    renderModal({ isOpen: false });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows error when submitting without date', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: /salvar análise/i }));

    expect(screen.getByText(/data da análise é obrigatória/i)).toBeDefined();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('shows validation error for pH out of range', async () => {
    const user = userEvent.setup();
    renderModal();

    const phInput = screen.getByLabelText(/pH/);
    await user.type(phInput, '15');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/pH deve ser entre 0 e 14/i)).toBeDefined();
    });
  });

  it('shows validation error for V% out of range', async () => {
    const user = userEvent.setup();
    renderModal();

    const vInput = screen.getByLabelText(/saturação de bases/i);
    await user.type(vInput, '150');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/V% deve ser entre 0 e 100%/i)).toBeDefined();
    });
  });

  it('submits with only required date field', async () => {
    mockPost.mockResolvedValueOnce({ id: 'analysis-1' });
    const user = userEvent.setup();
    renderModal();

    const dateInput = screen.getByLabelText(/data da análise/i);
    await user.type(dateInput, '2026-01-15');
    await user.click(screen.getByRole('button', { name: /salvar análise/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/org/farms/farm-1/plots/plot-1/soil-analyses', {
        analysisDate: '2026-01-15',
      });
    });

    expect(defaultProps.onSuccess).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('submits with all fields filled', async () => {
    mockPost.mockResolvedValueOnce({ id: 'analysis-2' });
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/data da análise/i), '2026-02-10');
    await user.type(screen.getByLabelText(/laboratório/i), 'Eurofins');
    await user.type(screen.getByLabelText(/profundidade/i), '0-20 cm');
    await user.type(screen.getByLabelText(/pH/), '5.8');
    await user.type(screen.getByLabelText(/matéria orgânica/i), '3.2');
    await user.type(screen.getByLabelText(/fósforo/i), '12.5');

    await user.click(screen.getByRole('button', { name: /salvar análise/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/org/farms/farm-1/plots/plot-1/soil-analyses',
        expect.objectContaining({
          analysisDate: '2026-02-10',
          labName: 'Eurofins',
          sampleDepthCm: '0-20 cm',
          phH2o: 5.8,
          organicMatterPct: 3.2,
          phosphorusMgDm3: 12.5,
        }),
      );
    });
  });

  it('shows error state on API failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('Erro no servidor'));
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/data da análise/i), '2026-01-15');
    await user.click(screen.getByRole('button', { name: /salvar análise/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/erro no servidor/i);
    });
  });

  it('disables button while submitting', async () => {
    let resolvePromise: (v: unknown) => void;
    mockPost.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/data da análise/i), '2026-01-15');
    await user.click(screen.getByRole('button', { name: /salvar análise/i }));

    const button = screen.getByRole('button', { name: /salvando/i });
    expect(button.hasAttribute('disabled')).toBe(true);

    resolvePromise!({ id: 'analysis-1' });
    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });
  });

  it('closes on Escape key', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.keyboard('{Escape}');

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('closes when clicking overlay', async () => {
    const user = userEvent.setup();
    renderModal();

    const overlay = screen.getByRole('dialog');
    await user.click(overlay);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
