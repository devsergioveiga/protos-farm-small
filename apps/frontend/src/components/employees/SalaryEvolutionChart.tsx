import { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import type { SalaryHistoryPoint } from '@/types/employee';

// ─── Formatter helpers ────────────────────────────────────────────────

function formatMonthYear(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', { month: '2-digit', year: 'numeric' }).format(
    new Date(dateStr),
  );
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// ─── Custom Tooltip ──────────────────────────────────────────────────

interface SalaryTooltipPayload {
  payload?: Array<{ payload: SalaryHistoryPoint & { formattedDate?: string } }>;
}

function SalaryTooltip({ payload }: TooltipProps<number, string> & SalaryTooltipPayload) {
  if (!payload || payload.length === 0) return null;
  const point = payload[0]?.payload as (SalaryHistoryPoint & { formattedDate?: string }) | undefined;
  if (!point) return null;

  return (
    <div
      style={{
        background: 'var(--color-neutral-0, #fff)',
        border: '1px solid var(--color-neutral-200, #E8E4DD)',
        borderRadius: 8,
        padding: '10px 14px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        minWidth: 160,
      }}
    >
      <p
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.875rem',
          fontWeight: 400,
          color: 'var(--color-neutral-800, #2A2520)',
          margin: '0 0 4px',
        }}
      >
        {formatBRL(point.salary)}
      </p>
      <p
        style={{
          fontFamily: "'Source Sans 3', system-ui, sans-serif",
          fontSize: '0.75rem',
          color: 'var(--color-neutral-500, #9E968C)',
          margin: '0 0 2px',
        }}
      >
        {point.formattedDate ?? formatMonthYear(point.effectiveAt)}
      </p>
      {point.reason && (
        <p
          style={{
            fontFamily: "'Source Sans 3', system-ui, sans-serif",
            fontSize: '0.75rem',
            color: 'var(--color-neutral-600, #7A7267)',
            margin: 0,
          }}
        >
          {point.reason}
        </p>
      )}
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      style={{
        width: '100%',
        height,
        borderRadius: 8,
        background: 'var(--color-neutral-100, #F5F3EF)',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
      aria-hidden="true"
    />
  );
}

// ─── Empty state ─────────────────────────────────────────────────────

function ChartEmpty({ height }: { height: number }) {
  return (
    <div
      style={{
        width: '100%',
        height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        color: 'var(--color-neutral-400, #C4BDB5)',
      }}
    >
      <TrendingUp size={48} aria-hidden="true" />
      <p
        style={{
          fontFamily: "'Source Sans 3', system-ui, sans-serif",
          fontSize: '0.9375rem',
          color: 'var(--color-neutral-500, #9E968C)',
          textAlign: 'center',
          margin: 0,
        }}
      >
        Nenhum reajuste registrado. O histórico aparecerá aqui.
      </p>
    </div>
  );
}

// ─── Props & Component ────────────────────────────────────────────────

interface SalaryEvolutionChartProps {
  employeeId: string;
  height?: number;
}

interface ChartDataPoint extends SalaryHistoryPoint {
  formattedDate: string;
}

export default function SalaryEvolutionChart({
  employeeId,
  height = 240,
}: SalaryEvolutionChartProps) {
  const { user } = useAuth();
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    const orgId = user?.organizationId;
    if (!orgId || !employeeId) {
      setData([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await api.get<SalaryHistoryPoint[]>(
        `/org/${orgId}/employees/${employeeId}/salary-history`,
      );
      setData(
        result.map((pt) => ({
          ...pt,
          formattedDate: formatMonthYear(pt.effectiveAt),
        })),
      );
    } catch {
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.organizationId, employeeId]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  if (isLoading) return <ChartSkeleton height={height} />;
  if (data.length === 0) return <ChartEmpty height={height} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-neutral-200, #E8E4DD)"
          vertical={false}
        />
        <XAxis
          dataKey="formattedDate"
          tick={{
            fontFamily: "'Source Sans 3', system-ui, sans-serif",
            fontSize: 12,
            fill: 'var(--color-neutral-500, #9E968C)',
          }}
          axisLine={{ stroke: 'var(--color-neutral-200, #E8E4DD)' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatBRL}
          tick={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            fill: 'var(--color-neutral-500, #9E968C)',
          }}
          axisLine={false}
          tickLine={false}
          width={90}
        />
        <Tooltip content={<SalaryTooltip />} />
        <Line
          type="monotone"
          dataKey="salary"
          stroke="var(--color-primary-600, #2E7D32)"
          strokeWidth={2}
          dot={{ r: 4, fill: 'var(--color-primary-600, #2E7D32)', strokeWidth: 0 }}
          activeDot={{ r: 6, fill: 'var(--color-primary-600, #2E7D32)', strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
