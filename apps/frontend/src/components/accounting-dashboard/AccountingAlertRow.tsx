import { AlertTriangle, Info, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AccountingAlert } from '@/types/financial-statements';

type AccountingAlertRowProps = AccountingAlert;

export default function AccountingAlertRow({
  label,
  count,
  navigateTo,
  severity,
}: AccountingAlertRowProps) {
  return (
    <li className="acc-alert-row">
      <Link to={navigateTo} className="acc-alert-row__link" aria-label={`${label} — ${count} item(s). Clique para ver detalhes.`}>
        <span
          className={`acc-alert-row__icon acc-alert-row__icon--${severity}`}
          aria-hidden="true"
        >
          {severity === 'warning' ? (
            <AlertTriangle size={20} />
          ) : (
            <Info size={20} />
          )}
        </span>
        <span className="acc-alert-row__content">
          <span className="acc-alert-row__label">{label}</span>
          <span className="acc-alert-row__count">{count}</span>
        </span>
        <ChevronRight size={16} className="acc-alert-row__chevron" aria-hidden="true" />
      </Link>
    </li>
  );
}
