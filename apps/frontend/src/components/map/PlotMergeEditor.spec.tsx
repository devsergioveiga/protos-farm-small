import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock leaflet before importing the component
const mockMap = {
  fitBounds: vi.fn(),
  on: vi.fn(),
  remove: vi.fn(),
  removeLayer: vi.fn(),
};

const mockGeoJSONLayer = {
  getBounds: vi.fn().mockReturnValue({ isValid: () => true }),
  addTo: vi.fn().mockReturnThis(),
  on: vi.fn(),
  bindTooltip: vi.fn().mockReturnThis(),
  setStyle: vi.fn(),
};

vi.mock('leaflet', () => {
  const latLngBoundsObj = {
    isValid: () => true,
    extend: vi.fn(),
  };
  const L = {
    map: vi.fn(() => mockMap),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    geoJSON: vi.fn(() => ({ ...mockGeoJSONLayer })),
    latLngBounds: vi.fn(() => latLngBoundsObj),
  };
  return { default: L, ...L };
});

vi.mock('@/services/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

import PlotMergeEditor from './PlotMergeEditor';
import type { FieldPlot, BoundaryInfo } from '@/types/farm';

const POLYGON: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-55.7, -12.5],
      [-55.6, -12.5],
      [-55.6, -12.6],
      [-55.7, -12.6],
      [-55.7, -12.5],
    ],
  ],
};

const BOUNDARY: BoundaryInfo = {
  hasBoundary: true,
  boundaryAreaHa: 25,
  boundaryGeoJSON: POLYGON,
};

const makePlot = (id: string, name: string): FieldPlot => ({
  id,
  farmId: 'farm-1',
  registrationId: null,
  name,
  code: null,
  soilType: null,
  currentCrop: 'Soja',
  previousCrop: null,
  notes: null,
  boundaryAreaHa: 25,
  status: 'ACTIVE',
  createdAt: '2026-02-15T10:00:00Z',
});

const PLOT_BOUNDARIES = [
  { plotId: 'p1', plot: makePlot('p1', 'Talhão A'), boundary: BOUNDARY },
  { plotId: 'p2', plot: makePlot('p2', 'Talhão B'), boundary: BOUNDARY },
  { plotId: 'p3', plot: makePlot('p3', 'Talhão C'), boundary: BOUNDARY },
];

describe('PlotMergeEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with title', () => {
    render(
      <PlotMergeEditor
        plotBoundaries={PLOT_BOUNDARIES}
        farmBoundary={null}
        farmId="farm-1"
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Mesclar talhões')).toBeDefined();
  });

  it('should show selection hint initially', () => {
    render(
      <PlotMergeEditor
        plotBoundaries={PLOT_BOUNDARIES}
        farmBoundary={null}
        farmId="farm-1"
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Clique em pelo menos 2 talhões para mesclar')).toBeDefined();
  });

  it('should call onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <PlotMergeEditor
        plotBoundaries={PLOT_BOUNDARIES}
        farmBoundary={null}
        farmId="farm-1"
        onComplete={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('should show selected count as 0 initially', () => {
    render(
      <PlotMergeEditor
        plotBoundaries={PLOT_BOUNDARIES}
        farmBoundary={null}
        farmId="farm-1"
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Selecionados (0)')).toBeDefined();
  });

  it('should have accessible region label', () => {
    render(
      <PlotMergeEditor
        plotBoundaries={PLOT_BOUNDARIES}
        farmBoundary={null}
        farmId="farm-1"
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('region', { name: 'Mesclagem de talhões' })).toBeDefined();
  });

  it('should have preview button disabled when less than 2 selected', () => {
    render(
      <PlotMergeEditor
        plotBoundaries={PLOT_BOUNDARIES}
        farmBoundary={null}
        farmId="farm-1"
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const previewBtn = screen.getByText('Pré-visualizar');
    expect(previewBtn.closest('button')?.disabled).toBe(true);
  });
});
