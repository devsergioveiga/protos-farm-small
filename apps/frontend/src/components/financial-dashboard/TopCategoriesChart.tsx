import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { PieLabelRenderProps } from 'recharts';

interface TopCategoriesChartProps {
  data: Array<{
    category: string;
    categoryLabel: string;
    total: number;
    percentage: number;
  }>;
}

const COLORS = [
  'var(--color-primary-400)',
  'var(--color-sun-500)',
  'var(--color-sky-500)',
  'var(--color-earth-500)',
  'var(--color-neutral-400)',
];

function formatCurrencyTooltip(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderCustomLabel(props: PieLabelRenderProps) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  if (
    percent === undefined ||
    percent < 0.1 ||
    cx === undefined ||
    cy === undefined ||
    midAngle === undefined ||
    innerRadius === undefined ||
    outerRadius === undefined
  ) {
    return null;
  }
  const cxNum = typeof cx === 'string' ? parseFloat(cx) : cx;
  const cyNum = typeof cy === 'string' ? parseFloat(cy) : cy;
  const irNum = typeof innerRadius === 'string' ? parseFloat(innerRadius) : innerRadius;
  const orNum = typeof outerRadius === 'string' ? parseFloat(outerRadius) : outerRadius;

  const RADIAN = Math.PI / 180;
  const radius = irNum + (orNum - irNum) * 0.5;
  const x = cxNum + radius * Math.cos(-midAngle * RADIAN);
  const y = cyNum + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontFamily="'Source Sans 3', system-ui, sans-serif"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default function TopCategoriesChart({ data }: TopCategoriesChartProps) {
  return (
    <div aria-label="Grafico de pizza: top 5 categorias de despesa">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="categoryLabel"
            cx="50%"
            cy="45%"
            outerRadius={90}
            labelLine={false}
            label={renderCustomLabel}
          >
            {data.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(
              value: number | string | (string | number)[] | undefined,
              name: string | undefined,
            ) => [
              typeof value === 'number' ? formatCurrencyTooltip(value) : String(value ?? ''),
              name ?? '',
            ]}
          />
          <Legend
            formatter={(value: string) => (
              <span
                style={{
                  fontFamily: "'Source Sans 3', system-ui, sans-serif",
                  fontSize: 12,
                  color: 'var(--color-neutral-700)',
                }}
              >
                {value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
