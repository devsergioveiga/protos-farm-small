import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { CostCompositionItem } from '@/types/financial-statements';

interface CostCompositionChartProps {
  data: CostCompositionItem[];
}

const COLORS = [
  'var(--color-primary-600)',    // #2E7D32
  'var(--color-sun-500)',        // #F9A825
  'var(--color-sky-500)',        // #0288D1
  'var(--color-earth-500)',      // #8D6E63
  'var(--color-neutral-400)',    // #A8A196
];

const COLORS_HEX = [
  '#2E7D32',
  '#F9A825',
  '#0288D1',
  '#8D6E63',
  '#A8A196',
];

function formatBRL(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface TooltipEntry {
  name: string;
  value: number;
  payload: { percent: string };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div
      style={{
        background: 'var(--color-neutral-0)',
        border: '1px solid var(--color-neutral-200)',
        borderRadius: 4,
        padding: '8px 12px',
        fontFamily: 'var(--font-body)',
        fontSize: '0.875rem',
      }}
    >
      <div style={{ fontWeight: 600, color: 'var(--color-neutral-700)' }}>{entry.name}</div>
      <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-neutral-800)' }}>
        {formatBRL(String(entry.value))}
      </div>
      <div style={{ color: 'var(--color-neutral-500)', fontSize: '0.75rem' }}>
        {entry.payload.percent}%
      </div>
    </div>
  );
}

export default function CostCompositionChart({ data }: CostCompositionChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        role="img"
        aria-label="Composicao de custos por natureza"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 248,
          color: 'var(--color-neutral-400)',
          fontFamily: 'var(--font-body)',
          fontSize: '0.875rem',
        }}
      >
        Sem dados de composicao de custos
      </div>
    );
  }

  const chartData = data.map((item) => ({
    name: item.label,
    value: parseFloat(item.value),
    percent: item.percent,
  }));

  return (
    <div
      role="img"
      aria-label="Composicao de custos por natureza"
      style={{ width: '100%', height: 248 }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            dataKey="value"
          >
            {chartData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS_HEX[index % COLORS_HEX.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.75rem',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
