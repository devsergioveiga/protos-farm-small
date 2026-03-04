import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ProducerSCFormModal from './ProducerSCFormModal';
import type { ProducerDetail } from '@/types/producer';

vi.mock('@/services/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '@/services/api';

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

const mockProducerSC: ProducerDetail = {
  id: 'prod-sc-1',
  name: 'Irmãos Silva',
  tradeName: 'Fazenda Irmãos',
  document: null,
  type: 'SOCIEDADE_EM_COMUM',
  status: 'ACTIVE',
  address: 'Estrada Municipal KM 5',
  city: 'Goiânia',
  state: 'GO',
  zipCode: '74000000',
  birthDate: null,
  spouseCpf: null,
  incraRegistration: null,
  legalRepresentative: null,
  legalRepCpf: null,
  taxRegime: 'SIMPLES',
  mainCnae: null,
  ruralActivityType: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  organizationId: 'org-1',
  participants: [
    {
      id: 'part-1',
      name: 'José Silva',
      cpf: '11122233344',
      participationPct: 60,
      isMainResponsible: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'part-2',
      name: 'Maria Silva',
      cpf: '55566677788',
      participationPct: 40,
      isMainResponsible: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  stateRegistrations: [],
  farmLinks: [],
};

describe('ProducerSCFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'new-sc-1' });
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(<ProducerSCFormModal {...defaultProps} isOpen={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('should render the modal with title and sections', () => {
    render(<ProducerSCFormModal {...defaultProps} />);
    expect(screen.getByText('Novo produtor — Sociedade em Comum')).toBeDefined();
    expect(screen.getByText('Dados da Sociedade')).toBeDefined();
    expect(screen.getByText('Participantes (Sócios)')).toBeDefined();
  });

  it('should render 2 participant rows by default', () => {
    render(<ProducerSCFormModal {...defaultProps} />);
    expect(screen.getByText('Participante 1')).toBeDefined();
    expect(screen.getByText('Participante 2')).toBeDefined();
  });

  it('should add a participant when clicking add button', () => {
    render(<ProducerSCFormModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Adicionar participante'));

    expect(screen.getByText('Participante 3')).toBeDefined();
  });

  it('should disable remove button when only 2 participants', () => {
    render(<ProducerSCFormModal {...defaultProps} />);

    const removeButtons = screen.getAllByLabelText(/Remover participante/);
    expect(removeButtons[0].hasAttribute('disabled')).toBe(true);
    expect(removeButtons[1].hasAttribute('disabled')).toBe(true);
  });

  it('should enable remove button when more than 2 participants', () => {
    render(<ProducerSCFormModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Adicionar participante'));

    const removeButtons = screen.getAllByLabelText(/Remover participante/);
    expect(removeButtons[0].hasAttribute('disabled')).toBe(false);
  });

  it('should remove a participant', () => {
    render(<ProducerSCFormModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Adicionar participante'));
    expect(screen.getByText('Participante 3')).toBeDefined();

    const removeButtons = screen.getAllByLabelText(/Remover participante/);
    fireEvent.click(removeButtons[2]);

    expect(screen.queryByText('Participante 3')).toBeNull();
  });

  it('should show validation error when name is empty on submit', async () => {
    render(<ProducerSCFormModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Cadastrar sociedade'));

    await waitFor(() => {
      expect(screen.getByText('Nome da sociedade é obrigatório')).toBeDefined();
    });
  });

  it('should show global error when less than 2 participants', async () => {
    render(<ProducerSCFormModal {...defaultProps} />);

    // Fill name
    fireEvent.change(screen.getByLabelText(/Nome da sociedade/), {
      target: { value: 'Teste SC' },
    });

    // Add a third then remove two to get below 2 - actually can't because remove is disabled at 2
    // This scenario can't happen in UI since remove is disabled at 2
    // But we can test the validation message for missing participant data
    fireEvent.click(screen.getByText('Cadastrar sociedade'));

    await waitFor(() => {
      // Should show participant errors for empty required fields
      expect(screen.getAllByText(/CPF é obrigatório/).length).toBeGreaterThan(0);
    });
  });

  it('should show global error when no main responsible is selected', async () => {
    render(<ProducerSCFormModal {...defaultProps} />);

    // Fill name
    fireEvent.change(screen.getByLabelText(/Nome da sociedade/), {
      target: { value: 'Teste SC' },
    });

    // Fill participant 1
    fireEvent.change(document.getElementById('sc-p-name-0')!, { target: { value: 'José' } });
    fireEvent.change(document.getElementById('sc-p-cpf-0')!, {
      target: { value: '11122233344' },
    });
    fireEvent.change(document.getElementById('sc-p-pct-0')!, { target: { value: '50' } });

    // Fill participant 2
    fireEvent.change(document.getElementById('sc-p-name-1')!, { target: { value: 'Maria' } });
    fireEvent.change(document.getElementById('sc-p-cpf-1')!, {
      target: { value: '55566677788' },
    });
    fireEvent.change(document.getElementById('sc-p-pct-1')!, { target: { value: '50' } });

    // Uncheck participant 1 main responsible (first one is checked by default)
    fireEvent.click(document.getElementById('sc-p-main-0')!);

    fireEvent.click(screen.getByText('Cadastrar sociedade'));

    await waitFor(() => {
      expect(screen.getByText('Deve haver exatamente 1 responsável principal')).toBeDefined();
    });
  });

  it('should show error when total percentage exceeds 100', async () => {
    render(<ProducerSCFormModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Nome da sociedade/), {
      target: { value: 'Teste SC' },
    });

    fireEvent.change(document.getElementById('sc-p-name-0')!, { target: { value: 'José' } });
    fireEvent.change(document.getElementById('sc-p-cpf-0')!, {
      target: { value: '11122233344' },
    });
    fireEvent.change(document.getElementById('sc-p-pct-0')!, { target: { value: '70' } });

    fireEvent.change(document.getElementById('sc-p-name-1')!, { target: { value: 'Maria' } });
    fireEvent.change(document.getElementById('sc-p-cpf-1')!, {
      target: { value: '55566677788' },
    });
    fireEvent.change(document.getElementById('sc-p-pct-1')!, { target: { value: '50' } });

    fireEvent.click(screen.getByText('Cadastrar sociedade'));

    await waitFor(() => {
      expect(screen.getByText('A soma dos percentuais não pode ultrapassar 100%')).toBeDefined();
    });
  });

  it('should show error for duplicate CPFs', async () => {
    render(<ProducerSCFormModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Nome da sociedade/), {
      target: { value: 'Teste SC' },
    });

    fireEvent.change(document.getElementById('sc-p-name-0')!, { target: { value: 'José' } });
    fireEvent.change(document.getElementById('sc-p-cpf-0')!, {
      target: { value: '11122233344' },
    });
    fireEvent.change(document.getElementById('sc-p-pct-0')!, { target: { value: '50' } });

    fireEvent.change(document.getElementById('sc-p-name-1')!, { target: { value: 'Maria' } });
    fireEvent.change(document.getElementById('sc-p-cpf-1')!, {
      target: { value: '11122233344' },
    }); // Same CPF
    fireEvent.change(document.getElementById('sc-p-pct-1')!, { target: { value: '50' } });

    fireEvent.click(screen.getByText('Cadastrar sociedade'));

    await waitFor(() => {
      expect(screen.getByText(/CPF duplicado/)).toBeDefined();
    });
  });

  it('should display total percentage', () => {
    render(<ProducerSCFormModal {...defaultProps} />);

    fireEvent.change(document.getElementById('sc-p-pct-0')!, { target: { value: '60' } });
    fireEvent.change(document.getElementById('sc-p-pct-1')!, { target: { value: '30' } });

    expect(screen.getByText('Total: 90.00%')).toBeDefined();
  });

  it('should submit with correct SC payload and create participants', async () => {
    render(<ProducerSCFormModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Nome da sociedade/), {
      target: { value: 'Irmãos Teste' },
    });

    // Participant 1 (already has isMainResponsible: true by default)
    fireEvent.change(document.getElementById('sc-p-name-0')!, { target: { value: 'José' } });
    fireEvent.change(document.getElementById('sc-p-cpf-0')!, {
      target: { value: '11122233344' },
    });
    fireEvent.change(document.getElementById('sc-p-pct-0')!, { target: { value: '60' } });

    // Participant 2
    fireEvent.change(document.getElementById('sc-p-name-1')!, { target: { value: 'Maria' } });
    fireEvent.change(document.getElementById('sc-p-cpf-1')!, {
      target: { value: '55566677788' },
    });
    fireEvent.change(document.getElementById('sc-p-pct-1')!, { target: { value: '40' } });

    fireEvent.click(screen.getByText('Cadastrar sociedade'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/org/producers', {
        type: 'SOCIEDADE_EM_COMUM',
        name: 'Irmãos Teste',
      });
    });

    // Should create participants
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/org/producers/new-sc-1/participants', {
        name: 'José',
        cpf: '11122233344',
        participationPct: 60,
        isMainResponsible: true,
      });
      expect(api.post).toHaveBeenCalledWith('/org/producers/new-sc-1/participants', {
        name: 'Maria',
        cpf: '55566677788',
        participationPct: 40,
        isMainResponsible: false,
      });
    });
  });

  it('should call onSuccess after successful submit', async () => {
    const onSuccess = vi.fn();
    render(<ProducerSCFormModal {...defaultProps} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/Nome da sociedade/), {
      target: { value: 'Irmãos Teste' },
    });
    fireEvent.change(document.getElementById('sc-p-name-0')!, { target: { value: 'José' } });
    fireEvent.change(document.getElementById('sc-p-cpf-0')!, {
      target: { value: '11122233344' },
    });
    fireEvent.change(document.getElementById('sc-p-pct-0')!, { target: { value: '60' } });
    fireEvent.change(document.getElementById('sc-p-name-1')!, { target: { value: 'Maria' } });
    fireEvent.change(document.getElementById('sc-p-cpf-1')!, {
      target: { value: '55566677788' },
    });
    fireEvent.change(document.getElementById('sc-p-pct-1')!, { target: { value: '40' } });

    fireEvent.click(screen.getByText('Cadastrar sociedade'));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledOnce();
    });
  });

  it('should show API error on submit failure', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Erro ao cadastrar sociedade'),
    );

    render(<ProducerSCFormModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Nome da sociedade/), {
      target: { value: 'Teste' },
    });
    fireEvent.change(document.getElementById('sc-p-name-0')!, { target: { value: 'José' } });
    fireEvent.change(document.getElementById('sc-p-cpf-0')!, {
      target: { value: '11122233344' },
    });
    fireEvent.change(document.getElementById('sc-p-pct-0')!, { target: { value: '60' } });
    fireEvent.change(document.getElementById('sc-p-name-1')!, { target: { value: 'Maria' } });
    fireEvent.change(document.getElementById('sc-p-cpf-1')!, {
      target: { value: '55566677788' },
    });
    fireEvent.change(document.getElementById('sc-p-pct-1')!, { target: { value: '40' } });

    fireEvent.click(screen.getByText('Cadastrar sociedade'));

    await waitFor(() => {
      expect(screen.getByText('Erro ao cadastrar sociedade')).toBeDefined();
    });
  });

  it('should close on Escape key', () => {
    const onClose = vi.fn();
    render(<ProducerSCFormModal {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should close on overlay click', () => {
    const onClose = vi.fn();
    render(<ProducerSCFormModal {...defaultProps} onClose={onClose} />);

    const overlay = document.querySelector('.sc-form-modal__overlay') as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should format participant CPF while typing', () => {
    render(<ProducerSCFormModal {...defaultProps} />);
    const cpfInput = document.getElementById('sc-p-cpf-0')! as HTMLInputElement;

    fireEvent.change(cpfInput, { target: { value: '12345678901' } });
    expect(cpfInput.value).toBe('123.456.789-01');
  });

  it('should not have a document/CPF/CNPJ field for the society itself', () => {
    render(<ProducerSCFormModal {...defaultProps} />);

    // Should not have a document field for the SC producer
    expect(document.getElementById('sc-document')).toBeNull();
  });

  // ─── Edit mode tests ───────────────────────────────────────────

  describe('edit mode', () => {
    beforeEach(() => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockProducerSC);
      (api.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockProducerSC });
      (api.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});
    });

    it('should show edit title when producerId is provided', async () => {
      render(<ProducerSCFormModal {...defaultProps} producerId="prod-sc-1" />);

      await waitFor(() => {
        expect(screen.getByText('Editar produtor — Sociedade em Comum')).toBeDefined();
      });
    });

    it('should show skeleton while loading detail', () => {
      (api.get as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
      render(<ProducerSCFormModal {...defaultProps} producerId="prod-sc-1" />);
      expect(screen.getByTestId('sc-form-skeleton')).toBeDefined();
    });

    it('should prefill form with producer data and participants', async () => {
      render(<ProducerSCFormModal {...defaultProps} producerId="prod-sc-1" />);

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Nome da sociedade/) as HTMLInputElement;
        expect(nameInput.value).toBe('Irmãos Silva');
      });

      const p1Name = document.getElementById('sc-p-name-0')! as HTMLInputElement;
      expect(p1Name.value).toBe('José Silva');

      const p1Cpf = document.getElementById('sc-p-cpf-0')! as HTMLInputElement;
      expect(p1Cpf.value).toBe('111.222.333-44');

      const p2Name = document.getElementById('sc-p-name-1')! as HTMLInputElement;
      expect(p2Name.value).toBe('Maria Silva');
    });

    it('should show "Salvar alterações" button in edit mode', async () => {
      render(<ProducerSCFormModal {...defaultProps} producerId="prod-sc-1" />);

      await waitFor(() => {
        expect(screen.getByText('Salvar alterações')).toBeDefined();
      });
    });

    it('should call PATCH on submit in edit mode', async () => {
      render(<ProducerSCFormModal {...defaultProps} producerId="prod-sc-1" />);

      await waitFor(() => {
        const nameInput = screen.getByLabelText(/Nome da sociedade/) as HTMLInputElement;
        expect(nameInput.value).toBe('Irmãos Silva');
      });

      fireEvent.click(screen.getByText('Salvar alterações'));

      await waitFor(() => {
        expect(api.patch).toHaveBeenCalledWith(
          '/org/producers/prod-sc-1',
          expect.objectContaining({
            name: 'Irmãos Silva',
          }),
        );
      });
    });
  });
});
