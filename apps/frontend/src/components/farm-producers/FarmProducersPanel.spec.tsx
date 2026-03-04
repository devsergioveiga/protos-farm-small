import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import FarmProducersPanel from './FarmProducersPanel';
import type { FarmProducerLink } from '@/types/farm-producer';

const mockProducers: FarmProducerLink[] = [];
const mockIsLoading = { value: false };

vi.mock('@/hooks/useFarmProducers', () => ({
  useFarmProducers: () => ({
    producers: mockProducers,
    isLoading: mockIsLoading.value,
    error: null,
    refetch: vi.fn(),
  }),
}));

const LINK_PF: FarmProducerLink = {
  id: 'link-1',
  farmId: 'farm-1',
  producerId: 'prod-1',
  bondType: 'PROPRIETARIO',
  participationPct: 60,
  startDate: '2025-01-15T00:00:00Z',
  endDate: '2026-12-31T00:00:00Z',
  isItrDeclarant: true,
  createdAt: '2025-01-01T00:00:00Z',
  producer: {
    id: 'prod-1',
    name: 'João Silva',
    tradeName: null,
    type: 'PF',
    document: '12345678901',
    status: 'ACTIVE',
    stateRegistrations: [
      {
        id: 'ie-1',
        number: '123.456.789',
        state: 'MG',
        situation: 'ACTIVE',
        isDefaultForFarm: true,
      },
    ],
  },
  registrationLinks: [
    {
      id: 'rl-1',
      farmRegistrationId: 'reg-1',
      farmRegistration: {
        id: 'reg-1',
        number: '12345',
        cartorioName: '1º Ofício de Uberlândia',
      },
    },
  ],
};

const LINK_PJ: FarmProducerLink = {
  id: 'link-2',
  farmId: 'farm-1',
  producerId: 'prod-2',
  bondType: 'ARRENDATARIO',
  participationPct: null,
  startDate: null,
  endDate: null,
  isItrDeclarant: false,
  createdAt: '2025-02-01T00:00:00Z',
  producer: {
    id: 'prod-2',
    name: 'Agro Solutions Ltda',
    tradeName: 'AgroSol',
    type: 'PJ',
    document: '12345678000199',
    status: 'INACTIVE',
    stateRegistrations: [],
  },
  registrationLinks: [],
};

function setMockData(producers: FarmProducerLink[], loading = false) {
  mockProducers.length = 0;
  mockProducers.push(...producers);
  mockIsLoading.value = loading;
}

describe('FarmProducersPanel', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    setMockData([]);
  });

  it('should render the panel title', () => {
    setMockData([LINK_PF]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);
    expect(screen.getByText('Produtores')).toBeDefined();
  });

  it('should call onClose when close button is clicked', () => {
    setMockData([LINK_PF]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Fechar painel de produtores'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should show empty state when no producers', () => {
    setMockData([]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);
    expect(screen.getByText('Nenhum produtor vinculado')).toBeDefined();
  });

  it('should show skeleton when loading', () => {
    setMockData([], true);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);
    expect(screen.getByLabelText('Carregando produtores')).toBeDefined();
  });

  it('should render PF producer card with all details', () => {
    setMockData([LINK_PF]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);

    expect(screen.getByText('João Silva')).toBeDefined();
    expect(screen.getByText('PF')).toBeDefined();
    expect(screen.getByText('Ativo')).toBeDefined();
    expect(screen.getByText('ITR')).toBeDefined();
    expect(screen.getByText('123.456.789-01')).toBeDefined();
    expect(screen.getByText(/Proprietário/)).toBeDefined();
    expect(screen.getByText(/60%/)).toBeDefined();
  });

  it('should render vigência dates when present', () => {
    setMockData([LINK_PF]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);

    expect(screen.getByText('Vigência')).toBeDefined();
    expect(screen.getByText(/\/01\/2025/)).toBeDefined();
    expect(screen.getByText(/\/12\/2026/)).toBeDefined();
  });

  it('should render IEs section with default indicator', () => {
    setMockData([LINK_PF]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);

    expect(screen.getByText('IEs ATIVAS')).toBeDefined();
    const ieItems = screen.getAllByText(/123\.456\.789/);
    expect(ieItems.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('padrão')).toBeDefined();
  });

  it('should render registration links', () => {
    setMockData([LINK_PF]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);

    expect(screen.getByText('MATRÍCULAS')).toBeDefined();
    expect(screen.getByText('12345')).toBeDefined();
  });

  it('should render PJ producer with CNPJ formatted', () => {
    setMockData([LINK_PJ]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);

    expect(screen.getByText('Agro Solutions Ltda')).toBeDefined();
    expect(screen.getByText('PJ')).toBeDefined();
    expect(screen.getByText('Inativo')).toBeDefined();
    expect(screen.getByText('12.345.678/0001-99')).toBeDefined();
    expect(screen.getByText(/Arrendatário/)).toBeDefined();
  });

  it('should not show ITR badge when isItrDeclarant is false', () => {
    setMockData([LINK_PJ]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);
    expect(screen.queryByText('ITR')).toBeNull();
  });

  it('should not show vigência when dates are null', () => {
    setMockData([LINK_PJ]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);
    expect(screen.queryByText('Vigência')).toBeNull();
  });

  it('should not show IEs section when no state registrations', () => {
    setMockData([LINK_PJ]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);
    expect(screen.queryByText('IEs ATIVAS')).toBeNull();
  });

  it('should not show registration links section when empty', () => {
    setMockData([LINK_PJ]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);
    expect(screen.queryByText('MATRÍCULAS')).toBeNull();
  });

  it('should render multiple producer cards', () => {
    setMockData([LINK_PF, LINK_PJ]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);

    expect(screen.getByText('João Silva')).toBeDefined();
    expect(screen.getByText('Agro Solutions Ltda')).toBeDefined();
  });

  it('should not show participation percentage when null', () => {
    setMockData([LINK_PJ]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);
    expect(screen.queryByText(/%/)).toBeNull();
  });
});
