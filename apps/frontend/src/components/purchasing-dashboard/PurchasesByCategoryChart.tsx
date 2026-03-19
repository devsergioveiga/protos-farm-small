import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PurchasesByCategoryChartProps {
  data: { category: string; totalValue: number }[];
}

const COLORS = [
  '#2E7D32', // primary green
  '#1565C0', // info blue
  '#F59E0B', // sun amber
  '#C62828', // error red
  '#6B7280', // neutral gray
  '#7C3AED', // violet
  '#0891B2', // sky cyan
  '#D97706', // warm amber
];

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export default function PurchasesByCategoryChart({ data }: PurchasesByCategoryChartProps) {
  return (
    <figure style={{ margin: 0 }}>
      <figcaption className="sr-only">Compras por categoria</figcaption>
      <div aria-label="Grafico de rosca: distribuicao de compras por categoria">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              dataKey="totalValue"
              nameKey="category"
              cx="50%"
              cy="45%"
              innerRadius="60%"
              outerRadius="80%"
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
    </figure>
  );
}
