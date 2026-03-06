import { ArrowRightLeft, AlertCircle } from 'lucide-react';
import { useAnimalMovements } from '@/hooks/useAnimalMovements';
import MovementsStatsCards from './MovementsStatsCards';
import MovementsList from './MovementsList';
import './MovementsTab.css';

interface MovementsTabProps {
  farmId: string;
  animalId: string;
}

function MovementsTab({ farmId, animalId }: MovementsTabProps) {
  const { movements, stats, isLoading, error, refetch } = useAnimalMovements(farmId, animalId);

  if (isLoading) {
    return (
      <div className="movements-tab" aria-live="polite">
        <div className="movements-tab__skeleton-stats">
          {[1, 2, 3].map((i) => (
            <div key={i} className="movements-tab__skeleton-card" />
          ))}
        </div>
        <div className="movements-tab__skeleton-list" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="movements-tab">
        <div className="movements-tab__error" role="alert" aria-live="polite">
          <div className="movements-tab__error-message">
            <AlertCircle aria-hidden="true" size={20} />
            {error}
          </div>
          <button type="button" className="movements-tab__retry-btn" onClick={() => void refetch()}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const hasMovements = movements.length > 0;

  return (
    <div className="movements-tab">
      <div className="movements-tab__header">
        <h2 className="movements-tab__title">Movimentações</h2>
      </div>

      {hasMovements && stats ? (
        <>
          <MovementsStatsCards stats={stats} />
          <MovementsList movements={movements} />
        </>
      ) : (
        <div className="movements-tab__empty">
          <ArrowRightLeft size={48} color="var(--color-neutral-400)" aria-hidden="true" />
          <h3 className="movements-tab__empty-title">Nenhuma movimentação</h3>
          <p className="movements-tab__empty-desc">
            As movimentações são registradas automaticamente ao gerenciar lotes na página de Lotes.
          </p>
        </div>
      )}
    </div>
  );
}

export default MovementsTab;
