import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import './DepreciationProjectionChart.css';

// ─── Types ─────────────────────────────────────────────────────────────────

interface DepreciationProjectionChartProps {
  data: {
    year: number;
    month: number;
    projectedDepreciation: number;
    cumulativeDepreciation: number;
    remainingBookValue: number;
  }[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const compactFmt = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  compactDisplay: 'short',
  style: 'currency',
  currency: 'BRL',
});

const fullFmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatXAxis(item: { year: number; month: number }): string {
  return `${MONTH_ABBR[item.month - 1]}/${String(item.year).slice(-2)}`;
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid var(--color-neutral-200)',
        borderRadius: 'var(--radius-sm, 6px)',
        padding: '12px 16px',
        fontFamily: "'Source Sans 3', system-ui, sans-serif",
        fontSize: 14,
      }}
    >
      <p style={{ margin: '0 0 8px', fontWeight: 600, color: 'var(--color-neutral-800)' }}>
        {label}
      </p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ margin: '4px 0', color: entry.color }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {fullFmt.format(entry.value)}
          </span>
          {' '}
          <span style={{ color: 'var(--color-neutral-500)', fontSize: 12 }}>{entry.name}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function DepreciationProjectionChart({ data }: DepreciationProjectionChartProps) {
  const chartData = data.map((row) => ({
    ...row,
    label: formatXAxis(row),
  }));

  return (
    <figure className="depr-projection-chart">
      <figcaption className="sr-only">
        Projecao de depreciacao para os proximos meses
      </figcaption>
      <div className="depr-projection-chart__container">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-200)" />
            <XAxis
              dataKey="label"
              tick={{ fontFamily: "'Source Sans 3', system-ui, sans-serif", fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => compactFmt.format(v)}
              tick={{ fontFamily: "'Source Sans 3', system-ui, sans-serif", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{
                fontFamily: "'Source Sans 3', system-ui, sans-serif",
                fontSize: 14,
                paddingTop: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="projectedDepreciation"
              name="Depreciacao Mensal Projetada"
              stroke="#2E7D32"
              fill="#2E7D32"
              fillOpacity={0.1}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="remainingBookValue"
              name="Valor Liquido Acumulado"
              stroke="#0288D1"
              strokeDasharray="5 5"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
