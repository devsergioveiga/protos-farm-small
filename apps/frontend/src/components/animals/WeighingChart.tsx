import React, { Suspense } from 'react';
import type { WeighingItem } from '@/types/animal';
import './WeighingChart.css';

const LazyChartInner = React.lazy(() => import('./WeighingChartInner'));

interface WeighingChartProps {
  weighings: WeighingItem[];
  entryWeightKg: number | null;
}

function ChartSkeleton() {
  return (
    <div className="weighing-chart__skeleton" aria-label="Carregando gráfico...">
      <div className="weighing-chart__skeleton-bar" />
    </div>
  );
}

function WeighingChart({ weighings, entryWeightKg }: WeighingChartProps) {
  if (weighings.length === 0) return null;

  return (
    <section className="weighing-chart" aria-labelledby="weighing-chart-title">
      <h3 className="weighing-chart__title" id="weighing-chart-title">
        Evolução de peso
      </h3>
      <div className="weighing-chart__container">
        <Suspense fallback={<ChartSkeleton />}>
          <LazyChartInner weighings={weighings} entryWeightKg={entryWeightKg} />
        </Suspense>
      </div>
    </section>
  );
}

export default WeighingChart;
