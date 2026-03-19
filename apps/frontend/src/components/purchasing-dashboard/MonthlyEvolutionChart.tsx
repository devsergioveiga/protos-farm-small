import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Dot,
} from 'recharts';

interface MonthlyEvolutionChartProps {
  data: { month: string; totalValue: number }[];
}

const MONTH_ABBR: Record<string, string> = {
  '01': 'Jan',
  '02': 'Fev',
  '03': 'Mar',
  '04': 'Abr',
  '05': 'Mai',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Ago',
  '09': 'Set',
  '10': 'Out',
  '11': 'Nov',
  '12': 'Dez',
};

function formatMonthLabel(month: string): string {
  // Expects YYYY-MM format
  const parts = month.split('-');
  const monthNum = parts[1] ?? '';
  return MONTH_ABBR[monthNum] ?? month;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export default function MonthlyEvolutionChart({ data }: MonthlyEvolutionChartProps) {
  const transformed = data.map((item) => ({
    ...item,
    label: formatMonthLabel(item.month),
  }));

  return (
    <figure style={{ margin: 0 }}>
      <figcaption className="sr-only">Evolucao mensal (12 meses)</figcaption>
      <div aria-label="Grafico de linha: evolucao mensal do volume de compras">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={transformed} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-200)" />
            <XAxis
              dataKey="label"
              tick={{
                fontFamily: "'Source Sans 3', system-ui, sans-serif",
                fontSize: 12,
                fill: 'var(--color-neutral-500)',
              }}
            />
            <YAxis
              tick={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                fill: 'var(--color-neutral-500)',
              }}
              tickFormatter={(v: number) =>
                v >= 1000
                  ? `R$${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`
                  : `R$${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
              }
            />
            <Tooltip
              formatter={(
                value: number | string | (string | number)[] | undefined,
                name: string | undefined,
              ) => [
                typeof value === 'number' ? formatBRL(value) : String(value ?? ''),
                name === 'totalValue' ? 'Total' : (name ?? ''),
              ]}
            />
            <Line
              type="monotone"
              dataKey="totalValue"
              name="totalValue"
              stroke="#2E7D32"
              strokeWidth={2}
              dot={<Dot r={4} fill="#2E7D32" />}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
