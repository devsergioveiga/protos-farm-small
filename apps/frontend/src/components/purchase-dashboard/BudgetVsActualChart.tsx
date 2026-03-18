import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { BudgetVsActualPoint } from '@/hooks/usePurchaseDashboard';

interface Props {
  data: BudgetVsActualPoint[];
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatYAxis(v: number): string {
  if (v >= 1000000) {
    return `R$${(v / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`;
  }
  if (v >= 1000) {
    return `R$${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
  }
  return `R$${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

export default function BudgetVsActualChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div
        style={{
          height: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-neutral-500)',
          fontFamily: "'Source Sans 3', system-ui, sans-serif",
          fontSize: '0.9375rem',
        }}
      >
        Nenhum dado de orcamento vs realizado no periodo.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
          tickFormatter={formatYAxis}
          tick={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            fill: 'var(--color-neutral-500)',
          }}
        />
        <Tooltip
          formatter={(v) => [formatBRL(v as number)]}
          labelStyle={{ fontFamily: "'Source Sans 3', system-ui, sans-serif" }}
          contentStyle={{
            background: 'var(--color-neutral-800)',
            color: 'var(--color-neutral-0)',
            border: 'none',
            borderRadius: 8,
            fontFamily: "'Source Sans 3', system-ui, sans-serif",
            fontSize: '0.875rem',
          }}
        />
        <Legend
          wrapperStyle={{
            fontFamily: "'Source Sans 3', system-ui, sans-serif",
            fontSize: '0.8125rem',
          }}
        />
        <Bar dataKey="budget" fill="#2E7D32" name="Orcamento" radius={[4, 4, 0, 0]} />
        <Bar dataKey="actual" fill="#F57C00" name="Realizado" radius={[4, 4, 0, 0]} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
