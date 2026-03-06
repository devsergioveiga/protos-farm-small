import { Activity, Syringe, Heart, Baby } from 'lucide-react';
import type { ReproductiveStats } from '@/types/animal';
import './ReproductiveStatsCards.css';

interface ReproductiveStatsCardsProps {
  stats: ReproductiveStats;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function ReproductiveStatsCards({ stats }: ReproductiveStatsCardsProps) {
  return (
    <div className="repro-stats" role="region" aria-label="Estatísticas reprodutivas">
      <div className="repro-stats__card">
        <div className="repro-stats__icon repro-stats__icon--heat" aria-hidden="true">
          <Activity size={20} />
        </div>
        <div className="repro-stats__content">
          <span className="repro-stats__label">CIOS</span>
          <span className="repro-stats__value repro-stats__value--mono">{stats.heats}</span>
          <span className="repro-stats__sub">
            {stats.averageHeatIntervalDays != null
              ? `Intervalo médio: ${stats.averageHeatIntervalDays}d`
              : `Último: ${formatDate(stats.lastHeatDate)}`}
          </span>
        </div>
      </div>

      <div className="repro-stats__card">
        <div className="repro-stats__icon repro-stats__icon--ai" aria-hidden="true">
          <Syringe size={20} />
        </div>
        <div className="repro-stats__content">
          <span className="repro-stats__label">INSEMINAÇÕES</span>
          <span className="repro-stats__value repro-stats__value--mono">{stats.ais}</span>
          <span className="repro-stats__sub">Última: {formatDate(stats.lastAiDate)}</span>
        </div>
      </div>

      <div className="repro-stats__card">
        <div className="repro-stats__icon repro-stats__icon--pregnancy" aria-hidden="true">
          <Heart size={20} />
        </div>
        <div className="repro-stats__content">
          <span className="repro-stats__label">GESTAÇÕES</span>
          <span className="repro-stats__value repro-stats__value--mono">{stats.pregnancies}</span>
          <span className="repro-stats__sub">
            {stats.isPregnant ? (
              <span className="repro-stats__badge repro-stats__badge--pregnant">Gestante</span>
            ) : (
              <span className="repro-stats__badge repro-stats__badge--not-pregnant">
                Não gestante
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="repro-stats__card">
        <div className="repro-stats__icon repro-stats__icon--calving" aria-hidden="true">
          <Baby size={20} />
        </div>
        <div className="repro-stats__content">
          <span className="repro-stats__label">PARTOS</span>
          <span className="repro-stats__value repro-stats__value--mono">{stats.calvings}</span>
          <span className="repro-stats__sub">Último: {formatDate(stats.lastCalvingDate)}</span>
        </div>
      </div>
    </div>
  );
}

export default ReproductiveStatsCards;
