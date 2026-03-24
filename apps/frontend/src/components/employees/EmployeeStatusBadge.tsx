import { CheckCircle, Clock, Umbrella, XCircle } from 'lucide-react';
import type { EmployeeStatus } from '@/types/employee';

interface EmployeeStatusBadgeProps {
  status: EmployeeStatus;
}

const STATUS_CONFIG: Record<
  EmployeeStatus,
  { icon: React.ElementType; label: string; colorVar: string; bgVar: string }
> = {
  ATIVO: {
    icon: CheckCircle,
    label: 'Ativo',
    // --color-success-500 = #2E7D32 per design tokens
    colorVar: 'var(--color-success-700, #1B5E20)',
    bgVar: 'var(--color-success-50, #E8F5E9)',
  },
  AFASTADO: {
    icon: Clock,
    label: 'Afastado',
    colorVar: 'var(--color-warning-700, #E65100)',
    bgVar: 'var(--color-warning-50, #FFF3E0)',
  },
  FERIAS: {
    icon: Umbrella,
    label: 'Férias',
    colorVar: 'var(--color-info-700, #01579B)',
    bgVar: 'var(--color-info-50, #E1F5FE)',
  },
  DESLIGADO: {
    icon: XCircle,
    label: 'Desligado',
    colorVar: 'var(--color-neutral-600, #7A7267)',
    bgVar: 'var(--color-neutral-100, #F5F3EF)',
  },
};

export default function EmployeeStatusBadge({ status }: EmployeeStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '12px',
        backgroundColor: config.bgVar,
        color: config.colorVar,
        fontFamily: "'Source Sans 3', system-ui, sans-serif",
        fontSize: '0.8125rem',
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={14} aria-hidden="true" />
      {config.label}
    </span>
  );
}
