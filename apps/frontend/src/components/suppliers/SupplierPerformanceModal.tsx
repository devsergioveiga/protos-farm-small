import { useState, useMemo } from 'react';
import { X, Star, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useSupplierPerformance } from '@/hooks/useSupplierPerformance';
import './SupplierPerformanceModal.css';

type PeriodPreset = 'month' | 'quarter' | 'year' | 'all';

const PERIOD_LABELS: Record<PeriodPreset, string> = {
  month: 'Ultimo mes',
  quarter: 'Trimestre',
  year: 'Ano',
  all: 'Todos',
};

const CRITERIA_LABELS: Record<string, string> = {
  deadline: 'Prazo de Entrega',
  quality: 'Qualidade do Produto',
  price: 'Preco',
  service: 'Atendimento',
};

interface SupplierPerformanceModalProps {
  isOpen: boolean;
  supplierId: string;
  supplierName: string;
  onClose: () => void;
  onRateClick: () => void;
}

function getDateRange(preset: PeriodPreset): { startDate?: string; endDate?: string } {
  if (preset === 'all') return {};
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  let start: Date;
  if (preset === 'month') {
    start = new Date(now);
    start.setMonth(start.getMonth() - 1);
  } else if (preset === 'quarter') {
    start = new Date(now);
    start.setMonth(start.getMonth() - 3);
  } else {
    start = new Date(now);
    start.setFullYear(start.getFullYear() - 1);
  }
  return { startDate: start.toISOString().slice(0, 10), endDate: end };
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

function SupplierPerformanceContent({
  supplierId,
  supplierName,
  onClose,
  onRateClick,
}: Omit<SupplierPerformanceModalProps, 'isOpen'>) {
  const [period, setPeriod] = useState<PeriodPreset>('all');
  const { startDate, endDate } = useMemo(() => getDateRange(period), [period]);
  const { data, isLoading, error } = useSupplierPerformance(supplierId, startDate, endDate);

  const chartData = useMemo(
    () => (data?.history ?? []).map((p) => ({ ...p, dateLabel: formatDateLabel(p.date) })),
    [data],
  );

  return (
    <div className="sp-modal__overlay" onClick={onClose}>
      <div
        className="sp-modal__container"
        role="dialog"
        aria-modal="true"
        aria-label={`Performance de ${supplierName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sp-modal__header">
          <div className="sp-modal__header-left">
            <TrendingUp size={24} aria-hidden="true" />
            <h2 className="sp-modal__title">Performance — {supplierName}</h2>
          </div>
          <button type="button" className="sp-modal__close" aria-label="Fechar" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="sp-modal__body">
          {/* Period filter bar */}
          <div className="sp-period-bar" role="group" aria-label="Filtro de periodo">
            {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`sp-period-btn ${period === key ? 'sp-period-btn--active' : ''}`}
                onClick={() => setPeriod(key)}
                aria-pressed={period === key}
              >
                {PERIOD_LABELS[key]}
              </button>
            ))}
          </div>

          {/* Loading skeleton */}
          {isLoading && (
            <div className="sp-skeleton" aria-label="Carregando dados de performance">
              <div className="sp-skeleton__bar" style={{ width: '80%' }} />
              <div className="sp-skeleton__bar" style={{ width: '60%' }} />
              <div className="sp-skeleton__bar" style={{ width: '90%' }} />
            </div>
          )}

          {/* Error state */}
          {!isLoading && error && (
            <div className="sp-error" role="alert">
              <p>{error}</p>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && data && data.totalRatings === 0 && (
            <div className="sp-empty">
              <Star size={48} aria-hidden="true" className="sp-empty__icon" />
              <h3 className="sp-empty__heading">Nenhuma avaliacao neste periodo</h3>
              <p className="sp-empty__body">
                Registre avaliacoes apos cada entrega para acompanhar a performance deste
                fornecedor.
              </p>
              <button type="button" className="sp-empty__cta" onClick={onRateClick}>
                Avaliar fornecedor
              </button>
            </div>
          )}

          {/* Chart + breakdown */}
          {!isLoading && !error && data && data.totalRatings > 0 && (
            <>
              {/* Rating Trend Chart */}
              <section>
                <h3 className="sp-section-title">Evolucao da Nota</h3>
                <figure>
                  <figcaption className="sr-only">
                    Evolucao da nota do fornecedor ao longo do tempo
                  </figcaption>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-neutral-200, #E8E4DD)"
                      />
                      <XAxis
                        dataKey="dateLabel"
                        tick={{
                          fontSize: 12,
                          fontFamily: "'Source Sans 3', system-ui, sans-serif",
                          fill: 'var(--color-neutral-500, #7A7267)',
                        }}
                      />
                      <YAxis
                        domain={[1, 5]}
                        ticks={[1, 2, 3, 4, 5]}
                        tick={{
                          fontSize: 12,
                          fontFamily: "'JetBrains Mono', monospace",
                          fill: 'var(--color-neutral-500, #7A7267)',
                        }}
                      />
                      <Tooltip
                        formatter={(value: number | undefined) => [
                          value != null ? `Nota: ${value.toFixed(1)}` : '',
                          '',
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="average"
                        stroke="#2E7D32"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </figure>
              </section>

              {/* Criteria Breakdown */}
              <section>
                <h3 className="sp-section-title sp-section-title--breakdown">Nota por Criterio</h3>
                <div className="sp-criteria">
                  {(['deadline', 'quality', 'price', 'service'] as const).map((key) => {
                    const value = data.breakdown[key];
                    return (
                      <div className="sp-criteria-row" key={key}>
                        <span className="sp-criteria-label">{CRITERIA_LABELS[key]}</span>
                        <div
                          className="sp-criteria-bar-track"
                          role="meter"
                          aria-valuenow={value}
                          aria-valuemin={1}
                          aria-valuemax={5}
                          aria-label={`${CRITERIA_LABELS[key]}: ${value.toFixed(1)} de 5`}
                        >
                          <div
                            className="sp-criteria-bar-fill"
                            style={{ width: `${((value - 1) / 4) * 100}%` }}
                          />
                        </div>
                        <span className="sp-criteria-value">{value.toFixed(1)}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SupplierPerformanceModal(props: SupplierPerformanceModalProps) {
  if (!props.isOpen) return null;
  return <SupplierPerformanceContent {...props} />;
}
