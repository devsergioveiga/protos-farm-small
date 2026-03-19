import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { AssetSummary } from '@/types/asset';

// ─── Mock hooks ────────────────────────────────────────────────────────

const mockUseAssets = vi.fn();
vi.mock('@/hooks/useAssets', () => ({
  useAssets: () => mockUseAssets(),
}));

const mockUseFarms = vi.fn();
vi.mock('@/hooks/useFarms', () => ({
  useFarms: () => mockUseFarms(),
}));

vi.mock('@/stores/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: 'u1', email: 'a@a.com', role: 'ADMIN', organizationId: 'o1' },
    permissions: ['assets:create', 'assets:read', 'assets:update', 'assets:delete'],
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    loginWithTokens: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('@/components/assets/AssetModal', () => ({
  default: () => null,
}));

// ─── Fixtures ──────────────────────────────────────────────────────────

const MOCK_SUMMARY: AssetSummary = {
  totalAssets: 12,
  totalValue: '850000.00',
  inMaintenance: 2,
  recentAcquisitions: [{ id: 'a1' } as never, { id: 'a2' } as never],
};

function defaultAssetsReturn(overrides = {}) {
  return {
    assets: [],
    loading: false,
    error: null,
    summary: MOCK_SUMMARY,
    total: 0,
    page: 1,
    totalPages: 1,
    fetchAssets: vi.fn(),
    fetchSummary: vi.fn(),
    deleteAsset: vi.fn(),
    exportCsv: vi.fn(),
    exportPdf: vi.fn(),
    ...overrides,
  };
}

function defaultFarmsReturn() {
  return {
    farms: [],
    meta: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────

describe('AssetsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFarms.mockReturnValue(defaultFarmsReturn());
  });

  async function renderPage() {
    const { default: AssetsPage } = await import('./AssetsPage');
    return render(
      <MemoryRouter>
        <AssetsPage />
      </MemoryRouter>,
    );
  }

  it('renders page title', async () => {
    mockUseAssets.mockReturnValue(defaultAssetsReturn());
    await renderPage();
    expect(screen.getByRole('heading', { name: /ativos patrimoniais/i })).toBeDefined();
  });

  it('renders empty state when no assets', async () => {
    mockUseAssets.mockReturnValue(defaultAssetsReturn());
    await renderPage();
    expect(screen.getByText(/nenhum ativo cadastrado/i)).toBeDefined();
  });

  it('renders summary cards', async () => {
    mockUseAssets.mockReturnValue(defaultAssetsReturn());
    await renderPage();
    expect(screen.getAllByText(/total de ativos/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/valor total patrimonio/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/em manutencao/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ultimas aquisicoes/i).length).toBeGreaterThan(0);
  });

  it('renders import button as disabled', async () => {
    mockUseAssets.mockReturnValue(defaultAssetsReturn());
    await renderPage();
    const importBtn = screen.getByRole('button', { name: /importar ativos/i });
    expect(importBtn.getAttribute('aria-disabled')).toBe('true');
  });

  it('renders skeleton loading state', async () => {
    mockUseAssets.mockReturnValue(defaultAssetsReturn({ loading: true, summary: null }));
    await renderPage();
    expect(screen.getByRole('status', { name: /carregando ativos/i })).toBeDefined();
  });

  it('renders error state', async () => {
    mockUseAssets.mockReturnValue(
      defaultAssetsReturn({
        error: 'Nao foi possivel carregar os ativos. Verifique sua conexao e tente novamente.',
        summary: null,
      }),
    );
    await renderPage();
    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('renders asset list when assets exist', async () => {
    mockUseAssets.mockReturnValue(
      defaultAssetsReturn({
        assets: [
          {
            id: 'a1',
            name: 'Trator John Deere',
            assetType: 'MAQUINA' as const,
            assetTag: 'PAT-00001',
            status: 'ATIVO' as const,
            classification: 'DEPRECIABLE_CPC27' as const,
            organizationId: 'o1',
            farmId: 'f1',
            farm: { name: 'Fazenda Sol' },
            acquisitionValue: '250000.00',
            acquisitionDate: null,
            description: null,
            supplierId: null,
            invoiceNumber: null,
            costCenterId: null,
            serialNumber: null,
            manufacturer: null,
            model: null,
            yearOfManufacture: null,
            engineHp: null,
            fuelType: null,
            renavamCode: null,
            licensePlate: null,
            parentAssetId: null,
            constructionMaterial: null,
            areaM2: null,
            capacity: null,
            registrationNumber: null,
            areaHa: null,
            carCode: null,
            currentHourmeter: null,
            currentOdometer: null,
            photoUrls: [],
            notes: null,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        ],
        total: 1,
      }),
    );
    await renderPage();
    expect(screen.queryByText(/nenhum ativo cadastrado/i)).toBeNull();
    // table is hidden on mobile — check for the asset tag in card or table
    const tags = screen.getAllByText('PAT-00001');
    expect(tags.length).toBeGreaterThan(0);
  });
});
