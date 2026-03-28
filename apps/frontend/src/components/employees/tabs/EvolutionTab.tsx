import { TrendingUp, Award, ArrowRightLeft, Briefcase } from 'lucide-react';
import SalaryEvolutionChart from '../SalaryEvolutionChart';
import type { EmployeeMovement } from '@/hooks/useEmployeeMovements';

interface EvolutionTabProps {
  employeeId: string;
  movements: EmployeeMovement[];
  isMovementsLoading: boolean;
}

const MOVEMENT_ICONS: Record<string, React.ElementType> = {
  SALARY_ADJUSTMENT: TrendingUp,
  PROMOTION: Award,
  TRANSFER: ArrowRightLeft,
  POSITION_CHANGE: Briefcase,
};

const MOVEMENT_LABELS: Record<string, string> = {
  SALARY_ADJUSTMENT: 'Reajuste salarial',
  PROMOTION: 'Promoção',
  TRANSFER: 'Transferência',
  POSITION_CHANGE: 'Mudança de cargo',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatBRL(value: unknown): string {
  if (typeof value === 'number') {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }
  if (typeof value === 'string') {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
    }
  }
  return String(value ?? '—');
}

export default function EvolutionTab({
  employeeId,
  movements,
  isMovementsLoading,
}: EvolutionTabProps) {
  return (
    <div className="employee-detail__tab-content">
      {/* Chart */}
      <section className="employee-detail__section">
        <h3 className="employee-detail__section-title">Evolução Salarial</h3>
        <div style={{ marginTop: 16 }}>
          <SalaryEvolutionChart employeeId={employeeId} height={240} />
        </div>
      </section>

      {/* Timeline */}
      <section className="employee-detail__section">
        <h3 className="employee-detail__section-title">Histórico de Movimentações</h3>

        {isMovementsLoading ? (
          <div className="employee-detail__skeleton" style={{ height: 120, marginTop: 16 }} />
        ) : movements.length === 0 ? (
          <div className="employee-detail__empty-state" style={{ paddingTop: 24 }}>
            <TrendingUp size={48} aria-hidden="true" color="var(--color-neutral-400)" />
            <p className="employee-detail__empty-title">
              Nenhum reajuste registrado. O histórico aparecerá aqui.
            </p>
          </div>
        ) : (
          <ol className="employee-detail__timeline" aria-label="Histórico de movimentações">
            {movements.map((mv) => {
              const Icon = MOVEMENT_ICONS[mv.movementType] ?? TrendingUp;
              const label = MOVEMENT_LABELS[mv.movementType] ?? mv.movementType;

              return (
                <li key={mv.id} className="employee-detail__timeline-item">
                  <div
                    className="employee-detail__timeline-icon"
                    style={{ background: 'var(--color-primary-50, #E8F5E9)' }}
                    aria-hidden="true"
                  >
                    <Icon size={16} color="var(--color-primary-700, #1B5E20)" />
                  </div>
                  <div className="employee-detail__timeline-body">
                    <div className="employee-detail__timeline-date">
                      {formatDate(mv.effectiveAt)}
                    </div>
                    <div className="employee-detail__timeline-label">{label}</div>
                    {mv.reason && (
                      <div className="employee-detail__timeline-reason">{mv.reason}</div>
                    )}
                    {mv.fromValue !== undefined && mv.toValue !== undefined && (
                      <div className="employee-detail__timeline-change">
                        <span className="employee-detail__mono">{formatBRL(mv.fromValue)}</span>
                        {' → '}
                        <span className="employee-detail__mono">{formatBRL(mv.toValue)}</span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
