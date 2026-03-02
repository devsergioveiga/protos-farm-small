import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PlotHistoryPanel from './PlotHistoryPanel';
import type { FieldPlot } from '@/types/farm';

vi.mock('@/hooks/usePlotHistory', () => ({
  usePlotHistory: vi.fn().mockReturnValue({
    data: {
      seasons: [
        {
          id: 's1',
          plotId: 'plot-1',
          farmId: 'farm-1',
          seasonType: 'SAFRA',
          seasonYear: '2024/2025',
          crop: 'Soja',
          varietyName: null,
          startDate: '2024-10-15',
          endDate: '2025-02-28',
          plantedAreaHa: null,
          productivityKgHa: null,
          totalProductionKg: null,
          operations: [],
          notes: null,
          createdBy: 'user-1',
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ],
      analyses: [],
      rotation: {
        level: 1,
        label: 'Monocultura',
        description: 'Apenas Soja.',
        uniqueCrops: ['Soja'],
        seasonsAnalyzed: 1,
      },
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

const PLOT: FieldPlot = {
  id: 'plot-1',
  farmId: 'farm-1',
  registrationId: null,
  name: 'Talhão Norte',
  code: 'TN-01',
  soilType: 'LATOSSOLO_VERMELHO',
  currentCrop: 'Soja',
  previousCrop: 'Milho',
  notes: null,
  boundaryAreaHa: 45.5,
  status: 'ACTIVE',
  createdAt: '2026-02-15T10:00:00Z',
};

describe('PlotHistoryPanel', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render plot name and rotation badge', () => {
    render(<PlotHistoryPanel plot={PLOT} farmId="farm-1" onClose={onClose} />);
    expect(screen.getByText('Talhão Norte')).toBeDefined();
    expect(screen.getByText('Monocultura')).toBeDefined();
  });

  it('should render three tabs', () => {
    render(<PlotHistoryPanel plot={PLOT} farmId="farm-1" onClose={onClose} />);
    expect(screen.getByRole('tab', { name: 'Safras' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Solo' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Exportar' })).toBeDefined();
  });

  it('should show seasons tab by default', () => {
    render(<PlotHistoryPanel plot={PLOT} farmId="farm-1" onClose={onClose} />);
    expect(screen.getByText('Soja')).toBeDefined();
  });

  it('should switch to soil tab on click', () => {
    render(<PlotHistoryPanel plot={PLOT} farmId="farm-1" onClose={onClose} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Solo' }));
    expect(screen.getByText('Nenhuma análise de solo registrada ainda.')).toBeDefined();
  });

  it('should call onClose when close button clicked', () => {
    render(<PlotHistoryPanel plot={PLOT} farmId="farm-1" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Fechar histórico'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should have accessible region', () => {
    render(<PlotHistoryPanel plot={PLOT} farmId="farm-1" onClose={onClose} />);
    expect(screen.getByRole('region', { name: 'Histórico do talhão' })).toBeDefined();
  });
});
