import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PlotSummaryBar from './PlotSummaryBar';
import type { FarmMapData } from '@/hooks/useFarmMap';

type PlotBoundary = FarmMapData['plotBoundaries'][number];

function makePlotBoundary(areaHa: number): PlotBoundary {
  const id = Math.random().toString(36).slice(2);
  return {
    plotId: id,
    plot: {
      id,
      farmId: 'farm-1',
      registrationId: null,
      name: `Talhão ${id}`,
      code: null,
      soilType: null,
      currentCrop: null,
      previousCrop: null,
      notes: null,
      boundaryAreaHa: areaHa,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00Z',
    },
    boundary: {
      hasBoundary: true,
      boundaryAreaHa: areaHa,
      boundaryGeoJSON: null,
    },
  };
}

describe('PlotSummaryBar', () => {
  it('should show total count and mapped area', () => {
    const plots = [makePlotBoundary(30), makePlotBoundary(20)];
    render(<PlotSummaryBar plotBoundaries={plots} farmTotalAreaHa={100} />);

    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText(/mapeados/)).toBeDefined();
  });

  it('should calculate unmapped area correctly', () => {
    const plots = [makePlotBoundary(30), makePlotBoundary(20)];
    render(<PlotSummaryBar plotBoundaries={plots} farmTotalAreaHa={100} />);

    // 100 - 50 = 50 ha unmapped
    expect(screen.getByText(/sem talhão/)).toBeDefined();
  });

  it('should not render when there are no plots', () => {
    const { container } = render(<PlotSummaryBar plotBoundaries={[]} farmTotalAreaHa={100} />);
    expect(container.innerHTML).toBe('');
  });
});
