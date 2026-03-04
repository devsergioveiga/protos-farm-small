import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import FarmLinkFormModal from './FarmLinkFormModal';
import type { ProducerFarmLink } from '@/types/producer';

vi.mock('@/services/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/hooks/useFarms', () => ({
  useFarms: () => ({
    farms: [
      { id: 'farm-1', name: 'Fazenda Santa Helena', state: 'MG', nickname: null },
      { id: 'farm-2', name: 'Fazenda Boa Vista', state: 'SP', nickname: null },
    ],
    meta: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
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

const existingLink: ProducerFarmLink = {
  id: 'link-1',
  bondType: 'PROPRIETARIO',
  participationPct: 50,
  startDate: '2025-01-01T00:00:00.000Z',
  endDate: '2026-12-31T00:00:00.000Z',
  isItrDeclarant: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  farm: {
    id: 'farm-1',
    name: 'Fazenda Santa Helena',
    nickname: null,
    state: 'MG',
  },
  registrationLinks: [],
};

describe('FarmLinkFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'new-link-1' });
    (api.patch as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'link-1' });
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ registrations: [] });
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(<FarmLinkFormModal {...defaultProps} isOpen={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('should render the modal with title and form fields', () => {
    render(<FarmLinkFormModal {...defaultProps} />);
    expect(screen.getByText('Vincular fazenda')).toBeDefined();
    expect(screen.getByLabelText(/Fazenda/)).toBeDefined();
    expect(screen.getByLabelText(/Tipo de vínculo/)).toBeDefined();
    expect(screen.getByLabelText(/Participação/)).toBeDefined();
    expect(screen.getByLabelText(/Data início/)).toBeDefined();
    expect(screen.getByLabelText(/Data fim/)).toBeDefined();
    expect(screen.getByLabelText(/Declarante de ITR/)).toBeDefined();
  });

  it('should show farm options from useFarms', () => {
    render(<FarmLinkFormModal {...defaultProps} />);
    const farmSelect = screen.getByLabelText(/Fazenda/) as HTMLSelectElement;
    expect(farmSelect.options.length).toBe(3); // placeholder + 2 farms
    expect(farmSelect.options[1].textContent).toContain('Fazenda Santa Helena');
    expect(farmSelect.options[2].textContent).toContain('Fazenda Boa Vista');
  });

  it('should show bond type options', () => {
    render(<FarmLinkFormModal {...defaultProps} />);
    const bondSelect = screen.getByLabelText(/Tipo de vínculo/) as HTMLSelectElement;
    expect(bondSelect.options.length).toBe(8); // placeholder + 7 types
  });

  it('should show validation errors on blur for required fields', () => {
    render(<FarmLinkFormModal {...defaultProps} />);

    fireEvent.blur(screen.getByLabelText(/Fazenda/));
    expect(screen.getByText('Fazenda é obrigatória')).toBeDefined();

    fireEvent.blur(screen.getByLabelText(/Tipo de vínculo/));
    expect(screen.getByText('Tipo de vínculo é obrigatório')).toBeDefined();
  });

  it('should validate endDate >= startDate', () => {
    render(<FarmLinkFormModal {...defaultProps} />);

    const startDate = screen.getByLabelText(/Data início/);
    const endDate = screen.getByLabelText(/Data fim/);

    fireEvent.change(startDate, { target: { value: '2026-06-01' } });
    fireEvent.change(endDate, { target: { value: '2025-01-01' } });
    fireEvent.blur(endDate);

    expect(screen.getByText('Data fim deve ser maior ou igual à data início')).toBeDefined();
  });

  it('should validate participationPct range', () => {
    render(<FarmLinkFormModal {...defaultProps} />);

    const pctInput = screen.getByLabelText(/Participação/);
    fireEvent.change(pctInput, { target: { value: '150' } });
    fireEvent.blur(pctInput);

    expect(screen.getByText('Participação deve ser entre 0 e 100')).toBeDefined();
  });

  it('should submit create payload correctly', async () => {
    render(<FarmLinkFormModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Fazenda/), { target: { value: 'farm-1' } });
    fireEvent.change(screen.getByLabelText(/Tipo de vínculo/), {
      target: { value: 'ARRENDATARIO' },
    });
    fireEvent.change(screen.getByLabelText(/Participação/), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText(/Data início/), { target: { value: '2026-01-01' } });
    fireEvent.click(screen.getByLabelText(/Declarante de ITR/));

    fireEvent.click(screen.getByText('Vincular'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/org/producers/prod-1/farms', {
        farmId: 'farm-1',
        bondType: 'ARRENDATARIO',
        participationPct: 25,
        startDate: '2026-01-01',
        isItrDeclarant: true,
        registrationIds: [],
      });
    });

    expect(defaultProps.onSuccess).toHaveBeenCalled();
  });

  it('should prefill fields in edit mode', () => {
    render(<FarmLinkFormModal {...defaultProps} existingLink={existingLink} />);

    expect(screen.getByText('Editar vínculo')).toBeDefined();

    const farmSelect = screen.getByLabelText(/Fazenda/) as HTMLSelectElement;
    expect(farmSelect.value).toBe('farm-1');
    expect(farmSelect.disabled).toBe(true);

    const bondSelect = screen.getByLabelText(/Tipo de vínculo/) as HTMLSelectElement;
    expect(bondSelect.value).toBe('PROPRIETARIO');

    const pctInput = screen.getByLabelText(/Participação/) as HTMLInputElement;
    expect(pctInput.value).toBe('50');

    const itrCheckbox = screen.getByLabelText(/Declarante de ITR/) as HTMLInputElement;
    expect(itrCheckbox.checked).toBe(true);
  });

  it('should submit edit payload correctly', async () => {
    render(<FarmLinkFormModal {...defaultProps} existingLink={existingLink} />);

    fireEvent.change(screen.getByLabelText(/Tipo de vínculo/), {
      target: { value: 'PARCEIRO' },
    });

    fireEvent.click(screen.getByText('Salvar alterações'));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/org/producers/prod-1/farms/link-1', {
        bondType: 'PARCEIRO',
        participationPct: 50,
        startDate: '2025-01-01',
        endDate: '2026-12-31',
        isItrDeclarant: true,
        registrationIds: [],
      });
    });

    expect(defaultProps.onSuccess).toHaveBeenCalled();
  });

  it('should close on Escape key', () => {
    render(<FarmLinkFormModal {...defaultProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should close on overlay click', () => {
    render(<FarmLinkFormModal {...defaultProps} />);
    const overlay = document.querySelector('.farm-link-modal__overlay');
    if (overlay) fireEvent.click(overlay);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should show submit error on API failure', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Erro de rede'));

    render(<FarmLinkFormModal {...defaultProps} />);

    fireEvent.change(screen.getByLabelText(/Fazenda/), { target: { value: 'farm-1' } });
    fireEvent.change(screen.getByLabelText(/Tipo de vínculo/), {
      target: { value: 'PROPRIETARIO' },
    });

    fireEvent.click(screen.getByText('Vincular'));

    await waitFor(() => {
      expect(screen.getByText('Erro de rede')).toBeDefined();
    });
  });

  it('should not submit with validation errors', async () => {
    render(<FarmLinkFormModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Vincular'));

    await waitFor(() => {
      expect(screen.getByText('Fazenda é obrigatória')).toBeDefined();
      expect(screen.getByText('Tipo de vínculo é obrigatório')).toBeDefined();
    });

    expect(api.post).not.toHaveBeenCalled();
  });
});
