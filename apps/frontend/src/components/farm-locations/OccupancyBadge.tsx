import type { OccupancyLevel } from '@/types/farm-location';

interface OccupancyBadgeProps {
  occupancyPercent: number | null;
  level: OccupancyLevel;
}

const LEVEL_COLORS: Record<OccupancyLevel, string> = {
  green: 'var(--color-primary-600)',
  yellow: '#FFA000',
  red: 'var(--color-error-500)',
};

const LEVEL_LABELS: Record<OccupancyLevel, string> = {
  green: 'Ocupação normal',
  yellow: 'Ocupação moderada',
  red: 'Ocupação alta',
};

function OccupancyBadge({ occupancyPercent, level }: OccupancyBadgeProps) {
  if (occupancyPercent == null) return null;

  const color = LEVEL_COLORS[level];
  const label = `${LEVEL_LABELS[level]}: ${occupancyPercent}%`;

  return (
    <span
      className="occupancy-badge"
      aria-label={label}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: color,
          display: 'inline-block',
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
        {occupancyPercent}%
      </span>
    </span>
  );
}

export default OccupancyBadge;
