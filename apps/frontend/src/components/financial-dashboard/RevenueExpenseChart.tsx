import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface RevenueExpenseChartProps {
  data: Array<{ yearMonth: string; revenues: number; expenses: number }>;
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

function formatMonthLabel(yearMonth: string): string {
  const parts = yearMonth.split('-');
  const monthNum = parts[1] ?? '';
  return MONTH_ABBR[monthNum] ?? yearMonth;
}

function formatCurrencyTooltip(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const chartData = (data: RevenueExpenseChartProps['data']) =>
  data.map((item) => ({
    ...item,
    label: formatMonthLabel(item.yearMonth),
  }));

export default function RevenueExpenseChart({ data }: RevenueExpenseChartProps) {
  const transformed = chartData(data);

  return (
    <div aria-label="Grafico de barras: receitas e despesas por mes">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={transformed} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
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
              typeof value === 'number' ? formatCurrencyTooltip(value) : String(value ?? ''),
              (name ?? '') === 'revenues' ? 'Receitas' : 'Despesas',
            ]}
          />
          <Legend formatter={(value: string) => (value === 'revenues' ? 'Receitas' : 'Despesas')} />
          <Bar
            dataKey="revenues"
            name="revenues"
            fill="var(--color-primary-600)"
            radius={[2, 2, 0, 0]}
          />
          <Bar
            dataKey="expenses"
            name="expenses"
            fill="var(--color-neutral-400)"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
