import { AlertTriangle } from 'lucide-react';
import { useFarmLimit } from '@/hooks/useFarmLimit';
import './FarmLimitBadge.css';

function FarmLimitBadge() {
  const { limit } = useFarmLimit();

  if (!limit) return null;

  const getStatusClass = () => {
    if (limit.blocked) return 'farm-limit-badge--blocked';
    if (limit.warning) return 'farm-limit-badge--warning';
    return 'farm-limit-badge--ok';
  };

  return (
    <div
      className={`farm-limit-badge ${getStatusClass()}`}
      role="status"
      aria-label={`${limit.current} de ${limit.max} fazendas cadastradas${limit.blocked ? ', limite atingido' : limit.warning ? ', próximo do limite' : ''}`}
    >
      {limit.blocked && <AlertTriangle aria-hidden="true" size={14} />}
      <span className="farm-limit-badge__text">
        {limit.current}/{limit.max}
      </span>
      <div className="farm-limit-badge__track" aria-hidden="true">
        <div
          className="farm-limit-badge__fill"
          style={{ width: `${Math.min(limit.percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default FarmLimitBadge;
