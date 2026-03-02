import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PlotSeasonTimeline from './PlotSeasonTimeline';
import type { CropSeasonItem } from '@/types/farm';

const SEASON: CropSeasonItem = {
  id: 's1',
  plotId: 'plot-1',
  farmId: 'farm-1',
  seasonType: 'SAFRA',
  seasonYear: '2024/2025',
  crop: 'Soja',
  varietyName: 'TMG 2381',
  startDate: '2024-10-15',
  endDate: '2025-02-28',
  plantedAreaHa: 100,
  productivityKgHa: 3600,
  totalProductionKg: 360000,
  operations: [],
  notes: 'Boa safra',
  createdBy: 'user-1',
  createdAt: '2025-01-01T00:00:00.000Z',
};

describe('PlotSeasonTimeline', () => {
  it('should render empty state when no seasons', () => {
    render(<PlotSeasonTimeline seasons={[]} />);
    expect(screen.getByText('Nenhuma safra registrada ainda.')).toBeDefined();
  });

  it('should render season crop and year', () => {
    render(<PlotSeasonTimeline seasons={[SEASON]} />);
    expect(screen.getByText('Soja')).toBeDefined();
    expect(screen.getByText(/Safra 2024\/2025/)).toBeDefined();
  });

  it('should render variety name', () => {
    render(<PlotSeasonTimeline seasons={[SEASON]} />);
    expect(screen.getByText('TMG 2381')).toBeDefined();
  });

  it('should render productivity data', () => {
    render(<PlotSeasonTimeline seasons={[SEASON]} />);
    expect(screen.getByText(/3\.600/)).toBeDefined();
    expect(screen.getByText(/kg\/ha/)).toBeDefined();
  });

  it('should render notes', () => {
    render(<PlotSeasonTimeline seasons={[SEASON]} />);
    expect(screen.getByText('Boa safra')).toBeDefined();
  });

  it('should render multiple seasons', () => {
    const seasons: CropSeasonItem[] = [
      SEASON,
      { ...SEASON, id: 's2', crop: 'Milho', seasonType: 'SAFRINHA', seasonYear: '2024' },
    ];
    render(<PlotSeasonTimeline seasons={seasons} />);
    expect(screen.getByText('Soja')).toBeDefined();
    expect(screen.getByText('Milho')).toBeDefined();
  });
});
