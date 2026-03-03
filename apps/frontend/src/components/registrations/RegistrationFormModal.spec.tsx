import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RegistrationFormModal from './RegistrationFormModal';
import type { FarmRegistration } from '@/types/farm';

const REG: FarmRegistration = {
  id: 'reg-1',
  farmId: 'farm-1',
  number: '12345',
  cnsCode: 'CNS-001',
  cartorioName: '1º Ofício de Uberlândia',
  comarca: 'Uberlândia',
  state: 'MG',
  livro: 'L-10',
  registrationDate: '2025-06-15T00:00:00Z',
  areaHa: 75.5,
  boundaryAreaHa: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSubmit: vi.fn().mockResolvedValue(undefined),
  isSubmitting: false,
  submitError: null as string | null,
};

describe('RegistrationFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(<RegistrationFormModal {...defaultProps} isOpen={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('should render with "Nova matrícula" title when creating', () => {
    render(<RegistrationFormModal {...defaultProps} />);
    expect(screen.getByText('Nova matrícula')).toBeDefined();
  });

  it('should render with "Editar matrícula" title when editing', () => {
    render(<RegistrationFormModal {...defaultProps} registration={REG} />);
    expect(screen.getByText('Editar matrícula')).toBeDefined();
  });

  it('should pre-fill fields when editing', () => {
    render(<RegistrationFormModal {...defaultProps} registration={REG} />);

    expect((screen.getByLabelText(/Número da matrícula/) as HTMLInputElement).value).toBe('12345');
    expect((screen.getByLabelText(/Cartório/) as HTMLInputElement).value).toBe(
      '1º Ofício de Uberlândia',
    );
    expect((screen.getByLabelText(/Comarca/) as HTMLInputElement).value).toBe('Uberlândia');
    expect((screen.getByLabelText(/UF/) as HTMLSelectElement).value).toBe('MG');
    expect((screen.getByLabelText(/Área/) as HTMLInputElement).value).toBe('75.5');
    expect((screen.getByLabelText(/Código CNS/) as HTMLInputElement).value).toBe('CNS-001');
    expect((screen.getByLabelText(/Livro/) as HTMLInputElement).value).toBe('L-10');
  });

  it('should show validation errors on blur for required fields', () => {
    render(<RegistrationFormModal {...defaultProps} />);

    fireEvent.blur(screen.getByLabelText(/Número da matrícula/));
    expect(screen.getByText('Número da matrícula é obrigatório')).toBeDefined();

    fireEvent.blur(screen.getByLabelText(/Cartório/));
    expect(screen.getByText('Nome do cartório é obrigatório')).toBeDefined();

    fireEvent.blur(screen.getByLabelText(/Comarca/));
    expect(screen.getByText('Comarca é obrigatória')).toBeDefined();
  });

  it('should show validation error for area <= 0', () => {
    render(<RegistrationFormModal {...defaultProps} />);

    const areaInput = screen.getByLabelText(/Área/);
    fireEvent.change(areaInput, { target: { value: '0' } });
    fireEvent.blur(areaInput);

    expect(screen.getByText('Área deve ser maior que zero')).toBeDefined();
  });

  it('should call onSubmit with correct payload on submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RegistrationFormModal {...defaultProps} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/Número da matrícula/), {
      target: { value: '99999' },
    });
    fireEvent.change(screen.getByLabelText(/Cartório/), {
      target: { value: 'Cartório Central' },
    });
    fireEvent.change(screen.getByLabelText(/Comarca/), {
      target: { value: 'São Paulo' },
    });
    fireEvent.change(screen.getByLabelText(/UF/), {
      target: { value: 'SP' },
    });
    fireEvent.change(screen.getByLabelText(/Área/), {
      target: { value: '100' },
    });

    fireEvent.click(screen.getByText('Adicionar matrícula'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        number: '99999',
        cartorioName: 'Cartório Central',
        comarca: 'São Paulo',
        state: 'SP',
        areaHa: 100,
      });
    });
  });

  it('should not submit when required fields are empty', async () => {
    const onSubmit = vi.fn();
    render(<RegistrationFormModal {...defaultProps} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByText('Adicionar matrícula'));

    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });

    expect(screen.getByText('Número da matrícula é obrigatório')).toBeDefined();
  });

  it('should call onClose when cancel is clicked', () => {
    const onClose = vi.fn();
    render(<RegistrationFormModal {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByText('Cancelar'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should call onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<RegistrationFormModal {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should show submit error when provided', () => {
    render(
      <RegistrationFormModal {...defaultProps} submitError="Não foi possível salvar a matrícula" />,
    );

    expect(screen.getByText('Não foi possível salvar a matrícula')).toBeDefined();
  });

  it('should show loading state when submitting', () => {
    render(<RegistrationFormModal {...defaultProps} isSubmitting={true} />);

    expect(screen.getByText('Adicionando...')).toBeDefined();
  });

  it('should show "Salvando..." when editing and submitting', () => {
    render(<RegistrationFormModal {...defaultProps} registration={REG} isSubmitting={true} />);

    expect(screen.getByText('Salvando...')).toBeDefined();
  });

  it('should include optional fields in payload when provided', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RegistrationFormModal {...defaultProps} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/Número da matrícula/), {
      target: { value: '11111' },
    });
    fireEvent.change(screen.getByLabelText(/Cartório/), {
      target: { value: 'Cart' },
    });
    fireEvent.change(screen.getByLabelText(/Comarca/), {
      target: { value: 'Com' },
    });
    fireEvent.change(screen.getByLabelText(/UF/), { target: { value: 'GO' } });
    fireEvent.change(screen.getByLabelText(/Área/), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText(/Código CNS/), {
      target: { value: 'CNS-X' },
    });
    fireEvent.change(screen.getByLabelText(/Livro/), { target: { value: 'L-5' } });
    fireEvent.change(screen.getByLabelText(/Data de registro/), {
      target: { value: '2025-01-01' },
    });

    fireEvent.click(screen.getByText('Adicionar matrícula'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        number: '11111',
        cartorioName: 'Cart',
        comarca: 'Com',
        state: 'GO',
        areaHa: 50,
        cnsCode: 'CNS-X',
        livro: 'L-5',
        registrationDate: '2025-01-01',
      });
    });
  });
});
