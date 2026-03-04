import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock api
const mockPatch = vi.fn();
vi.mock('@/services/api', () => ({
  api: { patch: (...args: unknown[]) => mockPatch(...args) },
}));

// Mock CROP_COLORS
vi.mock('@/components/map/FarmMap', () => ({
  CROP_COLORS: {
    Soja: '#4caf50',
    Milho: '#ffc107',
    Café: '#795548',
    Algodão: '#e0e0e0',
    'Cana-de-açúcar': '#8bc34a',
    Pasto: '#a5d6a7',
    Arroz: '#ffeb3b',
    Feijão: '#d4a574',
    Trigo: '#cddc39',
    Sorgo: '#ff9800',
    'Sem cultura': '#bdbdbd',
  },
}));

import EditPlotModal from './EditPlotModal';
import type { FieldPlot, FarmRegistration } from '@/types/farm';

const basePlot: FieldPlot = {
  id: 'plot-1',
  farmId: 'farm-1',
  registrationId: 'reg-1',
  name: 'Talhão A',
  code: 'TA-001',
  soilType: 'LATOSSOLO_VERMELHO',
  currentCrop: 'Soja',
  previousCrop: 'Milho',
  notes: 'Solo fértil',
  boundaryAreaHa: 50,
  status: 'active',
  createdAt: '2026-01-15T10:00:00Z',
};

const registrations: FarmRegistration[] = [
  {
    id: 'reg-1',
    farmId: 'farm-1',
    number: '12345',
    cnsCode: null,
    cartorioName: 'Cartório Central',
    comarca: 'Uberlândia',
    state: 'MG',
    livro: null,
    registrationDate: null,
    areaHa: 100,
    boundaryAreaHa: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
];

const defaultProps = {
  plot: basePlot,
  farmId: 'farm-1',
  registrations,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

describe('EditPlotModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPatch.mockResolvedValue(basePlot);
  });

  it('renders with fields pre-populated from plot data', () => {
    render(<EditPlotModal {...defaultProps} />);

    expect(screen.getByText('Editar talhão')).toBeDefined();
    expect((screen.getByLabelText(/^Nome/) as HTMLInputElement).value).toBe('Talhão A');
    expect((screen.getByLabelText('Código') as HTMLInputElement).value).toBe('TA-001');
    expect((screen.getByLabelText('Tipo de solo') as HTMLSelectElement).value).toBe(
      'LATOSSOLO_VERMELHO',
    );
    expect((screen.getByLabelText('Cultura atual') as HTMLInputElement).value).toBe('Soja');
    expect((screen.getByLabelText('Cultura anterior') as HTMLInputElement).value).toBe('Milho');
    expect((screen.getByLabelText('Matrícula vinculada') as HTMLSelectElement).value).toBe('reg-1');
    expect((screen.getByLabelText('Notas') as HTMLTextAreaElement).value).toBe('Solo fértil');
  });

  it('validates name as required on blur', async () => {
    const user = userEvent.setup();
    render(<EditPlotModal {...defaultProps} />);

    const nameInput = screen.getByLabelText(/^Nome/);
    await user.clear(nameInput);
    await user.tab();

    expect(screen.getByText('Nome é obrigatório')).toBeDefined();
  });

  it('does not submit if name is empty', async () => {
    const user = userEvent.setup();
    render(<EditPlotModal {...defaultProps} />);

    const nameInput = screen.getByLabelText(/^Nome/);
    await user.clear(nameInput);
    await user.click(screen.getByText('Salvar alterações'));

    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('submits with correct API call and payload', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    render(<EditPlotModal {...defaultProps} onSuccess={onSuccess} onClose={onClose} />);

    await user.click(screen.getByText('Salvar alterações'));

    expect(mockPatch).toHaveBeenCalledWith('/org/farms/farm-1/plots/plot-1', {
      name: 'Talhão A',
      code: 'TA-001',
      soilType: 'LATOSSOLO_VERMELHO',
      currentCrop: 'Soja',
      previousCrop: 'Milho',
      registrationId: 'reg-1',
      notes: 'Solo fértil',
    });
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('sends null for cleared optional fields', async () => {
    const user = userEvent.setup();
    const plotWithoutOptionals: FieldPlot = {
      ...basePlot,
      code: null,
      soilType: null,
      currentCrop: null,
      previousCrop: null,
      registrationId: null,
      notes: null,
    };
    render(<EditPlotModal {...defaultProps} plot={plotWithoutOptionals} registrations={[]} />);

    await user.click(screen.getByText('Salvar alterações'));

    expect(mockPatch).toHaveBeenCalledWith('/org/farms/farm-1/plots/plot-1', {
      name: 'Talhão A',
      code: null,
      soilType: null,
      currentCrop: null,
      previousCrop: null,
      registrationId: null,
      notes: null,
    });
  });

  it('displays server error with role="alert"', async () => {
    mockPatch.mockRejectedValue(new Error('Conflito de nome'));
    const user = userEvent.setup();
    render(<EditPlotModal {...defaultProps} />);

    await user.click(screen.getByText('Salvar alterações'));

    await waitFor(() => {
      expect(screen.getByText('Conflito de nome')).toBeDefined();
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });

  it('closes on Escape key press', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EditPlotModal {...defaultProps} onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Cancel button click', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EditPlotModal {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByText('Cancelar'));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on overlay click', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EditPlotModal {...defaultProps} onClose={onClose} />);

    const overlay = screen.getByRole('dialog');
    await user.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('disables submit button during submission', async () => {
    mockPatch.mockImplementation(() => new Promise(() => {})); // never resolves
    const user = userEvent.setup();
    render(<EditPlotModal {...defaultProps} />);

    await user.click(screen.getByText('Salvar alterações'));

    await waitFor(() => {
      expect(screen.getByText('Salvando...')).toBeDefined();
      const btn = screen.getByText('Salvando...').closest('button') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });
  });

  it('shows soil type select with 9 options plus placeholder', () => {
    render(<EditPlotModal {...defaultProps} />);
    const select = screen.getByLabelText('Tipo de solo');
    const options = within(select).getAllByRole('option');
    expect(options).toHaveLength(10);
  });

  it('has crop datalist linked to cultura input', () => {
    render(<EditPlotModal {...defaultProps} />);
    const input = screen.getByLabelText('Cultura atual') as HTMLInputElement;
    expect(input.getAttribute('list')).toBe('edit-plot-crop-list');
  });

  it('hides registration select when no registrations', () => {
    render(<EditPlotModal {...defaultProps} registrations={[]} />);
    expect(screen.queryByLabelText('Matrícula vinculada')).toBeNull();
  });

  it('has accessible dialog attributes', () => {
    render(<EditPlotModal {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('edit-plot-title');
  });
});
