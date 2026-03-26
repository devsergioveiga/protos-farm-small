import { CheckCircle, AlertTriangle, AlertCircle, Clock } from 'lucide-react';
import type { ComplianceAlertLevel } from '@/types/safety';

// ─── Config ──────────────────────────────────────────────────────────────────

interface BadgeConfig {
  label: string;
  icon: React.ElementType;
  bg: string;
  color: string;
}

const CONFIG: Record<ComplianceAlertLevel, BadgeConfig> = {
  OK: {
    label: 'Conforme',
    icon: CheckCircle,
    bg: 'var(--color-success-100)',
    color: 'var(--color-success-500)',
  },
  YELLOW: {
    label: 'Vencendo em breve',
    icon: AlertTriangle,
    bg: 'var(--color-warning-100)',
    color: 'var(--color-warning-500)',
  },
  RED: {
    label: 'Vencendo em 15 dias',
    icon: AlertCircle,
    bg: 'var(--color-error-100)',
    color: 'var(--color-error-500)',
  },
  EXPIRED: {
    label: 'Vencido',
    icon: Clock,
    bg: 'var(--color-neutral-200)',
    color: 'var(--color-neutral-600)',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  status: ComplianceAlertLevel;
}

export function ComplianceStatusBadge({ status }: Props) {
  const { label, icon: Icon, bg, color } = CONFIG[status];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '12px',
        backgroundColor: bg,
        color,
        fontSize: '14px',
        fontWeight: 600,
        fontFamily: "'Source Sans 3', system-ui, sans-serif",
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  );
}

export default ComplianceStatusBadge;
