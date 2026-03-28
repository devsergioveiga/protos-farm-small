import {
  Clock,
  Loader2,
  Calculator,
  Lock,
  AlertCircle,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import './PayrollRunStatusBadge.css';

type StatusKey =
  | 'PENDING'
  | 'PROCESSING'
  | 'CALCULATED'
  | 'COMPLETED'
  | 'ERROR'
  | 'REVERTED'
  | 'PENDING_TIMESHEET';

interface StatusConfig {
  label: string;
  icon: React.ReactNode;
  cssClass: string;
}

const STATUS_CONFIG: Record<StatusKey, StatusConfig> = {
  PENDING: {
    label: 'Pendente',
    icon: <Clock size={14} aria-hidden="true" />,
    cssClass: 'payroll-status-badge--pending',
  },
  PROCESSING: {
    label: 'Processando',
    icon: <Loader2 size={14} aria-hidden="true" className="payroll-status-badge__spinner" />,
    cssClass: 'payroll-status-badge--processing',
  },
  CALCULATED: {
    label: 'Calculado',
    icon: <Calculator size={14} aria-hidden="true" />,
    cssClass: 'payroll-status-badge--calculated',
  },
  COMPLETED: {
    label: 'Fechado',
    icon: <Lock size={14} aria-hidden="true" />,
    cssClass: 'payroll-status-badge--completed',
  },
  ERROR: {
    label: 'Erro',
    icon: <AlertCircle size={14} aria-hidden="true" />,
    cssClass: 'payroll-status-badge--error',
  },
  REVERTED: {
    label: 'Estornado',
    icon: <RotateCcw size={14} aria-hidden="true" />,
    cssClass: 'payroll-status-badge--reverted',
  },
  PENDING_TIMESHEET: {
    label: 'Sem Espelho',
    icon: <AlertTriangle size={14} aria-hidden="true" />,
    cssClass: 'payroll-status-badge--pending-timesheet',
  },
};

interface PayrollRunStatusBadgeProps {
  status: string;
}

export default function PayrollRunStatusBadge({ status }: PayrollRunStatusBadgeProps) {
  const config = STATUS_CONFIG[status as StatusKey] ?? {
    label: status,
    icon: <Clock size={14} aria-hidden="true" />,
    cssClass: 'payroll-status-badge--pending',
  };

  return (
    <span className={`payroll-status-badge ${config.cssClass}`}>
      {config.icon}
      {config.label}
    </span>
  );
}
