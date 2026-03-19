import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockPatch = vi.fn();

vi.mock('@/services/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    put: (...args: unknown[]) => mockPut(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
  },
}));

const MOCK_BOARD_RESPONSE = {
  columns: [
    {
      id: 'RC_PENDENTE',
      label: 'RC Pendente',
      count: 1,
      cards: [
        {
          id: 'card-rc',
          entityType: 'RC' as const,
          sequentialNumber: 'RC-010',
          urgency: 'NORMAL' as const,
          requesterName: 'Ana',
          totalValue: 500,
          daysInStage: 1,
          isOverdue: false,
          farmId: 'farm-1',
          farmName: 'Fazenda Sol',
        },
      ],
    },
    {
      id: 'RC_APROVADA',
      label: 'RC Aprovada',
      count: 1,
      cards: [
        {
          id: 'card-rc2',
          entityType: 'RC' as const,
          sequentialNumber: 'RC-011',
          urgency: 'NORMAL' as const,
          requesterName: 'Pedro',
          totalValue: 800,
          daysInStage: 3,
          isOverdue: false,
          farmId: 'farm-1',
          farmName: 'Fazenda Sol',
        },
      ],
    },
    {
      id: 'EM_COTACAO',
      label: 'Em Cotação',
      count: 1,
      cards: [
        {
          id: 'card-1',
          entityType: 'RC' as const,
          sequentialNumber: 'RC-001',
          urgency: 'NORMAL' as const,
          requesterName: 'João Silva',
          totalValue: 1000,
          daysInStage: 2,
          isOverdue: false,
          farmId: 'farm-1',
          farmName: 'Fazenda Sol',
        },
      ],
    },
    {
      id: 'OC_EMITIDA',
      label: 'OC Emitida',
      count: 1,
      cards: [
        {
          id: 'card-2',
          entityType: 'OC' as const,
          sequentialNumber: 'OC-001',
          urgency: 'NORMAL' as const,
          requesterName: 'Maria Santos',
          totalValue: 2000,
          daysInStage: 1,
          isOverdue: false,
          farmId: 'farm-1',
          farmName: 'Fazenda Sol',
        },
      ],
    },
    {
      id: 'AGUARDANDO_ENTREGA',
      label: 'Aguardando Entrega',
      count: 0,
      cards: [],
    },
    {
      id: 'OC_EMITIDA_DEST',
      label: 'OC Emitida Dest',
      count: 0,
      cards: [],
    },
  ],
};

describe('usePurchasingKanban moveCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(MOCK_BOARD_RESPONSE);
  });

  it('EM_COTACAO->OC_EMITIDA returns null without calling api.post', async () => {
    const { usePurchasingKanban } = await import('./usePurchasingKanban');

    const { result } = renderHook(() => usePurchasingKanban('org-1', {}));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Reset post mock to track only moveCard calls (not initial fetch)
    mockPost.mockClear();

    let returnValue: string | null = 'not-called';
    await act(async () => {
      returnValue = await result.current.moveCard('card-1', 'EM_COTACAO', 'OC_EMITIDA');
    });

    // EM_COTACAO->OC_EMITIDA should navigate to quotations page, not create a PO
    // Expected: null (success, no error), and NO api.post call
    expect(returnValue).toBeNull();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('EM_COTACAO->OC_EMITIDA does not call any API (no patch, no put)', async () => {
    const { usePurchasingKanban } = await import('./usePurchasingKanban');

    const { result } = renderHook(() => usePurchasingKanban('org-1', {}));

    await waitFor(() => expect(result.current.loading).toBe(false));

    mockPatch.mockClear();
    mockPut.mockClear();

    await act(async () => {
      await result.current.moveCard('card-1', 'EM_COTACAO', 'OC_EMITIDA');
    });

    // Navigation is handled by the board component — hook must not call any API
    expect(mockPatch).not.toHaveBeenCalled();
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('OC_EMITIDA->AGUARDANDO_ENTREGA calls api.patch /transition with status EM_TRANSITO', async () => {
    const { usePurchasingKanban } = await import('./usePurchasingKanban');

    mockPatch.mockResolvedValue({ id: 'card-2', status: 'EM_TRANSITO' });

    const { result } = renderHook(() => usePurchasingKanban('org-1', {}));

    await waitFor(() => expect(result.current.loading).toBe(false));

    mockPatch.mockClear();

    await act(async () => {
      await result.current.moveCard('card-2', 'OC_EMITIDA', 'AGUARDANDO_ENTREGA');
    });

    // Should call PATCH /transition (not PUT /status)
    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockPatch).toHaveBeenCalledWith('/org/purchase-orders/card-2/transition', {
      status: 'EM_TRANSITO',
    });
  });

  it('OC_EMITIDA->AGUARDANDO_ENTREGA does not call api.put (broken endpoint removed)', async () => {
    const { usePurchasingKanban } = await import('./usePurchasingKanban');

    mockPatch.mockResolvedValue({ id: 'card-2', status: 'EM_TRANSITO' });

    const { result } = renderHook(() => usePurchasingKanban('org-1', {}));

    await waitFor(() => expect(result.current.loading).toBe(false));

    mockPut.mockClear();

    await act(async () => {
      await result.current.moveCard('card-2', 'OC_EMITIDA', 'AGUARDANDO_ENTREGA');
    });

    // api.put /status is the old broken endpoint — must not be called
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('RC_PENDENTE->RC_APROVADA calls api.post /org/purchase-requests/:id/transition with {action: APPROVE}', async () => {
    const { usePurchasingKanban } = await import('./usePurchasingKanban');

    mockPost.mockResolvedValue({});

    const { result } = renderHook(() => usePurchasingKanban('org-1', {}));

    await waitFor(() => expect(result.current.loading).toBe(false));

    mockPost.mockClear();

    await act(async () => {
      await result.current.moveCard('card-rc', 'RC_PENDENTE', 'RC_APROVADA');
    });

    expect(mockPost).toHaveBeenCalledWith('/org/purchase-requests/card-rc/transition', {
      action: 'APPROVE',
    });
  });

  it('RC_APROVADA->EM_COTACAO calls api.post /org/quotations without orgId', async () => {
    const { usePurchasingKanban } = await import('./usePurchasingKanban');

    mockPost.mockResolvedValue({});

    const { result } = renderHook(() => usePurchasingKanban('org-1', {}));

    await waitFor(() => expect(result.current.loading).toBe(false));

    mockPost.mockClear();

    await act(async () => {
      await result.current.moveCard('card-rc2', 'RC_APROVADA', 'EM_COTACAO');
    });

    expect(mockPost).toHaveBeenCalledWith('/org/quotations', { purchaseRequestId: 'card-rc2' });
  });
});
