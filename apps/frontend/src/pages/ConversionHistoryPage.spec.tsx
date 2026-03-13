import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ConversionHistoryItem } from '@/types/conversion-history';

const MOCK_ITEMS: ConversionHistoryItem[] = [
  {
    id: 'pest-1',
    operationType: 'PESTICIDE',
    operationLabel: 'Aplicação de defensivo',
    farmId: 'farm-1',
    farmName: 'Fazenda São José',
    fieldPlotId: 'plot-1',
    fieldPlotName: 'Talhão Norte',
    productName: 'Roundup Original',
    productId: 'prod-1',
    appliedAt: '2026-03-10T14:00:00.000Z',
    dose: 2.5,
    doseUnit: 'L_HA',
    doseUnitLabel: 'L/ha',
    areaHa: 50,
    totalQuantityUsed: 125,
    baseUnit: 'L',
    conversionFormula: '2.5 L/ha × 50 ha = 125.00 L',
    stockOutputId: 'so-1',
    recordedBy: 'user-1',
    recorderName: 'João Silva',
    createdAt: '2026-03-10T14:00:00.000Z',
  },
  {
    id: 'fert-1',
    operationType: 'FERTILIZER',
    operationLabel: 'Adubação',
    farmId: 'farm-1',
    farmName: 'Fazenda São José',
    fieldPlotId: 'plot-2',
    fieldPlotName: 'Talhão Sul',
    productName: 'Ureia 46%',
    productId: 'prod-2',
    appliedAt: '2026-03-09T10:00:00.000Z',
    dose: 200,
    doseUnit: 'KG_HA',
    doseUnitLabel: 'kg/ha',
    areaHa: 30,
    totalQuantityUsed: 6000,
    baseUnit: 'kg',
    conversionFormula: '200 kg/ha × 30 ha = 6000.00 kg',
    stockOutputId: null,
    recordedBy: 'user-2',
    recorderName: 'Maria Santos',
    createdAt: '2026-03-09T10:00:00.000Z',
  },
];

const mockUseConversionHistory = vi.fn();

vi.mock('@/hooks/useConversionHistory', () => ({
  useConversionHistory: (...args: unknown[]) => mockUseConversionHistory(...args),
}));

vi.mock('@/stores/FarmContext', () => ({
  useFarmContext: () => ({
    selectedFarm: { id: 'farm-1', name: 'Fazenda São José' },
    farms: [],
    isLoadingFarms: false,
    selectedFarmId: 'farm-1',
    selectFarm: vi.fn(),
    refreshFarms: vi.fn(),
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

import ConversionHistoryPage from './ConversionHistoryPage';

describe('ConversionHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render title and subtitle', () => {
    mockUseConversionHistory.mockReturnValue({
      items: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ConversionHistoryPage />);
    expect(screen.getByText('Histórico de conversões')).toBeTruthy();
    expect(screen.getByText(/Auditoria de conversões.*Fazenda São José/)).toBeTruthy();
  });

  it('should show empty state when no items', () => {
    mockUseConversionHistory.mockReturnValue({
      items: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ConversionHistoryPage />);
    expect(screen.getByText('Nenhuma conversão encontrada')).toBeTruthy();
  });

  it('should show skeleton while loading', () => {
    mockUseConversionHistory.mockReturnValue({
      items: [],
      meta: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    const { container } = render(<ConversionHistoryPage />);
    const skeletons = container.querySelectorAll('.conv-history__skeleton--card');
    expect(skeletons.length).toBe(6);
  });

  it('should show error message', () => {
    mockUseConversionHistory.mockReturnValue({
      items: [],
      meta: null,
      isLoading: false,
      error: 'Erro ao carregar histórico de conversões',
      refetch: vi.fn(),
    });

    render(<ConversionHistoryPage />);
    expect(screen.getByText('Erro ao carregar histórico de conversões')).toBeTruthy();
  });

  it('should render conversion cards', () => {
    mockUseConversionHistory.mockReturnValue({
      items: MOCK_ITEMS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ConversionHistoryPage />);

    // Product names
    expect(screen.getByText('Roundup Original')).toBeTruthy();
    expect(screen.getByText('Ureia 46%')).toBeTruthy();

    // Operation badges (getAllByText because badges also appear in filter dropdown)
    expect(screen.getAllByText('Aplicação de defensivo').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Adubação').length).toBeGreaterThanOrEqual(1);

    // Conversion formulas
    expect(screen.getByText('2.5 L/ha × 50 ha = 125.00 L')).toBeTruthy();
    expect(screen.getByText('200 kg/ha × 30 ha = 6000.00 kg')).toBeTruthy();

    // Field plot names
    expect(screen.getByText('Talhão Norte')).toBeTruthy();
    expect(screen.getByText('Talhão Sul')).toBeTruthy();
  });

  it('should show stock deduction badge', () => {
    mockUseConversionHistory.mockReturnValue({
      items: MOCK_ITEMS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ConversionHistoryPage />);
    expect(screen.getByText('Baixa no estoque')).toBeTruthy();
    expect(screen.getByText('Sem baixa no estoque')).toBeTruthy();
  });

  it('should show stats when items exist', () => {
    mockUseConversionHistory.mockReturnValue({
      items: MOCK_ITEMS,
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ConversionHistoryPage />);
    expect(screen.getByText('2')).toBeTruthy(); // total
    expect(screen.getByText('CONVERSÕES')).toBeTruthy();
  });

  it('should render filter controls', () => {
    mockUseConversionHistory.mockReturnValue({
      items: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ConversionHistoryPage />);
    expect(screen.getByLabelText('Buscar por nome do produto')).toBeTruthy();
    expect(screen.getByLabelText('Filtrar por tipo de operação')).toBeTruthy();
    expect(screen.getByLabelText('Data início')).toBeTruthy();
    expect(screen.getByLabelText('Data fim')).toBeTruthy();
  });

  it('should have export CSV button', () => {
    mockUseConversionHistory.mockReturnValue({
      items: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ConversionHistoryPage />);
    expect(screen.getByLabelText('Exportar histórico CSV')).toBeTruthy();
  });

  it('should show pagination when multiple pages', () => {
    mockUseConversionHistory.mockReturnValue({
      items: MOCK_ITEMS,
      meta: { page: 1, limit: 20, total: 50, totalPages: 3 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ConversionHistoryPage />);
    expect(screen.getByText('Página 1 de 3')).toBeTruthy();
    expect(screen.getByText('Anterior')).toBeTruthy();
    expect(screen.getByText('Próxima')).toBeTruthy();
  });

  it('should filter by operation type', async () => {
    const user = userEvent.setup();
    mockUseConversionHistory.mockReturnValue({
      items: [],
      meta: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ConversionHistoryPage />);
    const select = screen.getByLabelText('Filtrar por tipo de operação');
    await user.selectOptions(select, 'PESTICIDE');

    // Hook should be called with operationType filter
    const lastCall = mockUseConversionHistory.mock.calls.at(-1)?.[0];
    expect(lastCall.operationType).toBe('PESTICIDE');
  });
});
