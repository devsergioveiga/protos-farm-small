import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock useCreatePlot hook
const mockSetField = vi.fn();
const mockTouchField = vi.fn();
const mockSetFile = vi.fn();
const mockSubmit = vi.fn();
const mockReset = vi.fn();
const mockValidate = vi.fn();

let mockHookState = {
  formData: {
    name: '',
    code: '',
    soilType: '',
    currentCrop: '',
    previousCrop: '',
    notes: '',
    registrationId: '',
  },
  errors: {} as Record<string, string>,
  touched: {} as Record<string, boolean>,
  boundaryFile: null as File | null,
  boundaryError: null as string | null,
  isSubmitting: false,
  submitError: null as string | null,
  warnings: [] as string[],
};

vi.mock('@/hooks/useCreatePlot', () => ({
  useCreatePlot: () => ({
    ...mockHookState,
    setField: mockSetField,
    touchField: mockTouchField,
    setFile: mockSetFile,
    submit: mockSubmit,
    reset: mockReset,
    validate: mockValidate,
  }),
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

import CreatePlotModal from './CreatePlotModal';
import type { FarmRegistration } from '@/types/farm';

const defaultProps = {
  isOpen: true,
  farmId: 'farm-1',
  registrations: [
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
  ] as FarmRegistration[],
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

describe('CreatePlotModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHookState = {
      formData: {
        name: '',
        code: '',
        soilType: '',
        currentCrop: '',
        previousCrop: '',
        notes: '',
        registrationId: '',
      },
      errors: {},
      touched: {},
      boundaryFile: null,
      boundaryError: null,
      isSubmitting: false,
      submitError: null,
      warnings: [],
    };
  });

  it('does not render when isOpen is false', () => {
    render(<CreatePlotModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders title "Novo talhão"', () => {
    render(<CreatePlotModal {...defaultProps} />);
    expect(screen.getByText('Novo talhão')).toBeDefined();
  });

  it('shows name error when touched with empty value', () => {
    mockHookState.errors = { name: 'Nome é obrigatório' };
    mockHookState.touched = { name: true };
    render(<CreatePlotModal {...defaultProps} />);
    expect(screen.getByText('Nome é obrigatório')).toBeDefined();
  });

  it('shows boundary error when present', () => {
    mockHookState.boundaryError = 'Arquivo de perímetro é obrigatório';
    render(<CreatePlotModal {...defaultProps} />);
    expect(screen.getByText('Arquivo de perímetro é obrigatório')).toBeDefined();
  });

  it('calls submit with farmId on form submit', async () => {
    mockSubmit.mockResolvedValue(true);
    const user = userEvent.setup();
    render(<CreatePlotModal {...defaultProps} />);

    await user.click(screen.getByText('Criar talhão'));
    expect(mockSubmit).toHaveBeenCalledWith('farm-1');
  });

  it('calls onSuccess and onClose after successful submit', async () => {
    mockSubmit.mockResolvedValue(true);
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<CreatePlotModal {...defaultProps} onSuccess={onSuccess} onClose={onClose} />);

    await user.click(screen.getByText('Criar talhão'));
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onSuccess on failed submit', async () => {
    mockSubmit.mockResolvedValue(false);
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<CreatePlotModal {...defaultProps} onSuccess={onSuccess} />);

    await user.click(screen.getByText('Criar talhão'));
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('closes on Escape key', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<CreatePlotModal {...defaultProps} onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(mockReset).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on overlay click', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<CreatePlotModal {...defaultProps} onClose={onClose} />);

    const overlay = screen.getByRole('dialog');
    await user.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('displays soil type select with 9 options', () => {
    render(<CreatePlotModal {...defaultProps} />);
    const select = screen.getByLabelText('Tipo de solo');
    const options = within(select).getAllByRole('option');
    // 9 soil types + 1 "Selecione..." placeholder
    expect(options).toHaveLength(10);
  });

  it('displays crop datalist linked to input', () => {
    render(<CreatePlotModal {...defaultProps} />);
    const input = screen.getByLabelText('Cultura atual') as HTMLInputElement;
    expect(input.getAttribute('list')).toBe('create-plot-crop-list');
  });

  it('shows file name when boundary file is selected', () => {
    mockHookState.boundaryFile = new File(['{}'], 'talhao.geojson', {
      type: 'application/geo+json',
    });
    render(<CreatePlotModal {...defaultProps} />);
    expect(screen.getByText('talhao.geojson')).toBeDefined();
  });

  it('calls setFile(null) when remove file button is clicked', async () => {
    mockHookState.boundaryFile = new File(['{}'], 'talhao.geojson', {
      type: 'application/geo+json',
    });
    const user = userEvent.setup();
    render(<CreatePlotModal {...defaultProps} />);

    await user.click(screen.getByLabelText('Remover arquivo'));
    expect(mockSetFile).toHaveBeenCalledWith(null);
  });

  it('shows submit error when present', () => {
    mockHookState.submitError = 'Overlap superior a 5%';
    render(<CreatePlotModal {...defaultProps} />);
    expect(screen.getByText('Overlap superior a 5%')).toBeDefined();
  });

  it('shows registration select when registrations are provided', () => {
    render(<CreatePlotModal {...defaultProps} />);
    expect(screen.getByLabelText('Matrícula vinculada')).toBeDefined();
    expect(screen.getByText('12345 — Cartório Central')).toBeDefined();
  });

  it('hides registration select when no registrations', () => {
    render(<CreatePlotModal {...defaultProps} registrations={[]} />);
    expect(screen.queryByLabelText('Matrícula vinculada')).toBeNull();
  });

  it('disables submit button while submitting', () => {
    mockHookState.isSubmitting = true;
    render(<CreatePlotModal {...defaultProps} />);
    expect(screen.getByText('Criando...')).toBeDefined();
    const btn = screen.getByText('Criando...').closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
