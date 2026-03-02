import { useMemo } from 'react';
import { formatArea } from './FarmMap';
import type { FarmMapData } from '@/hooks/useFarmMap';
import './PlotSummaryBar.css';

type PlotBoundary = FarmMapData['plotBoundaries'][number];

interface PlotSummaryBarProps {
  plotBoundaries: PlotBoundary[];
  farmTotalAreaHa: number;
}

function PlotSummaryBar({ plotBoundaries, farmTotalAreaHa }: PlotSummaryBarProps) {
  const summary = useMemo(() => {
    let totalPlotArea = 0;
    for (const pb of plotBoundaries) {
      totalPlotArea += pb.plot.boundaryAreaHa ?? 0;
    }
    const unmapped = Math.max(0, farmTotalAreaHa - totalPlotArea);
    return {
      count: plotBoundaries.length,
      mappedArea: totalPlotArea,
      unmappedArea: unmapped,
    };
  }, [plotBoundaries, farmTotalAreaHa]);

  if (summary.count === 0) return null;

  return (
    <div className="plot-summary-bar" role="status" aria-label="Resumo de talhões">
      <span className="plot-summary-bar__text">
        <strong>{summary.count}</strong> talhões
        {' · '}
        <span className="plot-summary-bar__mono">{formatArea(summary.mappedArea)}</span> mapeados
        {summary.unmappedArea > 0 && (
          <>
            {' · '}
            <span className="plot-summary-bar__mono">{formatArea(summary.unmappedArea)}</span> sem
            talhão
          </>
        )}
      </span>
    </div>
  );
}

export default PlotSummaryBar;
