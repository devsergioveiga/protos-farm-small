import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PlotSoilTable from './PlotSoilTable';
import type { SoilAnalysisItem } from '@/types/farm';

const ANALYSIS: SoilAnalysisItem = {
  id: 'a1',
  plotId: 'plot-1',
  farmId: 'farm-1',
  analysisDate: '2024-08-15',
  labName: 'Lab MT',
  sampleDepthCm: '0-20',
  phH2o: 5.8,
  organicMatterPct: 3.2,
  phosphorusMgDm3: 12.5,
  potassiumMgDm3: 85,
  calciumCmolcDm3: 4.2,
  magnesiumCmolcDm3: 1.8,
  aluminumCmolcDm3: 0.1,
  ctcCmolcDm3: 8.5,
  baseSaturationPct: 62,
  sulfurMgDm3: 8,
  clayContentPct: 45,
  notes: null,
  createdBy: 'user-1',
  createdAt: '2025-01-01T00:00:00.000Z',
};

describe('PlotSoilTable', () => {
  it('should render empty state when no analyses', () => {
    render(<PlotSoilTable analyses={[]} />);
    expect(screen.getByText('Nenhuma análise de solo registrada ainda.')).toBeDefined();
  });

  it('should render table with analysis data', () => {
    render(<PlotSoilTable analyses={[ANALYSIS]} />);
    expect(screen.getAllByLabelText('Análises de solo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('15/08/2024').length).toBeGreaterThan(0);
  });

  it('should render pH column header', () => {
    render(<PlotSoilTable analyses={[ANALYSIS]} />);
    const headers = screen.getAllByRole('columnheader');
    const phHeader = headers.find((h) => h.textContent === 'pH');
    expect(phHeader).toBeDefined();
  });

  it('should render multiple analyses with delta arrows', () => {
    const older: SoilAnalysisItem = {
      ...ANALYSIS,
      id: 'a2',
      analysisDate: '2023-08-10',
      phH2o: 5.4,
      baseSaturationPct: 55,
    };
    render(<PlotSoilTable analyses={[ANALYSIS, older]} />);
    const rows = screen.getAllByRole('row');
    // header + 2 data rows
    expect(rows.length).toBe(3);
  });
});
