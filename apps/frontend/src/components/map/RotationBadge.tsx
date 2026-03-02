import { RefreshCw } from 'lucide-react';
import type { RotationIndicator } from '@/types/farm';
import './RotationBadge.css';

interface RotationBadgeProps {
  rotation: RotationIndicator;
}

const LEVEL_CLASSES: Record<number, string> = {
  0: 'rotation-badge--none',
  1: 'rotation-badge--mono',
  2: 'rotation-badge--simple',
  3: 'rotation-badge--diverse',
};

function RotationBadge({ rotation }: RotationBadgeProps) {
  const levelClass = LEVEL_CLASSES[rotation.level] ?? 'rotation-badge--none';

  return (
    <div
      className={`rotation-badge ${levelClass}`}
      title={rotation.description}
      role="status"
      aria-label={`Rotação: ${rotation.label}`}
    >
      <RefreshCw size={16} aria-hidden="true" />
      <span className="rotation-badge__label">{rotation.label}</span>
    </div>
  );
}

export default RotationBadge;
