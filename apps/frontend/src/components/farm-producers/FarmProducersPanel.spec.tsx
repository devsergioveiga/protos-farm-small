import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import FarmProducersPanel from './FarmProducersPanel';
import type { FarmProducerLink, ExpiringContractAlert } from '@/types/farm-producer';

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

const mockAlerts: ExpiringContractAlert[] = [];
const mockAlertsTotal = { value: 0 };
const mockAlertsLoading = { value: false };

vi.mock('@/hooks/useExpiringContracts', () => ({
  useExpiringContracts: () => ({
    alerts: mockAlerts,
    total: mockAlertsTotal.value,
    isLoading: mockAlertsLoading.value,
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
        contractEndDate: null,
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

function setMockAlerts(alerts: ExpiringContractAlert[], total: number, loading = false) {
  mockAlerts.length = 0;
  mockAlerts.push(...alerts);
  mockAlertsTotal.value = total;
  mockAlertsLoading.value = loading;
}

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

describe('FarmProducersPanel', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    setMockData([]);
    setMockAlerts([], 0);
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

  // ─── ITR badge tests ───

  it('should render ITR badge when isItrDeclarant is true', () => {
    setMockData([LINK_PF]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);
    expect(screen.getByText('ITR')).toBeDefined();
  });

  // ─── Expiring contract badge tests ───

  it('should show warning badge when endDate is within 30 days', () => {
    const link: FarmProducerLink = {
      ...LINK_PF,
      endDate: futureDate(20),
      isItrDeclarant: false,
    };
    setMockData([link]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);
    expect(screen.getByText(/Vence em 20d/)).toBeDefined();
  });

  it('should show danger badge when endDate is within 7 days', () => {
    const link: FarmProducerLink = {
      ...LINK_PF,
      endDate: futureDate(5),
      isItrDeclarant: false,
    };
    setMockData([link]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);
    expect(screen.getByText(/Vence em 5d/)).toBeDefined();
  });

  it('should show Vencido badge when endDate is in the past', () => {
    const link: FarmProducerLink = {
      ...LINK_PF,
      endDate: futureDate(-2),
      isItrDeclarant: false,
    };
    setMockData([link]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);
    expect(screen.getByText('Vencido')).toBeDefined();
  });

  it('should not show expiring badge when endDate is more than 30 days away', () => {
    setMockData([LINK_PF]); // endDate is 2026-12-31, far future
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);
    expect(screen.queryByText(/Vence em/)).toBeNull();
  });

  it('should not show expiring badge when endDate is null', () => {
    setMockData([LINK_PJ]); // endDate is null
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);
    expect(screen.queryByText(/Vence em/)).toBeNull();
    expect(screen.queryByText('Vencido')).toBeNull();
  });

  // ─── IE expiring indicator tests ───

  it('should show IE expiring indicator when contractEndDate is within 30 days', () => {
    const link: FarmProducerLink = {
      ...LINK_PF,
      endDate: '2028-01-01T00:00:00Z', // far future, no link badge
      producer: {
        ...LINK_PF.producer,
        stateRegistrations: [
          {
            ...LINK_PF.producer.stateRegistrations[0],
            contractEndDate: futureDate(15),
          },
        ],
      },
    };
    setMockData([link]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);
    expect(screen.getByText(/15d/)).toBeDefined();
  });

  // ─── Alerts section tests ───

  it('should show alerts banner when there are expiring contracts', () => {
    const alerts: ExpiringContractAlert[] = [
      {
        type: 'FARM_LINK',
        id: 'alert-1',
        producerName: 'João Silva',
        farmName: 'Fazenda Santa Helena',
        expiresAt: futureDate(10),
        bondType: 'ARRENDATARIO',
      },
      {
        type: 'STATE_REGISTRATION',
        id: 'alert-2',
        producerName: 'Maria Santos',
        farmName: null,
        expiresAt: futureDate(5),
        ieNumber: '987.654.321',
        ieState: 'SP',
      },
    ];
    setMockAlerts(alerts, 2);
    setMockData([LINK_PF]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);

    expect(screen.getByText('2 contratos vencendo nos próximos 30 dias')).toBeDefined();
  });

  it('should show singular text when only 1 contract expiring', () => {
    const alerts: ExpiringContractAlert[] = [
      {
        type: 'FARM_LINK',
        id: 'alert-1',
        producerName: 'João Silva',
        farmName: 'Fazenda Santa Helena',
        expiresAt: futureDate(10),
        bondType: 'PROPRIETARIO',
      },
    ];
    setMockAlerts(alerts, 1);
    setMockData([LINK_PF]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);

    expect(screen.getByText('1 contrato vencendo nos próximos 30 dias')).toBeDefined();
  });

  it('should not show alerts section when total is 0', () => {
    setMockAlerts([], 0);
    setMockData([LINK_PF]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);

    expect(screen.queryByText(/contratos? vencendo/)).toBeNull();
  });

  it('should expand alert list when banner is clicked', () => {
    const alerts: ExpiringContractAlert[] = [
      {
        type: 'FARM_LINK',
        id: 'alert-1',
        producerName: 'João Silva',
        farmName: 'Fazenda Santa Helena',
        expiresAt: futureDate(10),
        bondType: 'ARRENDATARIO',
      },
    ];
    setMockAlerts(alerts, 1);
    setMockData([LINK_PF]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);

    // Alert details should not be visible initially
    expect(screen.queryByText('Contrato')).toBeNull();

    // Click to expand
    fireEvent.click(screen.getByText('1 contrato vencendo nos próximos 30 dias'));

    // Now details should be visible
    expect(screen.getByText('Contrato')).toBeDefined();
    expect(screen.getAllByText('João Silva').length).toBeGreaterThanOrEqual(2);
  });

  it('should show IE type label in alert list', () => {
    const alerts: ExpiringContractAlert[] = [
      {
        type: 'STATE_REGISTRATION',
        id: 'alert-2',
        producerName: 'Maria Santos',
        farmName: null,
        expiresAt: futureDate(5),
        ieNumber: '987.654.321',
        ieState: 'SP',
      },
    ];
    setMockAlerts(alerts, 1);
    setMockData([LINK_PJ]);
    render(<FarmProducersPanel farmId="farm-1" onClose={onClose} />);

    fireEvent.click(screen.getByText('1 contrato vencendo nos próximos 30 dias'));

    expect(screen.getByText('IE')).toBeDefined();
    expect(screen.getByText('Maria Santos')).toBeDefined();
    expect(screen.getByText(/987\.654\.321/)).toBeDefined();
  });
});
