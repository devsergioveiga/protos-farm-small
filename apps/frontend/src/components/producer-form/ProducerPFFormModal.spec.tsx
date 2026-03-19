import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ProducerPFFormModal from './ProducerPFFormModal';
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

const mockProducerPF: ProducerDetail = {
  id: 'prod-1',
  name: 'João da Silva',
  tradeName: 'Fazenda São João',
  document: '12345678901',
  type: 'PF',
  status: 'ACTIVE',
  street: 'Rua das Flores',
  addressNumber: '123',
  complement: null,
  neighborhood: 'Centro',
  district: null,
  locationReference: null,
  city: 'Uberlândia',
  state: 'MG',
  zipCode: '38400000',
  birthDate: '1980-05-15T00:00:00.000Z',
  spouseCpf: '98765432100',
  incraRegistration: '123456',
  legalRepresentative: null,
  legalRepCpf: null,
  taxRegime: 'SIMPLES',
  mainCnae: null,
  ruralActivityType: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  organizationId: 'org-1',
  participants: [],
  stateRegistrations: [],
  farmLinks: [],
};

describe('ProducerPFFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'new-1' });
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(<ProducerPFFormModal {...defaultProps} isOpen={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('should render the modal with title and sections', () => {
    render(<ProducerPFFormModal {...defaultProps} />);
    expect(screen.getByText('Novo produtor — Pessoa Física')).toBeDefined();
    expect(screen.getByText('Dados Cadastrais')).toBeDefined();
    expect(screen.getByText('Endereço do Estabelecimento')).toBeDefined();
  });

  it('should show required field indicators on Nome and CPF', () => {
    render(<ProducerPFFormModal {...defaultProps} />);
    const nameLabel = screen.getByLabelText(/Nome do Responsável/);
    expect(nameLabel.getAttribute('aria-required')).toBe('true');
    const cpfLabel = document.getElementById('pf-document')!;
    expect(cpfLabel.getAttribute('aria-required')).toBe('true');
  });

  it('should show validation errors on blur for required fields', () => {
    render(<ProducerPFFormModal {...defaultProps} />);

    fireEvent.blur(screen.getByLabelText(/Nome do Responsável/));
    expect(screen.getByText('Nome é obrigatório')).toBeDefined();

    fireEvent.blur(document.getElementById('pf-document')!);
    expect(screen.getByText('CPF é obrigatório')).toBeDefined();
  });

  it('should format CPF while typing', () => {
    render(<ProducerPFFormModal {...defaultProps} />);
    const cpfInput = document.getElementById('pf-document')! as HTMLInputElement;

    fireEvent.change(cpfInput, { target: { value: '12345678901' } });
    expect(cpfInput.value).toBe('123.456.789-01');
  });

  it('should validate CPF with wrong digit count', () => {
    render(<ProducerPFFormModal {...defaultProps} />);
    const cpfInput = document.getElementById('pf-document')!;

    fireEvent.change(cpfInput, { target: { value: '123456' } });
    fireEvent.blur(cpfInput);

    expect(screen.getByText('CPF deve ter 11 dígitos')).toBeDefined();
  });

  it('should validate CEP format', () => {
    render(<ProducerPFFormModal {...defaultProps} />);
    const cepInput = screen.getByLabelText(/CEP/);

    fireEvent.change(cepInput, { target: { value: '123' } });
    fireEvent.blur(cepInput);

    expect(screen.getByText('CEP inválido (formato: 00000-000)')).toBeDefined();
  });

  it('should render IE-specific fields from document layout', () => {
    render(<ProducerPFFormModal {...defaultProps} />);
    expect(document.getElementById('pf-ie-number')).toBeDefined();
    expect(screen.getByLabelText(/CNAE\/Descrição/)).toBeDefined();
    expect(screen.getByLabelText(/Regime de Apuração/)).toBeDefined();
    expect(screen.getByLabelText(/Categoria/)).toBeDefined();
    expect(screen.getByLabelText(/Data da Inscrição/)).toBeDefined();
    expect(screen.getByLabelText(/Data do Fim do Contrato/)).toBeDefined();
    expect(screen.getByLabelText(/Situação da Inscrição/)).toBeDefined();
    expect(screen.getByLabelText(/Optante pelo Programa de Leite/)).toBeDefined();
  });

  it('should submit with correct payload on valid form', async () => {
    render(<ProducerPFFormModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Nome do Responsável/), {
      target: { value: 'João da Silva' },
    });
    fireEvent.change(document.getElementById('pf-document')!, {
      target: { value: '12345678901' },
    });

    fireEvent.click(screen.getByText('Cadastrar produtor'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/org/producers', {
        type: 'PF',
        name: 'João da Silva',
        document: '12345678901',
      });
    });
  });

  it('should create IE when IE number is provided', async () => {
    render(<ProducerPFFormModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Nome do Responsável/), {
      target: { value: 'João da Silva' },
    });
    fireEvent.change(document.getElementById('pf-document')!, {
      target: { value: '12345678901' },
    });
    fireEvent.change(document.getElementById('pf-ie-number')!, {
      target: { value: '004382845.00-24' },
    });

    fireEvent.click(screen.getByText('Cadastrar produtor'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/org/producers/new-1/ies',
        expect.objectContaining({
          number: '004382845.00-24',
        }),
      );
    });
  });

  it('should call onSuccess after successful submit', async () => {
    const onSuccess = vi.fn();
    render(<ProducerPFFormModal {...defaultProps} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/Nome do Responsável/), {
      target: { value: 'Maria' },
    });
    fireEvent.change(document.getElementById('pf-document')!, {
      target: { value: '11122233344' },
    });

    fireEvent.click(screen.getByText('Cadastrar produtor'));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledOnce();
    });
  });

  it('should not submit when required fields are empty', async () => {
    render(<ProducerPFFormModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Cadastrar produtor'));

    await waitFor(() => {
      expect(api.post).not.toHaveBeenCalled();
    });

    expect(screen.getByText('Nome é obrigatório')).toBeDefined();
    expect(screen.getByText('CPF é obrigatório')).toBeDefined();
  });

  it('should show API error on submit failure', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('CPF já cadastrado nesta organização'),
    );

    render(<ProducerPFFormModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Nome do Responsável/), {
      target: { value: 'Teste' },
    });
    fireEvent.change(document.getElementById('pf-document')!, {
      target: { value: '12345678901' },
    });

    fireEvent.click(screen.getByText('Cadastrar produtor'));

    await waitFor(() => {
      expect(screen.getByText('CPF já cadastrado nesta organização')).toBeDefined();
    });
  });

  it('should close on Escape key', () => {
    const onClose = vi.fn();
    render(<ProducerPFFormModal {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should close on overlay click', () => {
    const onClose = vi.fn();
    render(<ProducerPFFormModal {...defaultProps} onClose={onClose} />);

    const overlay = document.querySelector('.pf-form-modal__overlay') as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should include optional fields in payload when provided', async () => {
    render(<ProducerPFFormModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Nome do Responsável/), {
      target: { value: 'João' },
    });
    fireEvent.change(document.getElementById('pf-document')!, {
      target: { value: '12345678901' },
    });
    fireEvent.change(screen.getByLabelText(/Nome do Estabelecimento/), {
      target: { value: 'Fazenda São João' },
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
        type: 'PF',
        name: 'João',
        document: '12345678901',
        tradeName: 'Fazenda São João',
        city: 'Uberlândia',
        state: 'MG',
      });
    });
  });

  // ─── Edit mode tests ───────────────────────────────────────────

  describe('edit mode', () => {
    beforeEach(() => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockProducerPF);
      (api.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockProducerPF });
    });

    it('should show edit title when producerId is provided', async () => {
      render(<ProducerPFFormModal {...defaultProps} producerId="prod-1" />);

      await waitFor(() => {
        expect(screen.getByText('Editar produtor — Pessoa Física')).toBeDefined();
      });
    });

    it('should show skeleton while loading detail', () => {
      (api.get as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
      render(<ProducerPFFormModal {...defaultProps} producerId="prod-1" />);
      expect(screen.getByTestId('pf-form-skeleton')).toBeDefined();
    });

    it('should prefill form with producer data', async () => {
      render(<ProducerPFFormModal {...defaultProps} producerId="prod-1" />);

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Nome do Responsável/) as HTMLInputElement;
        expect(nameInput.value).toBe('João da Silva');
      });

      const cpfInput = document.getElementById('pf-document')! as HTMLInputElement;
      expect(cpfInput.value).toBe('123.456.789-01');

      const tradeNameInput = screen.getByLabelText(/Nome do Estabelecimento/) as HTMLInputElement;
      expect(tradeNameInput.value).toBe('Fazenda São João');

      const cityInput = screen.getByLabelText(/Município/) as HTMLInputElement;
      expect(cityInput.value).toBe('Uberlândia');
    });

    it('should show "Salvar alterações" button in edit mode', async () => {
      render(<ProducerPFFormModal {...defaultProps} producerId="prod-1" />);

      await waitFor(() => {
        expect(screen.getByText('Salvar alterações')).toBeDefined();
      });
    });

    it('should call PATCH on submit in edit mode', async () => {
      render(<ProducerPFFormModal {...defaultProps} producerId="prod-1" />);

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Nome do Responsável/) as HTMLInputElement;
        expect(nameInput.value).toBe('João da Silva');
      });

      fireEvent.click(screen.getByText('Salvar alterações'));

      await waitFor(() => {
        expect(api.patch).toHaveBeenCalledWith(
          '/org/producers/prod-1',
          expect.objectContaining({
            name: 'João da Silva',
            document: '12345678901',
          }),
        );
      });
    });

    it('should call onSuccess after successful edit', async () => {
      const onSuccess = vi.fn();
      render(<ProducerPFFormModal {...defaultProps} onSuccess={onSuccess} producerId="prod-1" />);

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Nome do Responsável/) as HTMLInputElement;
        expect(nameInput.value).toBe('João da Silva');
      });

      fireEvent.click(screen.getByText('Salvar alterações'));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledOnce();
      });
    });
  });
});
