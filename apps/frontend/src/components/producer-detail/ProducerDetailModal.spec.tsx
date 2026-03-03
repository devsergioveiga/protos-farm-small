import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ProducerDetailModal from './ProducerDetailModal';
import type { ProducerDetail } from '@/types/producer';

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/hooks/useFarms', () => ({
  useFarms: () => ({
    farms: [{ id: 'farm-1', name: 'Fazenda Santa Helena', state: 'MG', nickname: null }],
    meta: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({
    permissions: ['producers:update'],
    isLoading: false,
    hasPermission: (p: string) => p === 'producers:update',
    hasAnyPermission: () => true,
    refetch: vi.fn(),
  }),
}));

import { api } from '@/services/api';

const mockProducerPF: ProducerDetail = {
  id: 'prod-1',
  name: 'João da Silva',
  tradeName: 'Fazenda São João',
  document: '12345678901',
  type: 'PF',
  status: 'ACTIVE',
  address: 'Rua das Flores, 123',
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
  stateRegistrations: [
    {
      id: 'ie-1',
      number: '123456789',
      state: 'MG',
      cnaeActivity: null,
      assessmentRegime: null,
      category: 'PRODUTOR',
      inscriptionDate: '2020-03-10T00:00:00.000Z',
      situation: 'ACTIVE',
      contractEndDate: null,
      milkProgramOptIn: null,
      isDefaultForFarm: true,
      farmId: 'farm-1',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  farmLinks: [
    {
      id: 'link-1',
      bondType: 'PROPRIETARIO',
      participationPct: 100,
      startDate: '2020-01-01T00:00:00.000Z',
      endDate: null,
      isItrDeclarant: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      farm: { id: 'farm-1', name: 'Fazenda Santa Helena', nickname: null, state: 'MG' },
    },
  ],
};

const mockProducerPJ: ProducerDetail = {
  ...mockProducerPF,
  id: 'prod-2',
  name: 'Agropecuária Silva LTDA',
  document: '12345678000199',
  type: 'PJ',
  mainCnae: '0111-3/01',
  ruralActivityType: 'Cultivo de cereais',
  birthDate: null,
  spouseCpf: null,
};

const mockProducerSC: ProducerDetail = {
  ...mockProducerPF,
  id: 'prod-3',
  name: 'Sociedade Rural Silva & Cia',
  document: null,
  type: 'SOCIEDADE_EM_COMUM',
  birthDate: null,
  spouseCpf: null,
  participants: [
    {
      id: 'part-1',
      name: 'Carlos Silva',
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
};

const defaultProps = {
  producerId: 'prod-1',
  onClose: vi.fn(),
  onStatusChange: vi.fn(),
};

describe('ProducerDetailModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockProducerPF);
    (api.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockProducerPF,
      status: 'INACTIVE',
    });
  });

  it('should not render when producerId is null', () => {
    const { container } = render(<ProducerDetailModal {...defaultProps} producerId={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('should show skeleton while loading', () => {
    (api.get as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
    render(<ProducerDetailModal {...defaultProps} />);
    expect(screen.getByTestId('producer-detail-skeleton')).toBeDefined();
  });

  it('should render PF producer details', async () => {
    render(<ProducerDetailModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Dados Gerais')).toBeDefined();
    });

    expect(screen.getAllByText('João da Silva').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Pessoa Física')).toBeDefined();
    expect(screen.getByText('Ativo')).toBeDefined();
    expect(screen.getByText('Inscrições Estaduais')).toBeDefined();
    expect(screen.getByText('Vínculos com Fazendas')).toBeDefined();
    expect(screen.getByText('123.456.789-01')).toBeDefined();
    expect(screen.getByText('Fazenda São João')).toBeDefined();
    expect(screen.getByText('Simples Nacional')).toBeDefined();
  });

  it('should render PJ producer with CNAE and activity type', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockProducerPJ);
    render(<ProducerDetailModal {...defaultProps} producerId="prod-2" />);

    await waitFor(() => {
      expect(screen.getByText('Dados Gerais')).toBeDefined();
    });

    expect(screen.getAllByText('Agropecuária Silva LTDA').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Pessoa Jurídica')).toBeDefined();
    expect(screen.getByText('0111-3/01')).toBeDefined();
    expect(screen.getByText('Cultivo de cereais')).toBeDefined();
  });

  it('should render SC producer with participants section', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockProducerSC);
    render(<ProducerDetailModal {...defaultProps} producerId="prod-3" />);

    await waitFor(() => {
      expect(screen.getByText('Dados Gerais')).toBeDefined();
    });

    expect(screen.getAllByText('Sociedade Rural Silva & Cia').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Participantes')).toBeDefined();
    expect(screen.getByText('Carlos Silva')).toBeDefined();
    expect(screen.getByText('Responsável')).toBeDefined();
    expect(screen.getByText('60%')).toBeDefined();
    expect(screen.getByText('Maria Silva')).toBeDefined();
    expect(screen.getByText('40%')).toBeDefined();
  });

  it('should render IE cards', async () => {
    render(<ProducerDetailModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('IE 123456789 — MG')).toBeDefined();
    });

    expect(screen.getByText('Ativa')).toBeDefined();
    expect(screen.getByText('PRODUTOR')).toBeDefined();
  });

  it('should render farm link cards', async () => {
    render(<ProducerDetailModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Fazenda Santa Helena — MG')).toBeDefined();
    });

    expect(screen.getByText('Proprietário')).toBeDefined();
    expect(screen.getByText('100%')).toBeDefined();
    expect(screen.getByText('Declarante')).toBeDefined();
  });

  it('should show empty states when no IEs or farm links', async () => {
    const emptyProducer = { ...mockProducerPF, stateRegistrations: [], farmLinks: [] };
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(emptyProducer);
    render(<ProducerDetailModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma inscrição estadual cadastrada')).toBeDefined();
    });

    expect(screen.getByText('Nenhum vínculo com fazenda cadastrado')).toBeDefined();
  });

  it('should show Desativar button for ACTIVE producer', async () => {
    render(<ProducerDetailModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Desativar')).toBeDefined();
    });
  });

  it('should show Ativar button for INACTIVE producer', async () => {
    const inactive = { ...mockProducerPF, status: 'INACTIVE' as const };
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(inactive);
    render(<ProducerDetailModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Ativar')).toBeDefined();
    });
  });

  it('should call API to toggle status on button click', async () => {
    render(<ProducerDetailModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Desativar')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Desativar'));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/org/producers/prod-1/status', {
        status: 'INACTIVE',
      });
    });

    expect(defaultProps.onStatusChange).toHaveBeenCalled();
  });

  it('should close on Escape key', async () => {
    const onClose = vi.fn();
    render(<ProducerDetailModal {...defaultProps} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Dados Gerais')).toBeDefined();
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should close on overlay click', async () => {
    const onClose = vi.fn();
    render(<ProducerDetailModal {...defaultProps} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Dados Gerais')).toBeDefined();
    });

    const overlay = document.querySelector('.producer-detail__overlay') as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should close on Fechar button click', async () => {
    const onClose = vi.fn();
    render(<ProducerDetailModal {...defaultProps} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Dados Gerais')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Fechar'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should show error message on API failure', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Erro ao carregar produtor'));
    render(<ProducerDetailModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Erro ao carregar produtor')).toBeDefined();
    });
  });

  it('should have accessible dialog attributes', async () => {
    render(<ProducerDetailModal {...defaultProps} />);

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeDefined();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('producer-detail-title');
  });

  // ─── Edit button tests ─────────────────────────────────────────

  it('should show Editar button for PF producer when onEdit is provided', async () => {
    const onEdit = vi.fn();
    render(<ProducerDetailModal {...defaultProps} onEdit={onEdit} />);

    await waitFor(() => {
      expect(screen.getByText('Editar')).toBeDefined();
    });
  });

  it('should show Editar button for PJ producer when onEdit is provided', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockProducerPJ);
    const onEdit = vi.fn();
    render(<ProducerDetailModal {...defaultProps} producerId="prod-2" onEdit={onEdit} />);

    await waitFor(() => {
      expect(screen.getByText('Editar')).toBeDefined();
    });
  });

  it('should not show Editar button for SOCIEDADE_EM_COMUM producer', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockProducerSC);
    const onEdit = vi.fn();
    render(<ProducerDetailModal {...defaultProps} producerId="prod-3" onEdit={onEdit} />);

    await waitFor(() => {
      expect(screen.getByText('Dados Gerais')).toBeDefined();
    });

    expect(screen.queryByText('Editar')).toBeNull();
  });

  it('should not show Editar button when onEdit is not provided', async () => {
    render(<ProducerDetailModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Dados Gerais')).toBeDefined();
    });

    expect(screen.queryByText('Editar')).toBeNull();
  });

  it('should call onEdit with producerId and type when Editar is clicked', async () => {
    const onEdit = vi.fn();
    render(<ProducerDetailModal {...defaultProps} onEdit={onEdit} />);

    await waitFor(() => {
      expect(screen.getByText('Editar')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Editar'));

    expect(onEdit).toHaveBeenCalledWith('prod-1', 'PF');
  });
});
