import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface PayrollCostTrendChartProps {
  data: Array<{ yearMonth: string; gross: number; net: number; charges: number }>;
}

const PT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function abbreviateYearMonth(yearMonth: string): string {
  // Format: "2025-03" → "Mar"
  const parts = yearMonth.split('-');
  if (parts.length === 2) {
    const monthIndex = parseInt(parts[1], 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return PT_MONTHS[monthIndex];
    }
  }
  return yearMonth;
}

function formatBRLShort(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}k`;
  }
  return `R$ ${value.toFixed(0)}`;
}

function formatBRLFull(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PayrollCostTrendChart({ data }: PayrollCostTrendChartProps) {
  const chartData = data.map((item) => ({
    ...item,
    monthLabel: abbreviateYearMonth(item.yearMonth),
  }));

  return (
    <div
      aria-label="Gráfico de barras: tendência de custo da folha nos últimos 12 meses"
      role="img"
    >
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-200)" vertical={false} />
          <XAxis
            dataKey="monthLabel"
            tick={{
              fontFamily: "'Source Sans 3', system-ui, sans-serif",
              fontSize: 12,
              fill: 'var(--color-neutral-600)',
            }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatBRLShort}
            tick={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              fill: 'var(--color-neutral-600)',
            }}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <Tooltip
            formatter={(
              value: number | string | (string | number)[] | undefined,
              name: string | undefined,
            ) => [
              typeof value === 'number' ? formatBRLFull(value) : String(value ?? ''),
              name ?? '',
            ]}
            labelStyle={{
              fontFamily: "'Source Sans 3', system-ui, sans-serif",
              fontSize: 13,
              color: 'var(--color-neutral-800)',
            }}
            contentStyle={{
              fontFamily: "'Source Sans 3', system-ui, sans-serif",
              fontSize: 13,
              borderRadius: 6,
              border: '1px solid var(--color-neutral-200)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          />
          <Legend
            wrapperStyle={{
              fontFamily: "'Source Sans 3', system-ui, sans-serif",
              fontSize: 13,
              color: 'var(--color-neutral-700)',
              paddingTop: 8,
            }}
          />
          <Bar dataKey="gross" name="Bruto" stackId="a" fill="var(--color-primary-600)" radius={0} />
          <Bar dataKey="net" name="Líquido" stackId="a" fill="var(--color-primary-400)" radius={0} />
          <Bar
            dataKey="charges"
            name="Encargos"
            stackId="a"
            fill="var(--color-sky-500)"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
