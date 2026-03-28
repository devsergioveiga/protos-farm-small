import {
  CheckCircle,
  Clock,
  Umbrella,
  XCircle,
  TrendingUp,
  Award,
  ArrowRightLeft,
  Briefcase,
} from 'lucide-react';
import type { TimelineEntry } from '@/hooks/useEmployeeMovements';

interface HistoryTabProps {
  timeline: TimelineEntry[];
  isLoading: boolean;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  // Status changes
  STATUS_ATIVO: CheckCircle,
  STATUS_AFASTADO: Clock,
  STATUS_FERIAS: Umbrella,
  STATUS_DESLIGADO: XCircle,
  // Movements
  SALARY_ADJUSTMENT: TrendingUp,
  PROMOTION: Award,
  TRANSFER: ArrowRightLeft,
  POSITION_CHANGE: Briefcase,
};

const TYPE_COLORS: Record<string, { icon: string; bg: string }> = {
  STATUS_ATIVO: {
    icon: 'var(--color-success-700, #1B5E20)',
    bg: 'var(--color-success-50, #E8F5E9)',
  },
  STATUS_AFASTADO: {
    icon: 'var(--color-warning-700, #E65100)',
    bg: 'var(--color-warning-50, #FFF3E0)',
  },
  STATUS_FERIAS: { icon: 'var(--color-info-700, #01579B)', bg: 'var(--color-info-50, #E1F5FE)' },
  STATUS_DESLIGADO: {
    icon: 'var(--color-neutral-600, #7A7267)',
    bg: 'var(--color-neutral-100, #F5F3EF)',
  },
  SALARY_ADJUSTMENT: {
    icon: 'var(--color-primary-700, #1B5E20)',
    bg: 'var(--color-primary-50, #E8F5E9)',
  },
  PROMOTION: { icon: 'var(--color-primary-700, #1B5E20)', bg: 'var(--color-primary-50, #E8F5E9)' },
  TRANSFER: { icon: 'var(--color-primary-600, #2E7D32)', bg: 'var(--color-primary-50, #E8F5E9)' },
  POSITION_CHANGE: {
    icon: 'var(--color-primary-600, #2E7D32)',
    bg: 'var(--color-primary-50, #E8F5E9)',
  },
};

const DEFAULT_COLOR = {
  icon: 'var(--color-neutral-600, #7A7267)',
  bg: 'var(--color-neutral-100, #F5F3EF)',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default function HistoryTab({ timeline, isLoading }: HistoryTabProps) {
  if (isLoading) {
    return (
      <div className="employee-detail__tab-content">
        <div className="employee-detail__skeleton" style={{ height: 200, marginTop: 8 }} />
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="employee-detail__tab-content">
        <div className="employee-detail__empty-state">
          <CheckCircle size={48} aria-hidden="true" color="var(--color-neutral-400)" />
          <p className="employee-detail__empty-title">Nenhuma movimentação registrada ainda.</p>
          <p className="employee-detail__empty-desc">
            Mudanças de status e movimentações salariais aparecerão aqui.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="employee-detail__tab-content">
      <section className="employee-detail__section">
        <h3 className="employee-detail__section-title">Linha do Tempo</h3>
        <ol className="employee-detail__timeline" aria-label="Histórico do colaborador">
          {timeline.map((entry, idx) => {
            const Icon = TYPE_ICONS[entry.type] ?? CheckCircle;
            const colors = TYPE_COLORS[entry.type] ?? DEFAULT_COLOR;

            return (
              <li key={idx} className="employee-detail__timeline-item">
                <div
                  className="employee-detail__timeline-icon"
                  style={{ background: colors.bg }}
                  aria-hidden="true"
                >
                  <Icon size={16} color={colors.icon} />
                </div>
                <div className="employee-detail__timeline-body">
                  <div className="employee-detail__timeline-date">{formatDate(entry.date)}</div>
                  <div className="employee-detail__timeline-label">{entry.description}</div>
                  {entry.details && Object.keys(entry.details).length > 0 && (
                    <ul className="employee-detail__amendment-changes">
                      {Object.entries(entry.details).map(([key, value]) => (
                        <li key={key}>
                          <strong>{key}:</strong> {String(value)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
