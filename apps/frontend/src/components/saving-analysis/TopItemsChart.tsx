import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface TopItem {
  name: string;
  value: number;
  rank: number;
}

interface TopItemsChartProps {
  items: TopItem[];
  label: string;
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatYAxis(v: number): string {
  if (v >= 1000000) {
    return `R$${(v / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`;
  }
  if (v >= 1000) {
    return `R$${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`;
  }
  return `R$${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

function truncateName(name: string, max = 18): string {
  if (name.length <= max) return name;
  return `${name.substring(0, max)}…`;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: TopItem }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  if (!item) return null;

  return (
    <div
      style={{
        background: 'var(--color-neutral-800)',
        color: 'var(--color-neutral-0)',
        padding: '10px 14px',
        borderRadius: 8,
        fontFamily: "'Source Sans 3', system-ui, sans-serif",
        fontSize: '0.875rem',
        lineHeight: 1.6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        maxWidth: 200,
      }}
    >
      <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace" }}>{formatBRL(item.value)}</div>
    </div>
  );
}

export default function TopItemsChart({ items, label }: TopItemsChartProps) {
  if (items.length === 0) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--color-neutral-500)',
          fontFamily: "'Source Sans 3', system-ui, sans-serif",
        }}
      >
        Nenhum {label.toLowerCase()} no período.
      </div>
    );
  }

  const chartData = items.map((item) => ({
    ...item,
    shortName: truncateName(item.name),
  }));

  return (
    <div aria-label={`Gráfico de barras: top ${label}`}>
      <ResponsiveContainer width="100%" height={Math.max(items.length * 40, 200)}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-neutral-200)"
            horizontal={false}
          />
          <XAxis
            type="number"
            tickFormatter={formatYAxis}
            tick={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              fill: 'var(--color-neutral-500)',
            }}
          />
          <YAxis
            type="category"
            dataKey="shortName"
            width={110}
            tick={{
              fontFamily: "'Source Sans 3', system-ui, sans-serif",
              fontSize: 12,
              fill: 'var(--color-neutral-700)',
            }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-neutral-50)' }} />
          <Bar dataKey="value" name={label} radius={[0, 4, 4, 0]}>
            {chartData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={index === 0 ? 'var(--color-primary-600)' : 'var(--color-primary-400)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
