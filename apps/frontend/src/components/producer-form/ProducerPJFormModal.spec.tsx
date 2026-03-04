import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ProducerPJFormModal from './ProducerPJFormModal';
import type { ProducerDetail } from '@/types/producer';

vi.mock('@/services/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

import { api } from '@/services/api';

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

const mockProducerPJ: ProducerDetail = {
  id: 'prod-pj-1',
  name: 'Agropecuária Silva LTDA',
  tradeName: 'Agro Silva',
  document: '12345678000199',
  type: 'PJ',
  status: 'ACTIVE',
  address: 'Rod BR-153 KM 10',
  city: 'Uberlândia',
  state: 'MG',
  zipCode: '38400000',
  birthDate: null,
  spouseCpf: null,
  incraRegistration: null,
  legalRepresentative: 'Carlos Silva',
  legalRepCpf: '11122233344',
  taxRegime: 'REAL',
  mainCnae: '0111-3/01',
  ruralActivityType: 'Cultivo de cereais',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  organizationId: 'org-1',
  participants: [],
  stateRegistrations: [],
  farmLinks: [],
};

describe('ProducerPJFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'new-pj-1' });
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(<ProducerPJFormModal {...defaultProps} isOpen={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('should render the modal with title and sections', () => {
    render(<ProducerPJFormModal {...defaultProps} />);
    expect(screen.getByText('Novo produtor — Pessoa Jurídica')).toBeDefined();
    expect(screen.getByText('Dados da Empresa')).toBeDefined();
    expect(screen.getByText('Endereço Fiscal')).toBeDefined();
    expect(screen.getByText('Informações Adicionais')).toBeDefined();
  });

  it('should show required field indicators on Razão social and CNPJ', () => {
    render(<ProducerPJFormModal {...defaultProps} />);
    const nameInput = screen.getByLabelText(/Razão social/);
    expect(nameInput.getAttribute('aria-required')).toBe('true');
    const cnpjInput = document.getElementById('pj-document')!;
    expect(cnpjInput.getAttribute('aria-required')).toBe('true');
  });

  it('should show validation errors on blur for required fields', () => {
    render(<ProducerPJFormModal {...defaultProps} />);

    fireEvent.blur(screen.getByLabelText(/Razão social/));
    expect(screen.getByText('Razão social é obrigatória')).toBeDefined();

    fireEvent.blur(document.getElementById('pj-document')!);
    expect(screen.getByText('CNPJ é obrigatório')).toBeDefined();
  });

  it('should format CNPJ while typing', () => {
    render(<ProducerPJFormModal {...defaultProps} />);
    const cnpjInput = document.getElementById('pj-document')! as HTMLInputElement;

    fireEvent.change(cnpjInput, { target: { value: '12345678000195' } });
    expect(cnpjInput.value).toBe('12.345.678/0001-95');
  });

  it('should validate CNPJ with wrong digit count', () => {
    render(<ProducerPJFormModal {...defaultProps} />);
    const cnpjInput = document.getElementById('pj-document')!;

    fireEvent.change(cnpjInput, { target: { value: '123456' } });
    fireEvent.blur(cnpjInput);

    expect(screen.getByText('CNPJ deve ter 14 dígitos')).toBeDefined();
  });

  it('should format legal rep CPF while typing', () => {
    render(<ProducerPJFormModal {...defaultProps} />);
    const cpfInput = screen.getByLabelText(/CPF do representante/) as HTMLInputElement;

    fireEvent.change(cpfInput, { target: { value: '12345678901' } });
    expect(cpfInput.value).toBe('123.456.789-01');
  });

  it('should validate optional legal rep CPF if partially filled', () => {
    render(<ProducerPJFormModal {...defaultProps} />);
    const cpfInput = screen.getByLabelText(/CPF do representante/);

    fireEvent.change(cpfInput, { target: { value: '123' } });
    fireEvent.blur(cpfInput);

    expect(screen.getByText('CPF do representante deve ter 11 dígitos')).toBeDefined();
  });

  it('should validate CEP format', () => {
    render(<ProducerPJFormModal {...defaultProps} />);
    const cepInput = screen.getByLabelText(/CEP/);

    fireEvent.change(cepInput, { target: { value: '123' } });
    fireEvent.blur(cepInput);

    expect(screen.getByText('CEP inválido (formato: 00000-000)')).toBeDefined();
  });

  it('should submit with correct PJ payload on valid form', async () => {
    render(<ProducerPJFormModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Razão social/), {
      target: { value: 'Agropecuária São João Ltda' },
    });
    fireEvent.change(document.getElementById('pj-document')!, {
      target: { value: '12345678000195' },
    });

    fireEvent.click(screen.getByText('Cadastrar produtor'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/org/producers', {
        type: 'PJ',
        name: 'Agropecuária São João Ltda',
        document: '12345678000195',
      });
    });
  });

  it('should call onSuccess after successful submit', async () => {
    const onSuccess = vi.fn();
    render(<ProducerPJFormModal {...defaultProps} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/Razão social/), {
      target: { value: 'Empresa Rural' },
    });
    fireEvent.change(document.getElementById('pj-document')!, {
      target: { value: '11222333000181' },
    });

    fireEvent.click(screen.getByText('Cadastrar produtor'));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledOnce();
    });
  });

  it('should not submit when required fields are empty', async () => {
    render(<ProducerPJFormModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Cadastrar produtor'));

    await waitFor(() => {
      expect(api.post).not.toHaveBeenCalled();
    });

    expect(screen.getByText('Razão social é obrigatória')).toBeDefined();
    expect(screen.getByText('CNPJ é obrigatório')).toBeDefined();
  });

  it('should show API error on submit failure', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('CNPJ já cadastrado nesta organização'),
    );

    render(<ProducerPJFormModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Razão social/), {
      target: { value: 'Teste' },
    });
    fireEvent.change(document.getElementById('pj-document')!, {
      target: { value: '12345678000195' },
    });

    fireEvent.click(screen.getByText('Cadastrar produtor'));

    await waitFor(() => {
      expect(screen.getByText('CNPJ já cadastrado nesta organização')).toBeDefined();
    });
  });

  it('should close on Escape key', () => {
    const onClose = vi.fn();
    render(<ProducerPJFormModal {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should close on overlay click', () => {
    const onClose = vi.fn();
    render(<ProducerPJFormModal {...defaultProps} onClose={onClose} />);

    const overlay = document.querySelector('.pj-form-modal__overlay') as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should include PJ-specific optional fields in payload when provided', async () => {
    render(<ProducerPJFormModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Razão social/), {
      target: { value: 'Agro Ltda' },
    });
    fireEvent.change(document.getElementById('pj-document')!, {
      target: { value: '12345678000195' },
    });
    fireEvent.change(screen.getByLabelText(/Nome fantasia/), {
      target: { value: 'Fazenda Agro' },
    });
    fireEvent.change(screen.getByLabelText(/CNAE principal/), {
      target: { value: '0115-6/00' },
    });
    fireEvent.change(screen.getByLabelText(/Tipo de atividade rural/), {
      target: { value: 'Agricultura' },
    });
    fireEvent.change(screen.getByLabelText(/Município/), {
      target: { value: 'Uberlândia' },
    });
    fireEvent.change(screen.getByLabelText(/UF/), {
      target: { value: 'MG' },
    });

    fireEvent.click(screen.getByText('Cadastrar produtor'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/org/producers', {
        type: 'PJ',
        name: 'Agro Ltda',
        document: '12345678000195',
        tradeName: 'Fazenda Agro',
        mainCnae: '0115-6/00',
        ruralActivityType: 'Agricultura',
        city: 'Uberlândia',
        state: 'MG',
      });
    });
  });

  it('should render PJ-specific fields (CNAE, atividade rural) and not PF-specific fields (birthDate, spouseCpf)', () => {
    render(<ProducerPJFormModal {...defaultProps} />);

    expect(screen.getByLabelText(/CNAE principal/)).toBeDefined();
    expect(screen.getByLabelText(/Tipo de atividade rural/)).toBeDefined();

    expect(screen.queryByLabelText(/Data de nascimento/)).toBeNull();
    expect(screen.queryByLabelText(/CPF do cônjuge/)).toBeNull();
  });

  // ─── Edit mode tests ───────────────────────────────────────────

  describe('edit mode', () => {
    beforeEach(() => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockProducerPJ);
      (api.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockProducerPJ });
    });

    it('should show edit title when producerId is provided', async () => {
      render(<ProducerPJFormModal {...defaultProps} producerId="prod-pj-1" />);

      await waitFor(() => {
        expect(screen.getByText('Editar produtor — Pessoa Jurídica')).toBeDefined();
      });
    });

    it('should show skeleton while loading detail', () => {
      (api.get as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
      render(<ProducerPJFormModal {...defaultProps} producerId="prod-pj-1" />);
      expect(screen.getByTestId('pj-form-skeleton')).toBeDefined();
    });

    it('should prefill form with producer data', async () => {
      render(<ProducerPJFormModal {...defaultProps} producerId="prod-pj-1" />);

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Razão social/) as HTMLInputElement;
        expect(nameInput.value).toBe('Agropecuária Silva LTDA');
      });

      const cnpjInput = document.getElementById('pj-document')! as HTMLInputElement;
      expect(cnpjInput.value).toBe('12.345.678/0001-99');

      const tradeNameInput = screen.getByLabelText(/Nome fantasia/) as HTMLInputElement;
      expect(tradeNameInput.value).toBe('Agro Silva');

      const cnaeInput = screen.getByLabelText(/CNAE principal/) as HTMLInputElement;
      expect(cnaeInput.value).toBe('0111-3/01');
    });

    it('should show "Salvar alterações" button in edit mode', async () => {
      render(<ProducerPJFormModal {...defaultProps} producerId="prod-pj-1" />);

      await waitFor(() => {
        expect(screen.getByText('Salvar alterações')).toBeDefined();
      });
    });

    it('should call PATCH on submit in edit mode', async () => {
      render(<ProducerPJFormModal {...defaultProps} producerId="prod-pj-1" />);

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Razão social/) as HTMLInputElement;
        expect(nameInput.value).toBe('Agropecuária Silva LTDA');
      });

      fireEvent.click(screen.getByText('Salvar alterações'));

      await waitFor(() => {
        expect(api.patch).toHaveBeenCalledWith(
          '/org/producers/prod-pj-1',
          expect.objectContaining({
            name: 'Agropecuária Silva LTDA',
            document: '12345678000199',
          }),
        );
      });
    });

    it('should call onSuccess after successful edit', async () => {
      const onSuccess = vi.fn();
      render(
        <ProducerPJFormModal {...defaultProps} onSuccess={onSuccess} producerId="prod-pj-1" />,
      );

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Razão social/) as HTMLInputElement;
        expect(nameInput.value).toBe('Agropecuária Silva LTDA');
      });

      fireEvent.click(screen.getByText('Salvar alterações'));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledOnce();
      });
    });
  });
});
