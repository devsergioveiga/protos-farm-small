import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { LegendPayload } from 'recharts';

interface PayrollCompositionChartProps {
  data: Array<{ label: string; amount: number; percentage: number }>;
}

// Chart palette per UI-SPEC
const COLORS = [
  'var(--color-primary-500)',
  'var(--color-sun-500)',
  'var(--color-sky-500)',
  'var(--color-earth-500)',
  'var(--color-neutral-400)',
];

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function legendFormatter(value: string, entry: LegendPayload) {
  // entry.payload is typed as { value?: any; strokeDasharray?: ... } — cast to access percentage
  const payload = entry.payload as { percentage?: number } | undefined;
  const pct = payload?.percentage;
  const pctStr = pct !== undefined ? ` (${pct.toFixed(1)}%)` : '';
  return (
    <span
      style={{
        fontFamily: "'Source Sans 3', system-ui, sans-serif",
        fontSize: 12,
        color: 'var(--color-neutral-700)',
      }}
    >
      {value}
      {pctStr}
    </span>
  );
}

export default function PayrollCompositionChart({ data }: PayrollCompositionChartProps) {
  return (
    <div aria-label="Gráfico de pizza: composição da folha de pagamento" role="img">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="label"
            cx="50%"
            cy="45%"
            outerRadius={90}
            labelLine={false}
          >
            {data.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(
              value: number | string | (string | number)[] | undefined,
              name: string | undefined,
            ) => [typeof value === 'number' ? formatBRL(value) : String(value ?? ''), name ?? '']}
            contentStyle={{
              fontFamily: "'Source Sans 3', system-ui, sans-serif",
              fontSize: 13,
              borderRadius: 6,
              border: '1px solid var(--color-neutral-200)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          />
          <Legend formatter={legendFormatter} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
