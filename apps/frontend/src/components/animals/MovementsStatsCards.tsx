import { ArrowRightLeft, FolderOpen, Clock } from 'lucide-react';
import type { AnimalMovementStats } from '@/types/animal';
import './MovementsStatsCards.css';

interface MovementsStatsCardsProps {
  stats: AnimalMovementStats;
}

function MovementsStatsCards({ stats }: MovementsStatsCardsProps) {
  return (
    <div className="movements-stats" role="region" aria-label="Estatísticas de movimentações">
      <div className="movements-stats__card">
        <div className="movements-stats__icon movements-stats__icon--total" aria-hidden="true">
          <ArrowRightLeft size={20} />
        </div>
        <div className="movements-stats__content">
          <span className="movements-stats__label">MOVIMENTAÇÕES</span>
          <span className="movements-stats__value movements-stats__value--mono">
            {stats.totalMovements}
          </span>
          <span className="movements-stats__sub">
            {stats.distinctLots} {stats.distinctLots === 1 ? 'lote distinto' : 'lotes distintos'}
          </span>
        </div>
      </div>

      <div className="movements-stats__card">
        <div className="movements-stats__icon movements-stats__icon--lot" aria-hidden="true">
          <FolderOpen size={20} />
        </div>
        <div className="movements-stats__content">
          <span className="movements-stats__label">LOTE ATUAL</span>
          <span className="movements-stats__value">{stats.currentLotName ?? '—'}</span>
          <span className="movements-stats__sub">
            {stats.currentLocationName ?? 'Sem local vinculado'}
          </span>
        </div>
      </div>

      <div className="movements-stats__card">
        <div className="movements-stats__icon movements-stats__icon--days" aria-hidden="true">
          <Clock size={20} />
        </div>
        <div className="movements-stats__content">
          <span className="movements-stats__label">DIAS NO LOTE</span>
          <span className="movements-stats__value movements-stats__value--mono">
            {stats.daysInCurrentLot != null ? stats.daysInCurrentLot : '—'}
          </span>
          <span className="movements-stats__sub">No lote atual</span>
        </div>
      </div>
    </div>
  );
}

export default MovementsStatsCards;
