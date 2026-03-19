import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { FarmListItem } from '@/types/farm';

const MOCK_FARMS: FarmListItem[] = [
  {
    id: 'farm-1',
    name: 'Fazenda Sol',
    nickname: null,
    city: 'Uberlândia',
    state: 'MG',
    totalAreaHa: 500,
    boundaryAreaHa: null,
    status: 'ACTIVE',
    landClassification: null,
    latitude: null,
    longitude: null,
    createdAt: '2026-01-01',
    _count: { registrations: 2, fieldPlots: 0, ruralProperties: 0 },
  },
  {
    id: 'farm-2',
    name: 'Fazenda Lua',
    nickname: null,
    city: 'Uberaba',
    state: 'MG',
    totalAreaHa: 300,
    boundaryAreaHa: null,
    status: 'ACTIVE',
    landClassification: null,
    latitude: null,
    longitude: null,
    createdAt: '2026-01-02',
    _count: { registrations: 1, fieldPlots: 0, ruralProperties: 0 },
  },
];

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    setTokens: vi.fn(),
    clearTokens: vi.fn(),
    setOnUnauthorized: vi.fn(),
  },
  TOKEN_KEY: 'protos_access_token',
  REFRESH_KEY: 'protos_refresh_token',
}));

vi.mock('@/stores/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: 'user-1', email: 'test@test.com', role: 'ADMIN', organizationId: 'org-1' },
    isAuthenticated: true,
    isLoading: false,
    permissions: [],
    login: vi.fn(),
    loginWithTokens: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { api } from '@/services/api';
import { FarmProvider, useFarmContext } from '@/stores/FarmContext';

const mockApiGet = vi.mocked(api.get);

function TestConsumer() {
  const ctx = useFarmContext();
  return (
    <div>
      <span data-testid="loading">{String(ctx.isLoadingFarms)}</span>
      <span data-testid="count">{ctx.farms.length}</span>
      <span data-testid="selected">{ctx.selectedFarmId ?? 'null'}</span>
      <span data-testid="selected-name">{ctx.selectedFarm?.name ?? 'null'}</span>
      <button onClick={() => ctx.selectFarm('farm-1')}>Select 1</button>
      <button onClick={() => ctx.selectFarm(null)}>Select null</button>
    </div>
  );
}

describe('FarmContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  function renderWithProvider() {
    return render(
      <FarmProvider>
        <TestConsumer />
      </FarmProvider>,
    );
  }

  it('should load farms on mount', async () => {
    mockApiGet.mockResolvedValueOnce({
      data: MOCK_FARMS,
      meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
    } as never);

    await act(async () => {
      renderWithProvider();
    });

    expect(screen.getByTestId('count').textContent).toBe('2');
    expect(mockApiGet).toHaveBeenCalledWith('/org/farms?limit=100');
  });

  it('should select a farm and persist to localStorage', async () => {
    const user = userEvent.setup();
    mockApiGet.mockResolvedValueOnce({
      data: MOCK_FARMS,
      meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
    } as never);

    await act(async () => {
      renderWithProvider();
    });

    await user.click(screen.getByText('Select 1'));

    expect(screen.getByTestId('selected').textContent).toBe('farm-1');
    expect(screen.getByTestId('selected-name').textContent).toBe('Fazenda Sol');
    expect(localStorage.getItem('protos_selected_farm_user-1')).toBe('farm-1');
  });

  it('should restore selection from localStorage', async () => {
    localStorage.setItem('protos_selected_farm_user-1', 'farm-2');
    mockApiGet.mockResolvedValueOnce({
      data: MOCK_FARMS,
      meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
    } as never);

    await act(async () => {
      renderWithProvider();
    });

    expect(screen.getByTestId('selected').textContent).toBe('farm-2');
    expect(screen.getByTestId('selected-name').textContent).toBe('Fazenda Lua');
  });

  it('should reset selection if stored farm no longer exists', async () => {
    localStorage.setItem('protos_selected_farm_user-1', 'non-existent');
    mockApiGet.mockResolvedValueOnce({
      data: MOCK_FARMS,
      meta: { page: 1, limit: 100, total: 2, totalPages: 1 },
    } as never);

    await act(async () => {
      renderWithProvider();
    });

    expect(screen.getByTestId('selected').textContent).toBe('null');
    expect(localStorage.getItem('protos_selected_farm_user-1')).toBeNull();
  });
});
