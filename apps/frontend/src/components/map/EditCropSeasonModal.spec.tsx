import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock api
const mockPatch = vi.fn();
vi.mock('@/services/api', () => ({
  api: { patch: (...args: unknown[]) => mockPatch(...args) },
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

import EditCropSeasonModal from './EditCropSeasonModal';
import type { CropSeasonItem } from '@/types/farm';

const mockSeason: CropSeasonItem = {
  id: 'season-1',
  plotId: 'plot-1',
  farmId: 'farm-1',
  seasonType: 'SAFRA',
  seasonYear: '2025/2026',
  crop: 'Soja',
  varietyName: 'TMG 2381',
  startDate: '2025-10-01',
  endDate: '2026-03-15',
  plantedAreaHa: 50,
  productivityKgHa: 3600,
  totalProductionKg: 180000,
  operations: [],
  notes: 'Boa safra',
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const defaultProps = {
  isOpen: true,
  season: mockSeason,
  farmId: 'farm-1',
  plotId: 'plot-1',
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

describe('EditCropSeasonModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(<EditCropSeasonModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders title "Editar safra"', () => {
    render(<EditCropSeasonModal {...defaultProps} />);
    expect(screen.getByText('Editar safra')).toBeDefined();
  });

  it('renders with pre-filled data from season', () => {
    render(<EditCropSeasonModal {...defaultProps} />);

    const cropInput = screen.getByLabelText(/Cultura/) as HTMLInputElement;
    expect(cropInput.value).toBe('Soja');

    const yearInput = screen.getByLabelText(/^Ano/) as HTMLInputElement;
    expect(yearInput.value).toBe('2025/2026');

    const varietyInput = screen.getByLabelText(/Variedade/) as HTMLInputElement;
    expect(varietyInput.value).toBe('TMG 2381');

    const areaInput = screen.getByLabelText(/Área plantada/) as HTMLInputElement;
    expect(areaInput.value).toBe('50');

    const prodInput = screen.getByLabelText(/Produtividade/) as HTMLInputElement;
    expect(prodInput.value).toBe('3600');

    const totalInput = screen.getByLabelText(/Produção total/) as HTMLInputElement;
    expect(totalInput.value).toBe('180000');

    const notesInput = screen.getByLabelText(/Observações/) as HTMLTextAreaElement;
    expect(notesInput.value).toBe('Boa safra');
  });

  it('submits PATCH with correct data', async () => {
    mockPatch.mockResolvedValue({ id: 'season-1' });
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<EditCropSeasonModal {...defaultProps} onSuccess={onSuccess} onClose={onClose} />);

    // Change crop
    const cropInput = screen.getByLabelText(/Cultura/);
    await user.clear(cropInput);
    await user.type(cropInput, 'Milho');

    await user.click(screen.getByText('Salvar alterações'));

    expect(mockPatch).toHaveBeenCalledWith(
      '/org/farms/farm-1/plots/plot-1/crop-seasons/season-1',
      expect.objectContaining({
        crop: 'Milho',
        seasonType: 'SAFRA',
        seasonYear: '2025/2026',
      }),
    );
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows submit error on API failure', async () => {
    mockPatch.mockRejectedValue(new Error('Não foi possível salvar'));
    const user = userEvent.setup();

    render(<EditCropSeasonModal {...defaultProps} />);

    await user.click(screen.getByText('Salvar alterações'));

    expect(screen.getByText('Não foi possível salvar')).toBeDefined();
    expect(defaultProps.onSuccess).not.toHaveBeenCalled();
  });

  it('closes on Escape key', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EditCropSeasonModal {...defaultProps} onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on overlay click', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EditCropSeasonModal {...defaultProps} onClose={onClose} />);

    const overlay = screen.getByRole('dialog');
    await user.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders with null optional fields as empty strings', () => {
    const seasonWithNulls: CropSeasonItem = {
      ...mockSeason,
      varietyName: null,
      startDate: null,
      endDate: null,
      plantedAreaHa: null,
      productivityKgHa: null,
      totalProductionKg: null,
      notes: null,
    };

    render(<EditCropSeasonModal {...defaultProps} season={seasonWithNulls} />);

    const varietyInput = screen.getByLabelText(/Variedade/) as HTMLInputElement;
    expect(varietyInput.value).toBe('');

    const areaInput = screen.getByLabelText(/Área plantada/) as HTMLInputElement;
    expect(areaInput.value).toBe('');

    const notesInput = screen.getByLabelText(/Observações/) as HTMLTextAreaElement;
    expect(notesInput.value).toBe('');
  });

  it('has submit button text "Salvar alterações"', () => {
    render(<EditCropSeasonModal {...defaultProps} />);
    expect(screen.getByText('Salvar alterações')).toBeDefined();
  });

  it('disables submit button while submitting', async () => {
    mockPatch.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<EditCropSeasonModal {...defaultProps} />);

    await user.click(screen.getByText('Salvar alterações'));

    expect(screen.getByText('Salvando...')).toBeDefined();
    const btn = screen.getByText('Salvando...').closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
