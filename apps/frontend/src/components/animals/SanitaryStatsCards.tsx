import { Syringe, Bug, Stethoscope, FlaskConical } from 'lucide-react';
import type { HealthStats } from '@/types/animal';
import './SanitaryStatsCards.css';

interface SanitaryStatsCardsProps {
  stats: HealthStats;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function SanitaryStatsCards({ stats }: SanitaryStatsCardsProps) {
  return (
    <div className="sanitary-stats" role="region" aria-label="Estatísticas sanitárias">
      <div className="sanitary-stats__card">
        <div className="sanitary-stats__icon sanitary-stats__icon--vaccination" aria-hidden="true">
          <Syringe size={20} />
        </div>
        <div className="sanitary-stats__content">
          <span className="sanitary-stats__label">VACINAÇÕES</span>
          <span className="sanitary-stats__value sanitary-stats__value--mono">
            {stats.vaccinations}
          </span>
          <span className="sanitary-stats__sub">
            Última: {formatDate(stats.lastVaccinationDate)}
          </span>
        </div>
      </div>

      <div className="sanitary-stats__card">
        <div className="sanitary-stats__icon sanitary-stats__icon--deworming" aria-hidden="true">
          <Bug size={20} />
        </div>
        <div className="sanitary-stats__content">
          <span className="sanitary-stats__label">VERMIFUGAÇÕES</span>
          <span className="sanitary-stats__value sanitary-stats__value--mono">
            {stats.dewormings}
          </span>
          <span className="sanitary-stats__sub">Última: {formatDate(stats.lastDewormingDate)}</span>
        </div>
      </div>

      <div className="sanitary-stats__card">
        <div className="sanitary-stats__icon sanitary-stats__icon--treatment" aria-hidden="true">
          <Stethoscope size={20} />
        </div>
        <div className="sanitary-stats__content">
          <span className="sanitary-stats__label">TRATAMENTOS</span>
          <span className="sanitary-stats__value sanitary-stats__value--mono">
            {stats.treatments}
          </span>
          <span className="sanitary-stats__sub">Última: {formatDate(stats.lastTreatmentDate)}</span>
        </div>
      </div>

      <div className="sanitary-stats__card">
        <div className="sanitary-stats__icon sanitary-stats__icon--exam" aria-hidden="true">
          <FlaskConical size={20} />
        </div>
        <div className="sanitary-stats__content">
          <span className="sanitary-stats__label">EXAMES</span>
          <span className="sanitary-stats__value sanitary-stats__value--mono">{stats.exams}</span>
          <span className="sanitary-stats__sub">Último: {formatDate(stats.lastExamDate)}</span>
        </div>
      </div>
    </div>
  );
}

export default SanitaryStatsCards;
