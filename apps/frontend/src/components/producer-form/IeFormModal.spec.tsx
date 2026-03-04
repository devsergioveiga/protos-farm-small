import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import IeFormModal from './IeFormModal';
import type { ProducerStateRegistration } from '@/types/producer';

vi.mock('@/services/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/components/auth/PermissionGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { api } from '@/services/api';

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
  producerId: 'prod-1',
};

const existingIe: ProducerStateRegistration = {
  id: 'ie-1',
  number: '123456789',
  state: 'MG',
  cnaeActivity: '0111-3/01',
  assessmentRegime: 'Normal',
  category: 'PRIMEIRO_ESTABELECIMENTO',
  inscriptionDate: '2020-03-10T00:00:00.000Z',
  situation: 'ACTIVE',
  contractEndDate: '2030-12-31T00:00:00.000Z',
  milkProgramOptIn: true,
  isDefaultForFarm: false,
  farmId: 'farm-1',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('IeFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'new-ie-1' });
    (api.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'ie-1' });
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(<IeFormModal {...defaultProps} isOpen={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('should render the modal with create title and form fields', () => {
    render(<IeFormModal {...defaultProps} />);
    expect(screen.getByText('Nova inscricao estadual')).toBeDefined();
    expect(screen.getByLabelText(/Numero IE/)).toBeDefined();
    expect(screen.getByLabelText(/^UF/)).toBeDefined();
    expect(screen.getByLabelText(/Situacao/)).toBeDefined();
    expect(screen.getByLabelText(/Categoria/)).toBeDefined();
    expect(screen.getByLabelText(/Data de inscricao/)).toBeDefined();
    expect(screen.getByLabelText(/Termino de contrato/)).toBeDefined();
    expect(screen.getByLabelText(/CNAE/)).toBeDefined();
    expect(screen.getByLabelText(/Regime de apuracao/)).toBeDefined();
    expect(screen.getByLabelText(/Programa do Leite/)).toBeDefined();
  });

  it('should show UF options', () => {
    render(<IeFormModal {...defaultProps} />);
    const ufSelect = screen.getByLabelText(/^UF/) as HTMLSelectElement;
    // placeholder + 27 UFs
    expect(ufSelect.options.length).toBe(28);
  });

  it('should show validation errors on blur for required fields', () => {
    render(<IeFormModal {...defaultProps} />);

    fireEvent.blur(screen.getByLabelText(/Numero IE/));
    expect(screen.getByText('Numero da IE e obrigatorio')).toBeDefined();

    fireEvent.blur(screen.getByLabelText(/^UF/));
    expect(screen.getByText('UF e obrigatoria')).toBeDefined();
  });

  it('should validate IE number length', () => {
    render(<IeFormModal {...defaultProps} />);

    const numberInput = screen.getByLabelText(/Numero IE/);
    fireEvent.change(numberInput, { target: { value: '1234' } });
    fireEvent.blur(numberInput);

    expect(screen.getByText('IE deve ter entre 8 e 14 digitos')).toBeDefined();
  });

  it('should submit create payload correctly', async () => {
    render(<IeFormModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Numero IE/), { target: { value: '12345678' } });
    fireEvent.change(screen.getByLabelText(/^UF/), { target: { value: 'SP' } });
    fireEvent.change(screen.getByLabelText(/Situacao/), { target: { value: 'ACTIVE' } });
    fireEvent.click(screen.getByLabelText(/Programa do Leite/));

    fireEvent.click(screen.getByText('Cadastrar'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/org/producers/prod-1/ies', {
        number: '12345678',
        state: 'SP',
        situation: 'ACTIVE',
        milkProgramOptIn: true,
      });
    });

    expect(defaultProps.onSuccess).toHaveBeenCalled();
  });

  it('should prefill fields in edit mode', () => {
    render(<IeFormModal {...defaultProps} existingIe={existingIe} />);

    expect(screen.getByText('Editar inscricao estadual')).toBeDefined();

    const numberInput = screen.getByLabelText(/Numero IE/) as HTMLInputElement;
    expect(numberInput.value).toBe('123456789');

    const ufSelect = screen.getByLabelText(/^UF/) as HTMLSelectElement;
    expect(ufSelect.value).toBe('MG');

    const milkCheckbox = screen.getByLabelText(/Programa do Leite/) as HTMLInputElement;
    expect(milkCheckbox.checked).toBe(true);
  });

  it('should submit edit payload correctly', async () => {
    render(<IeFormModal {...defaultProps} existingIe={existingIe} />);

    fireEvent.change(screen.getByLabelText(/^UF/), { target: { value: 'SP' } });

    fireEvent.click(screen.getByText('Salvar alteracoes'));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith(
        '/org/producers/prod-1/ies/ie-1',
        expect.objectContaining({
          number: '123456789',
          state: 'SP',
        }),
      );
    });

    expect(defaultProps.onSuccess).toHaveBeenCalled();
  });

  it('should close on Escape key', () => {
    render(<IeFormModal {...defaultProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should close on overlay click', () => {
    render(<IeFormModal {...defaultProps} />);
    const overlay = document.querySelector('.ie-modal__overlay');
    if (overlay) fireEvent.click(overlay);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should show submit error on API failure', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Erro de rede'));

    render(<IeFormModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Numero IE/), { target: { value: '12345678' } });
    fireEvent.change(screen.getByLabelText(/^UF/), { target: { value: 'SP' } });

    fireEvent.click(screen.getByText('Cadastrar'));

    await waitFor(() => {
      expect(screen.getByText('Erro de rede')).toBeDefined();
    });
  });

  it('should not submit with validation errors', async () => {
    render(<IeFormModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Cadastrar'));

    await waitFor(() => {
      expect(screen.getByText('Numero da IE e obrigatorio')).toBeDefined();
      expect(screen.getByText('UF e obrigatoria')).toBeDefined();
    });

    expect(api.post).not.toHaveBeenCalled();
  });
});
