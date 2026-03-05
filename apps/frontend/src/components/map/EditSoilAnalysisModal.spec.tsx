import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockPatch = vi.fn();
vi.mock('@/services/api', () => ({
  api: {
    patch: (...args: unknown[]) => mockPatch(...args),
  },
}));

import EditSoilAnalysisModal from './EditSoilAnalysisModal';
import type { SoilAnalysisItem } from '@/types/farm';

const mockAnalysis: SoilAnalysisItem = {
  id: 'analysis-1',
  plotId: 'plot-1',
  farmId: 'farm-1',
  analysisDate: '2026-01-15',
  labName: 'Eurofins',
  sampleDepthCm: '0-20 cm',
  phH2o: 5.8,
  organicMatterPct: 3.2,
  phosphorusMgDm3: 12.5,
  potassiumMgDm3: 85,
  calciumCmolcDm3: 4.5,
  magnesiumCmolcDm3: 1.8,
  aluminumCmolcDm3: 0.1,
  ctcCmolcDm3: 8.5,
  baseSaturationPct: 65,
  sulfurMgDm3: null,
  clayContentPct: 42,
  notes: 'Amostra da área norte',
  createdBy: 'user-1',
  createdAt: '2026-01-15T10:00:00Z',
};

const defaultProps = {
  isOpen: true,
  analysis: mockAnalysis,
  farmId: 'farm-1',
  plotId: 'plot-1',
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

function renderModal(props = {}) {
  return render(<EditSoilAnalysisModal {...defaultProps} {...props} />);
}

describe('EditSoilAnalysisModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with title "Editar análise de solo"', () => {
    renderModal();

    expect(screen.getByRole('heading', { name: /editar análise de solo/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /salvar alterações/i })).toBeDefined();
  });

  it('pre-fills form fields with analysis data', () => {
    renderModal();

    expect((screen.getByLabelText(/data da análise/i) as HTMLInputElement).value).toBe(
      '2026-01-15',
    );
    expect((screen.getByLabelText(/laboratório/i) as HTMLInputElement).value).toBe('Eurofins');
    expect((screen.getByLabelText(/profundidade/i) as HTMLInputElement).value).toBe('0-20 cm');
    expect((screen.getByLabelText(/pH/) as HTMLInputElement).value).toBe('5.8');
    expect((screen.getByLabelText(/matéria orgânica/i) as HTMLInputElement).value).toBe('3.2');
    expect((screen.getByLabelText(/fósforo/i) as HTMLInputElement).value).toBe('12.5');
    expect((screen.getByLabelText(/observações/i) as HTMLTextAreaElement).value).toBe(
      'Amostra da área norte',
    );
  });

  it('does not render when isOpen is false', () => {
    renderModal({ isOpen: false });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows error when date is cleared', async () => {
    const user = userEvent.setup();
    renderModal();

    const dateInput = screen.getByLabelText(/data da análise/i);
    await user.clear(dateInput);
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    expect(screen.getByText(/data da análise é obrigatória/i)).toBeDefined();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('shows validation error for pH out of range', async () => {
    const user = userEvent.setup();
    renderModal();

    const phInput = screen.getByLabelText(/pH/);
    await user.clear(phInput);
    await user.type(phInput, '15');
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/pH deve ser entre 0 e 14/i)).toBeDefined();
    });
  });

  it('submits PATCH with updated data', async () => {
    mockPatch.mockResolvedValueOnce({ id: 'analysis-1' });
    const user = userEvent.setup();
    renderModal();

    const phInput = screen.getByLabelText(/pH/);
    await user.clear(phInput);
    await user.type(phInput, '6.2');

    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(
        '/org/farms/farm-1/plots/plot-1/soil-analyses/analysis-1',
        expect.objectContaining({
          analysisDate: '2026-01-15',
          phH2o: 6.2,
          labName: 'Eurofins',
        }),
      );
    });

    expect(defaultProps.onSuccess).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('sends null for cleared numeric fields', async () => {
    mockPatch.mockResolvedValueOnce({ id: 'analysis-1' });
    const user = userEvent.setup();
    renderModal();

    const phInput = screen.getByLabelText(/pH/);
    await user.clear(phInput);

    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(
        '/org/farms/farm-1/plots/plot-1/soil-analyses/analysis-1',
        expect.objectContaining({
          phH2o: null,
        }),
      );
    });
  });

  it('shows error state on API failure', async () => {
    mockPatch.mockRejectedValueOnce(new Error('Erro no servidor'));
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/erro no servidor/i);
    });
  });

  it('disables button while submitting', async () => {
    let resolvePromise: (v: unknown) => void;
    mockPatch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

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
