import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock leaflet and leaflet-draw before importing the component
const mockMap = {
  fitBounds: vi.fn(),
  addControl: vi.fn(),
  on: vi.fn(),
  remove: vi.fn(),
};

const mockFeatureGroup = {
  addLayer: vi.fn(),
  addTo: vi.fn().mockReturnThis(),
  getBounds: vi.fn().mockReturnValue({
    isValid: () => true,
  }),
  getLayers: vi.fn().mockReturnValue([
    {
      toGeoJSON: () => ({
        geometry: {
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
        },
      }),
    },
  ]),
};

const mockGeoJSON = {
  eachLayer: vi.fn((cb: (layer: unknown) => void) => cb({})),
};

vi.mock('leaflet', () => {
  const L = {
    map: vi.fn(() => mockMap),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
    geoJSON: vi.fn(() => mockGeoJSON),
    FeatureGroup: vi.fn(() => mockFeatureGroup),
    Control: {
      Draw: vi.fn(() => ({
        _toolbars: { edit: { _modes: { edit: { handler: { enable: vi.fn() } } } } },
      })),
    },
    Draw: { Event: { EDITED: 'draw:edited' } },
  };
  return { default: L, ...L };
});

vi.mock('leaflet-draw', () => ({}));

vi.mock('@turf/area', () => ({
  default: vi.fn(() => 500000), // 50 ha in m²
}));

vi.mock('@turf/helpers', () => ({
  polygon: vi.fn((coords: number[][][]) => ({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: coords },
  })),
}));

import PlotGeometryEditor from './PlotGeometryEditor';
import type { FieldPlot } from '@/types/farm';

const PLOT: FieldPlot = {
  id: 'plot-1',
  farmId: 'farm-1',
  registrationId: null,
  name: 'Talhão Norte',
  code: 'TN-01',
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

describe('PlotGeometryEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with plot name in title', () => {
    render(
      <PlotGeometryEditor
        plot={PLOT}
        plotBoundary={POLYGON}
        farmBoundary={null}
        otherPlots={[]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/Editando: Talhão Norte/)).toBeDefined();
  });

  it('should show area badge', () => {
    render(
      <PlotGeometryEditor
        plot={PLOT}
        plotBoundary={POLYGON}
        farmBoundary={null}
        otherPlots={[]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Área:')).toBeDefined();
  });

  it('should call onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <PlotGeometryEditor
        plot={PLOT}
        plotBoundary={POLYGON}
        farmBoundary={null}
        otherPlots={[]}
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('should call onSave when save button is clicked', () => {
    const onSave = vi.fn();
    render(
      <PlotGeometryEditor
        plot={PLOT}
        plotBoundary={POLYGON}
        farmBoundary={null}
        otherPlots={[]}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Salvar'));
    expect(onSave).toHaveBeenCalledOnce();
  });
});
