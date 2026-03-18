import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { usePriceHistory } from '@/hooks/useSavingAnalysis';
import type { SavingAnalysisParams } from '@/hooks/useSavingAnalysis';

interface PriceHistoryChartProps {
  productId: string;
  params?: SavingAnalysisParams;
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatYAxis(v: number): string {
  if (v >= 1000) {
    return `R$${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
  }
  return `R$${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      date: string;
      price: number;
      poNumber: string;
      supplierName: string;
    };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

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
      }}
    >
      <div style={{ fontWeight: 600 }}>{formatBRL(d.price)}</div>
      <div style={{ color: 'var(--color-neutral-300)' }}>
        {new Date(d.date).toLocaleDateString('pt-BR')}
      </div>
      {d.poNumber && <div style={{ color: 'var(--color-neutral-300)' }}>OC #{d.poNumber}</div>}
      {d.supplierName && <div style={{ color: 'var(--color-neutral-300)' }}>{d.supplierName}</div>}
    </div>
  );
}

export default function PriceHistoryChart({ productId, params = {} }: PriceHistoryChartProps) {
  const { history, isLoading, error } = usePriceHistory(productId, params);

  if (isLoading) {
    return (
      <div
        style={{
          height: 300,
          background:
            'linear-gradient(90deg, var(--color-neutral-100) 25%, var(--color-neutral-200) 50%, var(--color-neutral-100) 75%)',
          backgroundSize: '200% 100%',
          animation: 'skeleton-pulse 1.5s infinite',
          borderRadius: 8,
        }}
        aria-label="Carregando histórico de preços"
      />
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--color-error-600)',
          fontFamily: "'Source Sans 3', system-ui, sans-serif",
        }}
      >
        Não foi possível carregar o histórico de preços.
      </div>
    );
  }

  if (!history || history.points.length === 0) {
    return (
      <div
        style={{
          padding: '32px',
          textAlign: 'center',
          color: 'var(--color-neutral-500)',
          fontFamily: "'Source Sans 3', system-ui, sans-serif",
          fontSize: '0.9375rem',
        }}
      >
        Nenhum histórico de preço disponível para este produto no período.
      </div>
    );
  }

  return (
    <div aria-label={`Histórico de preços: ${history.productName}`}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={history.points} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-200)" />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) =>
              new Date(d).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
            }
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
              fontSize: 12,
              fill: 'var(--color-neutral-500)',
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="price"
            stroke="var(--color-primary-600)"
            strokeWidth={2}
            dot={{ fill: 'var(--color-primary-600)', r: 4 }}
            activeDot={{ r: 6, fill: 'var(--color-primary-700)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
