import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import type { WeighingItem } from '@/types/animal';

interface WeighingChartInnerProps {
  weighings: WeighingItem[];
  entryWeightKg: number | null;
}

function WeighingChartInner({ weighings, entryWeightKg }: WeighingChartInnerProps) {
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
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={sortedData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-200)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
          stroke="var(--color-neutral-400)"
        />
        <YAxis
          domain={[yMin, yMax]}
          tick={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}
          stroke="var(--color-neutral-400)"
          unit=" kg"
        />
        <Tooltip
          contentStyle={{
            fontFamily: "'Source Sans 3', system-ui, sans-serif",
            fontSize: '0.875rem',
            borderRadius: 8,
            border: '1px solid var(--color-neutral-200)',
          }}
          formatter={(value) => [`${value} kg`, 'Peso']}
        />
        {entryWeightKg != null && (
          <ReferenceLine
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
        <Line
          type="monotone"
          dataKey="peso"
          stroke="var(--color-primary-600)"
          strokeWidth={2}
          dot={{ r: 4, fill: 'var(--color-primary-600)' }}
          activeDot={{ r: 6, fill: 'var(--color-primary-600)' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default WeighingChartInner;
