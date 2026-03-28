import { ArrowUp, ArrowDown } from 'lucide-react';
import type { DashboardKpiCard } from '@/types/financial-statements';

interface AccountingKpiCardProps extends DashboardKpiCard {
  icon?: React.ReactNode;
}

export default function AccountingKpiCard({
  label,
  value,
  deltaPercent,
  deltaDirection,
  icon,
}: AccountingKpiCardProps) {
  return (
    <article className="acc-kpi-card">
      {icon && (
        <div className="acc-kpi-card__icon" aria-hidden="true">
          {icon}
        </div>
      )}
      <div className="acc-kpi-card__label">{label}</div>
      <div className="acc-kpi-card__value" aria-label={`${label}: ${value}`}>
        {value}
      </div>
      {deltaPercent !== null && (
        <div
          className={`acc-kpi-card__delta acc-kpi-card__delta--${deltaDirection}`}
          aria-label={
            deltaDirection === 'up'
              ? `Aumento de ${deltaPercent} em relacao ao periodo anterior`
              : deltaDirection === 'down'
                ? `Reducao de ${deltaPercent} em relacao ao periodo anterior`
                : `Sem variacao significativa`
          }
        >
          {deltaDirection === 'up' && <ArrowUp size={12} aria-hidden="true" />}
          {deltaDirection === 'down' && <ArrowDown size={12} aria-hidden="true" />}
          <span>{deltaPercent}</span>
        </div>
      )}
    </article>
  );
}
