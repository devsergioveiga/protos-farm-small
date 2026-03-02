import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock leaflet and leaflet-draw before importing the component
const mockMap = {
  fitBounds: vi.fn(),
  addControl: vi.fn(),
  on: vi.fn(),
  remove: vi.fn(),
};

const mockLayerGroup = {
  addTo: vi.fn().mockReturnThis(),
  clearLayers: vi.fn(),
};

const mockGeoJSON = {
  getBounds: vi.fn().mockReturnValue({ isValid: () => true }),
  addTo: vi.fn().mockReturnThis(),
  eachLayer: vi.fn(),
};

vi.mock('leaflet', () => {
  const L = {
    map: vi.fn(() => mockMap),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    geoJSON: vi.fn(() => mockGeoJSON),
    layerGroup: vi.fn(() => mockLayerGroup),
    Draw: {
      Event: { CREATED: 'draw:created' },
      Polyline: vi.fn(() => ({ enable: vi.fn() })),
    },
  };
  return { default: L, ...L };
});

vi.mock('leaflet-draw', () => ({}));

vi.mock('@/services/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

import PlotSubdivideEditor from './PlotSubdivideEditor';
import type { FieldPlot } from '@/types/farm';

const PLOT: FieldPlot = {
  id: 'plot-1',
  farmId: 'farm-1',
  registrationId: null,
  name: 'Talhão Norte',
  code: null,
  soilType: null,
  currentCrop: 'Soja',
  previousCrop: null,
  notes: null,
  boundaryAreaHa: 50,
  status: 'ACTIVE',
  createdAt: '2026-02-15T10:00:00Z',
};

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

describe('PlotSubdivideEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with plot name in title', () => {
    render(
      <PlotSubdivideEditor
        plot={PLOT}
        plotBoundary={POLYGON}
        farmBoundary={null}
        otherPlots={[]}
        farmId="farm-1"
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/Subdividir: Talhão Norte/)).toBeDefined();
  });

  it('should show draw hint initially', () => {
    render(
      <PlotSubdivideEditor
        plot={PLOT}
        plotBoundary={POLYGON}
        farmBoundary={null}
        otherPlots={[]}
        farmId="farm-1"
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Desenhe uma linha de corte sobre o talhão')).toBeDefined();
  });

  it('should call onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <PlotSubdivideEditor
        plot={PLOT}
        plotBoundary={POLYGON}
        farmBoundary={null}
        otherPlots={[]}
        farmId="farm-1"
        onComplete={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('should not show subdivide button in draw step', () => {
    render(
      <PlotSubdivideEditor
        plot={PLOT}
        plotBoundary={POLYGON}
        farmBoundary={null}
        otherPlots={[]}
        farmId="farm-1"
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByText('Subdividir')).toBeNull();
  });

  it('should have accessible region label', () => {
    render(
      <PlotSubdivideEditor
        plot={PLOT}
        plotBoundary={POLYGON}
        farmBoundary={null}
        otherPlots={[]}
        farmId="farm-1"
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('region', { name: 'Subdivisão de talhão' })).toBeDefined();
  });
});
