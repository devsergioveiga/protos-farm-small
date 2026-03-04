import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock api
const mockPost = vi.fn();
vi.mock('@/services/api', () => ({
  api: { post: (...args: unknown[]) => mockPost(...args) },
}));

// Mock CROP_COLORS (needed by constants/plot.ts)
vi.mock('@/components/map/FarmMap', () => ({
  CROP_COLORS: {
    Soja: '#4caf50',
    Milho: '#ffc107',
    Café: '#795548',
    'Sem cultura': '#bdbdbd',
  },
}));

import AddCropSeasonModal from './AddCropSeasonModal';

const defaultProps = {
  isOpen: true,
  farmId: 'farm-1',
  plotId: 'plot-1',
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

describe('AddCropSeasonModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(<AddCropSeasonModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders title "Nova safra"', () => {
    render(<AddCropSeasonModal {...defaultProps} />);
    expect(screen.getByText('Nova safra')).toBeDefined();
  });

  it('renders required fields: Cultura, Tipo de safra, Ano', () => {
    render(<AddCropSeasonModal {...defaultProps} />);
    expect(screen.getByLabelText(/Cultura/)).toBeDefined();
    expect(screen.getByLabelText(/Tipo de safra/)).toBeDefined();
    expect(screen.getByLabelText(/^Ano/)).toBeDefined();
  });

  it('shows validation error when submitting with empty required fields', async () => {
    const user = userEvent.setup();
    render(<AddCropSeasonModal {...defaultProps} />);

    await user.click(screen.getByText('Salvar safra'));

    expect(screen.getByText('Cultura é obrigatória')).toBeDefined();
    expect(screen.getByText('Ano da safra é obrigatório')).toBeDefined();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('shows validation error on blur of empty required field', async () => {
    const user = userEvent.setup();
    render(<AddCropSeasonModal {...defaultProps} />);

    const cropInput = screen.getByLabelText(/Cultura/);
    await user.click(cropInput);
    await user.tab();

    expect(screen.getByText('Cultura é obrigatória')).toBeDefined();
  });

  it('submits successfully with required fields filled', async () => {
    mockPost.mockResolvedValue({ id: 'season-1' });
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<AddCropSeasonModal {...defaultProps} onSuccess={onSuccess} onClose={onClose} />);

    await user.type(screen.getByLabelText(/Cultura/), 'Soja');
    await user.type(screen.getByLabelText(/^Ano/), '2025/2026');
    await user.click(screen.getByText('Salvar safra'));

    expect(mockPost).toHaveBeenCalledWith(
      '/org/farms/farm-1/plots/plot-1/crop-seasons',
      expect.objectContaining({
        crop: 'Soja',
        seasonType: 'SAFRA',
        seasonYear: '2025/2026',
      }),
    );
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows submit error on API failure', async () => {
    mockPost.mockRejectedValue(new Error('Não foi possível salvar'));
    const user = userEvent.setup();

    render(<AddCropSeasonModal {...defaultProps} />);

    await user.type(screen.getByLabelText(/Cultura/), 'Soja');
    await user.type(screen.getByLabelText(/^Ano/), '2025/2026');
    await user.click(screen.getByText('Salvar safra'));

    expect(screen.getByText('Não foi possível salvar')).toBeDefined();
    expect(defaultProps.onSuccess).not.toHaveBeenCalled();
  });

  it('auto-calculates total production from area and productivity', async () => {
    const user = userEvent.setup();
    render(<AddCropSeasonModal {...defaultProps} />);

    await user.type(screen.getByLabelText(/Área plantada/), '50');
    await user.type(screen.getByLabelText(/Produtividade/), '3600');

    const prodInput = screen.getByLabelText(/Produção total/) as HTMLInputElement;
    expect(prodInput.value).toBe('180000');
  });

  it('closes on Escape key', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AddCropSeasonModal {...defaultProps} onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on overlay click', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AddCropSeasonModal {...defaultProps} onClose={onClose} />);

    const overlay = screen.getByRole('dialog');
    await user.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('sends optional fields when filled', async () => {
    mockPost.mockResolvedValue({ id: 'season-1' });
    const user = userEvent.setup();
    render(<AddCropSeasonModal {...defaultProps} />);

    await user.type(screen.getByLabelText(/Cultura/), 'Soja');
    await user.type(screen.getByLabelText(/^Ano/), '2025/2026');
    await user.type(screen.getByLabelText(/Variedade/), 'TMG 2381');
    await user.type(screen.getByLabelText(/Observações/), 'Boa safra');
    await user.click(screen.getByText('Salvar safra'));

    expect(mockPost).toHaveBeenCalledWith(
      '/org/farms/farm-1/plots/plot-1/crop-seasons',
      expect.objectContaining({
        crop: 'Soja',
        seasonYear: '2025/2026',
        varietyName: 'TMG 2381',
        notes: 'Boa safra',
      }),
    );
  });

  it('disables submit button while submitting', async () => {
    // Make post hang forever
    mockPost.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<AddCropSeasonModal {...defaultProps} />);

    await user.type(screen.getByLabelText(/Cultura/), 'Soja');
    await user.type(screen.getByLabelText(/^Ano/), '2025/2026');
    await user.click(screen.getByText('Salvar safra'));

    expect(screen.getByText('Salvando...')).toBeDefined();
    const btn = screen.getByText('Salvando...').closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
