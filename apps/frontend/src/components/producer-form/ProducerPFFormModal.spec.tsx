import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ProducerPFFormModal from './ProducerPFFormModal';

vi.mock('@/services/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

import { api } from '@/services/api';

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
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
    expect(screen.getByText('Dados Pessoais')).toBeDefined();
    expect(screen.getByText('Endereço Fiscal')).toBeDefined();
    expect(screen.getByText('Informações Adicionais')).toBeDefined();
  });

  it('should show required field indicators on Nome and CPF', () => {
    render(<ProducerPFFormModal {...defaultProps} />);
    const nameLabel = screen.getByLabelText(/Nome completo/);
    expect(nameLabel.getAttribute('aria-required')).toBe('true');
    const cpfLabel = document.getElementById('pf-document')!;
    expect(cpfLabel.getAttribute('aria-required')).toBe('true');
  });

  it('should show validation errors on blur for required fields', () => {
    render(<ProducerPFFormModal {...defaultProps} />);

    fireEvent.blur(screen.getByLabelText(/Nome completo/));
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

  it('should format spouse CPF while typing', () => {
    render(<ProducerPFFormModal {...defaultProps} />);
    const spouseInput = screen.getByLabelText(/CPF do cônjuge/) as HTMLInputElement;

    fireEvent.change(spouseInput, { target: { value: '98765432100' } });
    expect(spouseInput.value).toBe('987.654.321-00');
  });

  it('should validate CPF with wrong digit count', () => {
    render(<ProducerPFFormModal {...defaultProps} />);
    const cpfInput = document.getElementById('pf-document')!;

    fireEvent.change(cpfInput, { target: { value: '123456' } });
    fireEvent.blur(cpfInput);

    expect(screen.getByText('CPF deve ter 11 dígitos')).toBeDefined();
  });

  it('should validate optional spouse CPF if partially filled', () => {
    render(<ProducerPFFormModal {...defaultProps} />);
    const spouseInput = screen.getByLabelText(/CPF do cônjuge/);

    fireEvent.change(spouseInput, { target: { value: '123' } });
    fireEvent.blur(spouseInput);

    expect(screen.getByText('CPF do cônjuge deve ter 11 dígitos')).toBeDefined();
  });

  it('should validate CEP format', () => {
    render(<ProducerPFFormModal {...defaultProps} />);
    const cepInput = screen.getByLabelText(/CEP/);

    fireEvent.change(cepInput, { target: { value: '123' } });
    fireEvent.blur(cepInput);

    expect(screen.getByText('CEP inválido (formato: 00000-000)')).toBeDefined();
  });

  it('should submit with correct payload on valid form', async () => {
    render(<ProducerPFFormModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Nome completo/), {
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

  it('should call onSuccess after successful submit', async () => {
    const onSuccess = vi.fn();
    render(<ProducerPFFormModal {...defaultProps} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/Nome completo/), {
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

    fireEvent.change(screen.getByLabelText(/Nome completo/), {
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

    fireEvent.change(screen.getByLabelText(/Nome completo/), {
      target: { value: 'João' },
    });
    fireEvent.change(document.getElementById('pf-document')!, {
      target: { value: '12345678901' },
    });
    fireEvent.change(screen.getByLabelText(/Nome fantasia/), {
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
});
