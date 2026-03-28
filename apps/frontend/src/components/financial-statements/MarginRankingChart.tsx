import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { MarginRankingItem } from '@/types/financial-statements';

interface MarginRankingChartProps {
  data: MarginRankingItem[];
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface TooltipPayload {
  payload?: MarginRankingItem & { marginPercentNum: number };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;
  return (
    <div
      style={{
        background: 'var(--color-neutral-0)',
        border: '1px solid var(--color-neutral-200)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        fontFamily: 'var(--font-body)',
        fontSize: '13px',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div style={{ fontWeight: 600, color: 'var(--color-neutral-800)', marginBottom: 6 }}>
        {item.costCenterName}
      </div>
      <div style={{ color: 'var(--color-neutral-600)', lineHeight: 1.6 }}>
        <div>
          Receita:{' '}
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-neutral-800)' }}>
            {formatBRL(parseFloat(item.revenue))}
          </span>
        </div>
        <div>
          CPV:{' '}
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-neutral-800)' }}>
            {formatBRL(parseFloat(item.cpv))}
          </span>
        </div>
        <div>
          Margem:{' '}
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary-600)', fontWeight: 600 }}>
            {item.marginPercentNum.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export default function MarginRankingChart({ data }: MarginRankingChartProps) {
  const sortedData = [...data]
    .map((item) => ({
      ...item,
      marginPercentNum: parseFloat(item.marginPercent),
    }))
    .sort((a, b) => b.marginPercentNum - a.marginPercentNum);

  const chartHeight = Math.max(sortedData.length * 36 + 40, 120);

  return (
    <div
      style={{
        background: 'var(--color-neutral-0)',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--color-neutral-200)',
        marginTop: 'var(--space-6)',
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '16px',
          fontWeight: 500,
          color: 'var(--color-neutral-800)',
          margin: '0 0 var(--space-4) 0',
        }}
      >
        Ranking por Margem Bruta
      </h2>

      {/* Accessible data table (visually hidden) */}
      <table className="sr-only" aria-label="Dados do ranking por margem bruta">
        <caption>Ranking por Margem Bruta — dados em tabela acessivel</caption>
        <thead>
          <tr>
            <th scope="col">Centro de Custo</th>
            <th scope="col">Receita</th>
            <th scope="col">CPV</th>
            <th scope="col">Margem Bruta</th>
            <th scope="col">% Margem</th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((item) => (
            <tr key={item.costCenterId}>
              <td>{item.costCenterName}</td>
              <td>{formatBRL(parseFloat(item.revenue))}</td>
              <td>{formatBRL(parseFloat(item.cpv))}</td>
              <td>{formatBRL(parseFloat(item.grossMargin))}</td>
              <td>{item.marginPercentNum.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart layout="vertical" data={sortedData} margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
            <XAxis
              type="number"
              tickFormatter={(v: number) => `${v.toFixed(1)}%`}
              tick={{ fontFamily: 'var(--font-mono)', fontSize: 11, fill: 'var(--color-neutral-500)' }}
              axisLine={{ stroke: 'var(--color-neutral-200)' }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="costCenterName"
              width={140}
              tick={{ fontFamily: 'var(--font-body)', fontSize: 12, fill: 'var(--color-neutral-700)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="marginPercentNum"
              fill="var(--color-primary-400)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
