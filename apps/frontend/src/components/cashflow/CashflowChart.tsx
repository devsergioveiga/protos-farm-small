import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import type { ProjectionPoint } from '@/hooks/useCashflow';

// ─── Compact BRL formatter ────────────────────────────────────────────

export function formatBRLCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000) {
    const formatted = (abs / 1_000_000).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `${sign}R$ ${formatted}M`;
  }

  if (abs >= 1_000) {
    const formatted = (abs / 1_000).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    return `${sign}R$ ${formatted}k`;
  }

  return `${sign}R$ ${abs.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Custom tooltip ───────────────────────────────────────────────────

interface CashflowTooltipPayload {
  label?: string;
  payload?: Array<{
    payload: ProjectionPoint;
  }>;
}

function CashflowTooltip({
  label,
  payload,
}: TooltipProps<number, string> & CashflowTooltipPayload) {
  if (!payload || payload.length === 0) return null;

  const point = payload[0]?.payload as ProjectionPoint | undefined;
  if (!point) return null;

  const isNegative = point.balanceRealistic < 0;

  return (
    <div
      style={{
        background: 'var(--color-neutral-0, #ffffff)',
        border: '1px solid var(--color-neutral-200, #e8e4dd)',
        borderRadius: 'var(--radius-md, 8px)',
        padding: '12px 16px',
        boxShadow: 'var(--shadow-lg)',
        fontFamily: "'Source Sans 3', system-ui, sans-serif",
        minWidth: '220px',
      }}
    >
      <p
        style={{
          fontFamily: "'Source Sans 3', system-ui, sans-serif",
          fontWeight: 600,
          fontSize: '14px',
          color: 'var(--color-neutral-800, #2a2520)',
          margin: '0 0 8px 0',
        }}
      >
        {label ?? point.label}
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td
              style={{
                fontSize: '13px',
                color: 'var(--color-neutral-600, #5c554c)',
                paddingBottom: '4px',
              }}
            >
              Saldo realista:
            </td>
            <td
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '13px',
                color: isNegative
                  ? 'var(--color-error-500, #c62828)'
                  : 'var(--color-neutral-800, #2a2520)',
                textAlign: 'right',
                paddingBottom: '4px',
              }}
            >
              {formatBRL(point.balanceRealistic)}
            </td>
          </tr>
          <tr>
            <td
              style={{
                fontSize: '13px',
                color: 'var(--color-neutral-600, #5c554c)',
                paddingBottom: '4px',
              }}
            >
              Entradas previstas:
            </td>
            <td
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '13px',
                color: 'var(--color-neutral-800, #2a2520)',
                textAlign: 'right',
                paddingBottom: '4px',
              }}
            >
              {formatBRL(point.inflows)}
            </td>
          </tr>
          <tr>
            <td
              style={{
                fontSize: '13px',
                color: 'var(--color-neutral-600, #5c554c)',
                paddingBottom: '4px',
              }}
            >
              Saidas previstas:
            </td>
            <td
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '13px',
                color: 'var(--color-neutral-800, #2a2520)',
                textAlign: 'right',
                paddingBottom: '4px',
              }}
            >
              {formatBRL(point.outflows)}
            </td>
          </tr>
          <tr>
            <td style={{ fontSize: '13px', color: 'var(--color-neutral-600, #5c554c)' }}>
              Cheques pendentes:
            </td>
            <td
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '13px',
                color: 'var(--color-neutral-800, #2a2520)',
                textAlign: 'right',
              }}
            >
              {formatBRL(point.checksPending)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Chart component ──────────────────────────────────────────────────

interface CashflowChartProps {
  data: ProjectionPoint[];
}

export default function CashflowChart({ data }: CashflowChartProps) {
  return (
    <div aria-label="Grafico de projecao de fluxo de caixa por cenario">
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E8E4DE" />

          <XAxis
            dataKey="label"
            tick={{
              fontFamily: "'Source Sans 3', system-ui, sans-serif",
              fontSize: 12,
              fill: 'var(--color-neutral-500)',
            }}
          />

          <YAxis
            tickFormatter={formatBRLCompact}
            tick={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              fill: 'var(--color-neutral-500)',
            }}
          />

          <Tooltip content={<CashflowTooltip />} />

          <Legend
            formatter={(value: string) => {
              if (value === 'balanceRealistic') return 'Realista';
              if (value === 'balanceOptimistic') return 'Otimista';
              if (value === 'balancePessimistic') return 'Pessimista';
              return value;
            }}
            wrapperStyle={{
              fontFamily: "'Source Sans 3', system-ui, sans-serif",
              fontSize: '13px',
            }}
          />

          {/* Reference line at y=0 (risk zone) */}
          <ReferenceLine y={0} stroke="#C62828" strokeWidth={2} />

          {/* Realista: area */}
          <Area
            type="monotone"
            dataKey="balanceRealistic"
            name="balanceRealistic"
            stroke="#2E7D32"
            fill="#C8E6C9"
            fillOpacity={0.4}
            strokeWidth={2}
            dot={false}
          />

          {/* Otimista: dashed line */}
          <Line
            type="monotone"
            dataKey="balanceOptimistic"
            name="balanceOptimistic"
            stroke="#2E7D32"
            strokeDasharray="5 5"
            strokeWidth={1.5}
            dot={false}
          />

          {/* Pessimista: dashed line in red */}
          <Line
            type="monotone"
            dataKey="balancePessimistic"
            name="balancePessimistic"
            stroke="#C62828"
            strokeDasharray="5 5"
            strokeWidth={1.5}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
