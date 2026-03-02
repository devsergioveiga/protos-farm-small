import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import CropLegend from './CropLegend';
import type { FarmMapData } from '@/hooks/useFarmMap';

type PlotBoundary = FarmMapData['plotBoundaries'][number];

function makePlotBoundary(
  overrides: Partial<{ name: string; currentCrop: string | null; boundaryAreaHa: number }> = {},
): PlotBoundary {
  const id = Math.random().toString(36).slice(2);
  return {
    plotId: id,
    plot: {
      id,
      farmId: 'farm-1',
      registrationId: null,
      name: overrides.name ?? 'Talhão A',
      code: null,
      soilType: null,
      currentCrop: overrides.currentCrop ?? null,
      previousCrop: null,
      notes: null,
      boundaryAreaHa: overrides.boundaryAreaHa ?? 10,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00Z',
    },
    boundary: {
      hasBoundary: true,
      boundaryAreaHa: overrides.boundaryAreaHa ?? 10,
      boundaryGeoJSON: null,
    },
  };
}

const PLOT_BOUNDARIES: PlotBoundary[] = [
  makePlotBoundary({ name: 'Talhão 1', currentCrop: 'Soja', boundaryAreaHa: 50 }),
  makePlotBoundary({ name: 'Talhão 2', currentCrop: 'Soja', boundaryAreaHa: 30 }),
  makePlotBoundary({ name: 'Talhão 3', currentCrop: 'Milho', boundaryAreaHa: 20 }),
  makePlotBoundary({ name: 'Talhão 4', currentCrop: null, boundaryAreaHa: 10 }),
];

describe('CropLegend', () => {
  it('should render legend with cultures present in data', () => {
    render(
      <CropLegend plotBoundaries={PLOT_BOUNDARIES} cropFilter={new Set()} onToggleCrop={vi.fn()} />,
    );

    expect(screen.getByText('Culturas')).toBeDefined();
    expect(screen.getByText('Soja')).toBeDefined();
    expect(screen.getByText('Milho')).toBeDefined();
  });

  it('should group correctly and show count + area', () => {
    render(
      <CropLegend plotBoundaries={PLOT_BOUNDARIES} cropFilter={new Set()} onToggleCrop={vi.fn()} />,
    );

    // Soja: 2 plots
    const sojaButton = screen.getByLabelText('Filtrar por Soja');
    expect(sojaButton.textContent).toContain('2');

    // Total line
    expect(screen.getByText(/4 talhões/)).toBeDefined();
  });

  it('should show "Sem cultura" for plots without currentCrop', () => {
    render(
      <CropLegend plotBoundaries={PLOT_BOUNDARIES} cropFilter={new Set()} onToggleCrop={vi.fn()} />,
    );

    expect(screen.getByText('Sem cultura')).toBeDefined();
  });

  it('should call onToggleCrop when item is clicked', () => {
    const onToggleCrop = vi.fn();
    render(
      <CropLegend
        plotBoundaries={PLOT_BOUNDARIES}
        cropFilter={new Set()}
        onToggleCrop={onToggleCrop}
      />,
    );

    fireEvent.click(screen.getByLabelText('Filtrar por Soja'));
    expect(onToggleCrop).toHaveBeenCalledWith('soja');
  });
});
