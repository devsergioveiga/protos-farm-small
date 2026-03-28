import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { MonthlyRevenueExpense } from '@/types/financial-statements';

interface RevenueExpenseLineChartProps {
  data: MonthlyRevenueExpense[];
}

const MONTH_ABBR: Record<number, string> = {
  1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun',
  7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez',
};

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function RevenueExpenseLineChart({ data }: RevenueExpenseLineChartProps) {
  const chartData = data.map((item) => ({
    label: MONTH_ABBR[item.month] ?? String(item.month),
    receita: parseFloat(item.receita),
    despesa: parseFloat(item.despesa),
  }));

  return (
    <div aria-label="Grafico de linha: receita e despesa nos ultimos 12 meses">
      <ResponsiveContainer width="100%" height={288}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
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
              fontSize: 11,
              fill: 'var(--color-neutral-500)',
            }}
            tickFormatter={(v: number) =>
              v >= 1000
                ? `R$${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k`
                : `R$${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
            }
          />
          <Tooltip
            formatter={(value: number | string | (string | number)[] | undefined, name: string | undefined) => [
              typeof value === 'number' ? formatBRL(value) : String(value ?? ''),
              (name ?? '') === 'receita' ? 'Receita' : 'Despesa',
            ]}
          />
          <Legend formatter={(value: string) => (value === 'receita' ? 'Receita' : 'Despesa')} />
          <Line
            type="monotone"
            dataKey="receita"
            name="receita"
            stroke="#2E7D32"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="despesa"
            name="despesa"
            stroke="#C62828"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
