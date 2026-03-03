import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useRegistrations } from './useRegistrations';

const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/services/api', () => ({
  api: {
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

describe('useRegistrations', () => {
  const onMutationSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call POST and update areaDivergence on addRegistration', async () => {
    const response = {
      id: 'reg-1',
      farmId: 'farm-1',
      number: '12345',
      areaDivergence: { divergent: true, percentage: 10 },
    };
    mockPost.mockResolvedValue(response);

    const { result } = renderHook(() => useRegistrations('farm-1', onMutationSuccess));

    await act(async () => {
      await result.current.addRegistration({
        number: '12345',
        cartorioName: 'Cart',
        comarca: 'Com',
        state: 'MG',
        areaHa: 50,
      });
    });

    expect(mockPost).toHaveBeenCalledWith('/org/farms/farm-1/registrations', {
      number: '12345',
      cartorioName: 'Cart',
      comarca: 'Com',
      state: 'MG',
      areaHa: 50,
    });
    expect(result.current.areaDivergence).toEqual({ divergent: true, percentage: 10 });
    expect(onMutationSuccess).toHaveBeenCalledOnce();
  });

  it('should call PATCH on updateRegistration', async () => {
    const response = {
      id: 'reg-1',
      areaDivergence: { divergent: false, percentage: 2 },
    };
    mockPatch.mockResolvedValue(response);

    const { result } = renderHook(() => useRegistrations('farm-1', onMutationSuccess));

    await act(async () => {
      await result.current.updateRegistration('reg-1', { areaHa: 60 });
    });

    expect(mockPatch).toHaveBeenCalledWith('/org/farms/farm-1/registrations/reg-1', {
      areaHa: 60,
    });
    expect(result.current.areaDivergence).toEqual({ divergent: false, percentage: 2 });
    expect(onMutationSuccess).toHaveBeenCalledOnce();
  });

  it('should call DELETE on deleteRegistration', async () => {
    const response = {
      message: 'Removida',
      areaDivergence: null,
    };
    mockDelete.mockResolvedValue(response);

    const { result } = renderHook(() => useRegistrations('farm-1', onMutationSuccess));

    await act(async () => {
      await result.current.deleteRegistration('reg-1');
    });

    expect(mockDelete).toHaveBeenCalledWith('/org/farms/farm-1/registrations/reg-1');
    expect(result.current.areaDivergence).toBeNull();
    expect(onMutationSuccess).toHaveBeenCalledOnce();
  });

  it('should set submitError on failure', async () => {
    mockPost.mockRejectedValue(new Error('Erro de rede'));

    const { result } = renderHook(() => useRegistrations('farm-1', onMutationSuccess));

    await act(async () => {
      try {
        await result.current.addRegistration({
          number: '12345',
          cartorioName: 'Cart',
          comarca: 'Com',
          state: 'MG',
          areaHa: 50,
        });
      } catch {
        // expected
      }
    });

    expect(result.current.submitError).toBe('Erro de rede');
    expect(onMutationSuccess).not.toHaveBeenCalled();
  });

  it('should not call API when farmId is undefined', async () => {
    const { result } = renderHook(() => useRegistrations(undefined, onMutationSuccess));

    await act(async () => {
      await result.current.addRegistration({
        number: '12345',
        cartorioName: 'Cart',
        comarca: 'Com',
        state: 'MG',
        areaHa: 50,
      });
    });

    expect(mockPost).not.toHaveBeenCalled();
  });

  it('should clear error with clearError', async () => {
    mockPost.mockRejectedValue(new Error('Falhou'));

    const { result } = renderHook(() => useRegistrations('farm-1', onMutationSuccess));

    await act(async () => {
      try {
        await result.current.addRegistration({
          number: '1',
          cartorioName: 'C',
          comarca: 'C',
          state: 'SP',
          areaHa: 10,
        });
      } catch {
        // expected
      }
    });

    expect(result.current.submitError).toBe('Falhou');

    act(() => {
      result.current.clearError();
    });

    expect(result.current.submitError).toBeNull();
  });
});
