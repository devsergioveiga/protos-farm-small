import type { LucideIcon } from 'lucide-react';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  label: string;
  value: number;
  icon: LucideIcon;
  suffix?: string;
  borderColor?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SafetyKpiCard({ label, value, icon: Icon, suffix, borderColor }: Props) {
  return (
    <div
      className="safety-kpi-card"
      style={
        borderColor
          ? { borderLeftColor: borderColor, borderLeftWidth: '4px', borderLeftStyle: 'solid' }
          : undefined
      }
    >
      <div className="safety-kpi-card__icon">
        <Icon size={24} aria-hidden="true" />
      </div>
      <div className="safety-kpi-card__content">
        <span className="safety-kpi-card__value">
          {value.toLocaleString('pt-BR')}
          {suffix || ''}
        </span>
        <span className="safety-kpi-card__label">{label}</span>
      </div>
    </div>
  );
}

export default SafetyKpiCard;
