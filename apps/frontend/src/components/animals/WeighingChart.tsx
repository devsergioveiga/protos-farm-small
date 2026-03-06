import React, { Suspense } from 'react';
import type { WeighingItem } from '@/types/animal';
import './WeighingChart.css';

const LazyLineChart = React.lazy(() =>
  import('recharts').then((mod) => ({ default: mod.LineChart })),
);
const LazyLine = React.lazy(() => import('recharts').then((mod) => ({ default: mod.Line })));
const LazyXAxis = React.lazy(() => import('recharts').then((mod) => ({ default: mod.XAxis })));
const LazyYAxis = React.lazy(() => import('recharts').then((mod) => ({ default: mod.YAxis })));
const LazyTooltip = React.lazy(() => import('recharts').then((mod) => ({ default: mod.Tooltip })));
const LazyResponsiveContainer = React.lazy(() =>
  import('recharts').then((mod) => ({ default: mod.ResponsiveContainer })),
);
const LazyReferenceLine = React.lazy(() =>
  import('recharts').then((mod) => ({ default: mod.ReferenceLine })),
);
const LazyCartesianGrid = React.lazy(() =>
  import('recharts').then((mod) => ({ default: mod.CartesianGrid })),
);

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

function WeighingChartInner({ weighings, entryWeightKg }: WeighingChartProps) {
  const sortedData = [...weighings]
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
    .map((w) => ({
      date: new Date(w.measuredAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      }),
      peso: w.weightKg,
      ecc: w.bodyConditionScore,
    }));

  if (sortedData.length === 0) return null;

  const weights = sortedData.map((d) => d.peso);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const padding = Math.max(20, (maxWeight - minWeight) * 0.15);
  const yMin = Math.floor(minWeight - padding);
  const yMax = Math.ceil(maxWeight + padding);

  return (
    <Suspense fallback={<ChartSkeleton />}>
      <LazyResponsiveContainer width="100%" height={300}>
        <LazyLineChart data={sortedData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <LazyCartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-200)" />
          <LazyXAxis
            dataKey="date"
            tick={{ fontSize: 12, fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
            stroke="var(--color-neutral-400)"
          />
          <LazyYAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
            stroke="var(--color-neutral-400)"
            unit=" kg"
          />
          <LazyTooltip
            contentStyle={{
              fontFamily: "'Source Sans 3', system-ui, sans-serif",
              fontSize: '0.875rem',
              borderRadius: 8,
              border: '1px solid var(--color-neutral-200)',
            }}
            formatter={(value: number) => [`${value} kg`, 'Peso']}
          />
          {entryWeightKg != null && (
            <LazyReferenceLine
              y={entryWeightKg}
              stroke="var(--color-neutral-400)"
              strokeDasharray="4 4"
              label={{
                value: `Entrada: ${entryWeightKg} kg`,
                position: 'insideTopRight',
                fontSize: 11,
                fill: 'var(--color-neutral-500)',
                fontFamily: "'Source Sans 3', system-ui, sans-serif",
              }}
            />
          )}
          <LazyLine
            type="monotone"
            dataKey="peso"
            stroke="var(--color-primary-600)"
            strokeWidth={2}
            dot={{ r: 4, fill: 'var(--color-primary-600)' }}
            activeDot={{ r: 6, fill: 'var(--color-primary-600)' }}
          />
        </LazyLineChart>
      </LazyResponsiveContainer>
    </Suspense>
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
          <WeighingChartInner weighings={weighings} entryWeightKg={entryWeightKg} />
        </Suspense>
      </div>
    </section>
  );
}

export default WeighingChart;
