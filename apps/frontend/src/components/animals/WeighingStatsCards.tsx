import { Scale, TrendingUp, TrendingDown, Activity, Weight } from 'lucide-react';
import type { WeighingStats } from '@/types/animal';
import './WeighingStatsCards.css';

interface WeighingStatsCardsProps {
  stats: WeighingStats;
}

function WeighingStatsCards({ stats }: WeighingStatsCardsProps) {
  const gmdDirection = stats.gmdKgDay != null ? (stats.gmdKgDay >= 0 ? 'up' : 'down') : null;

  return (
    <div className="weighing-stats" role="region" aria-label="Estatísticas de pesagem">
      <div className="weighing-stats__card">
        <div className="weighing-stats__icon" aria-hidden="true">
          <Scale size={20} />
        </div>
        <div className="weighing-stats__content">
          <span className="weighing-stats__label">Peso atual</span>
          <span className="weighing-stats__value weighing-stats__value--mono">
            {stats.currentWeightKg != null ? `${stats.currentWeightKg} kg` : '—'}
          </span>
        </div>
      </div>

      <div className="weighing-stats__card">
        <div className="weighing-stats__icon" aria-hidden="true">
          <Activity size={20} />
        </div>
        <div className="weighing-stats__content">
          <span className="weighing-stats__label">GMD</span>
          <span className="weighing-stats__value weighing-stats__value--mono">
            {stats.gmdKgDay != null ? (
              <>
                {stats.gmdKgDay.toFixed(3)} kg/dia
                {gmdDirection === 'up' && (
                  <TrendingUp
                    size={16}
                    className="weighing-stats__trend weighing-stats__trend--up"
                    aria-label="Ganho positivo"
                  />
                )}
                {gmdDirection === 'down' && (
                  <TrendingDown
                    size={16}
                    className="weighing-stats__trend weighing-stats__trend--down"
                    aria-label="Perda de peso"
                  />
                )}
              </>
            ) : (
              '—'
            )}
          </span>
        </div>
      </div>

      <div className="weighing-stats__card">
        <div className="weighing-stats__icon" aria-hidden="true">
          <TrendingUp size={20} />
        </div>
        <div className="weighing-stats__content">
          <span className="weighing-stats__label">Ganho total</span>
          <span className="weighing-stats__value weighing-stats__value--mono">
            {stats.totalGainKg != null
              ? `${stats.totalGainKg > 0 ? '+' : ''}${stats.totalGainKg} kg`
              : '—'}
          </span>
        </div>
      </div>

      <div className="weighing-stats__card">
        <div className="weighing-stats__icon" aria-hidden="true">
          <Weight size={20} />
        </div>
        <div className="weighing-stats__content">
          <span className="weighing-stats__label">Total pesagens</span>
          <span className="weighing-stats__value weighing-stats__value--mono">
            {stats.totalWeighings}
          </span>
        </div>
      </div>
    </div>
  );
}

export default WeighingStatsCards;
