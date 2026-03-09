import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CultivarsPage from './CultivarsPage';

const mockCultivars = [
  {
    id: 'c1',
    organizationId: 'org1',
    name: 'TMG 7063 IPRO',
    crop: 'Soja',
    breeder: 'TMG',
    cycleDays: 115,
    maturationGroup: '6.3',
    type: 'TRANSGENICO',
    technology: 'IPRO',
    diseaseTolerances: null,
    regionalAptitude: 'Sul/Sudeste',
    populationRecommendation: null,
    plantingWindowStart: null,
    plantingWindowEnd: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'c2',
    organizationId: 'org1',
    name: 'BRS 1010',
    crop: 'Milho',
    breeder: 'Embrapa',
    cycleDays: 130,
    maturationGroup: null,
    type: 'CONVENCIONAL',
    technology: null,
    diseaseTolerances: null,
    regionalAptitude: null,
    populationRecommendation: null,
    plantingWindowStart: null,
    plantingWindowEnd: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

vi.mock('@/hooks/useCultivars', () => ({
  useCultivars: () => ({
    cultivars: mockCultivars,
    meta: { page: 1, limit: 50, total: 2, totalPages: 1 },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/stores/FarmContext', () => ({
  useFarmContext: () => ({
    selectedFarmId: 'farm-1',
    selectedFarm: { id: 'farm-1', name: 'Fazenda Teste' },
    farms: [],
    isLoadingFarms: false,
    selectFarm: vi.fn(),
    refreshFarms: vi.fn(),
  }),
}));

vi.mock('@/components/auth/PermissionGate', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/cultivars/CultivarModal', () => ({
  default: () => null,
}));

describe('CultivarsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the page title', () => {
    render(<CultivarsPage />);
    expect(screen.getByText('Cultivares')).toBeTruthy();
  });

  it('should render three tabs', () => {
    render(<CultivarsPage />);
    expect(screen.getByRole('tab', { name: /catálogo/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /produtividade/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /histórico por talhão/i })).toBeTruthy();
  });

  it('should show catalog tab by default', () => {
    render(<CultivarsPage />);
    expect(screen.getByRole('tab', { name: /catálogo/i }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByText('TMG 7063 IPRO')).toBeTruthy();
    expect(screen.getByText('BRS 1010')).toBeTruthy();
  });

  it('should show search and filters in catalog tab', () => {
    render(<CultivarsPage />);
    expect(screen.getByLabelText('Buscar cultivares')).toBeTruthy();
    expect(screen.getByLabelText('Filtrar por cultura')).toBeTruthy();
  });

  it('should toggle advanced filters panel (CA7)', () => {
    render(<CultivarsPage />);
    const filtersBtn = screen.getByRole('button', { name: /filtros/i });
    expect(screen.queryByLabelText('Tipo')).toBeNull();

    fireEvent.click(filtersBtn);
    expect(screen.getByLabelText('Tipo')).toBeTruthy();
    expect(screen.getByLabelText('Tecnologia')).toBeTruthy();
  });

  it('should filter by type in advanced filters (CA7)', () => {
    render(<CultivarsPage />);
    fireEvent.click(screen.getByRole('button', { name: /filtros/i }));

    const typeSelect = screen.getByLabelText('Tipo');
    fireEvent.change(typeSelect, { target: { value: 'TRANSGENICO' } });

    // Should show TMG 7063 (transgênico) but not BRS 1010 (convencional)
    expect(screen.getByText('TMG 7063 IPRO')).toBeTruthy();
    expect(screen.queryByText('BRS 1010')).toBeNull();
  });

  it('should filter by technology in advanced filters (CA7)', () => {
    render(<CultivarsPage />);
    fireEvent.click(screen.getByRole('button', { name: /filtros/i }));

    const techInput = screen.getByLabelText('Tecnologia');
    fireEvent.change(techInput, { target: { value: 'IPRO' } });

    expect(screen.getByText('TMG 7063 IPRO')).toBeTruthy();
    expect(screen.queryByText('BRS 1010')).toBeNull();
  });

  it('should show clear filters button when filters are active', () => {
    render(<CultivarsPage />);
    fireEvent.click(screen.getByRole('button', { name: /filtros/i }));

    const typeSelect = screen.getByLabelText('Tipo');
    fireEvent.change(typeSelect, { target: { value: 'TRANSGENICO' } });

    expect(screen.getByText('Limpar filtros')).toBeTruthy();
  });
});
