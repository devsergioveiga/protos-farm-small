import { X, Users } from 'lucide-react';
import { useFarmProducers } from '@/hooks/useFarmProducers';
import type { FarmProducerLink } from '@/types/farm-producer';
import type { ProducerType } from '@/types/producer';
import './FarmProducersPanel.css';

interface FarmProducersPanelProps {
  farmId: string;
  onClose: () => void;
}

const BOND_TYPE_LABELS: Record<string, string> = {
  PROPRIETARIO: 'Proprietário',
  ARRENDATARIO: 'Arrendatário',
  COMODATARIO: 'Comodatário',
  PARCEIRO: 'Parceiro',
  MEEIRO: 'Meeiro',
  USUFRUTUARIO: 'Usufrutuário',
  CONDOMINO: 'Condômino',
};

const TYPE_LABELS: Record<ProducerType, string> = {
  PF: 'PF',
  PJ: 'PJ',
  SOCIEDADE_EM_COMUM: 'SC',
};

function formatDocument(doc: string | null, type: ProducerType): string {
  if (!doc) return '—';
  if (type === 'SOCIEDADE_EM_COMUM') return '—';
  const digits = doc.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  return doc;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function SkeletonCards() {
  return (
    <div className="fp-panel__skeleton" aria-busy="true" aria-label="Carregando produtores">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="fp-panel__skeleton-card">
          <div className="fp-panel__skeleton-line fp-panel__skeleton-line--wide" />
          <div className="fp-panel__skeleton-line fp-panel__skeleton-line--medium" />
          <div className="fp-panel__skeleton-line fp-panel__skeleton-line--narrow" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="fp-panel__empty">
      <Users size={48} aria-hidden="true" className="fp-panel__empty-icon" />
      <h3 className="fp-panel__empty-title">Nenhum produtor vinculado</h3>
      <p className="fp-panel__empty-text">
        Esta fazenda ainda não possui produtores vinculados. Vincule produtores pela página de
        produtores.
      </p>
    </div>
  );
}

function ProducerCard({ link }: { link: FarmProducerLink }) {
  const { producer } = link;
  const bondLabel = BOND_TYPE_LABELS[link.bondType] ?? link.bondType;

  const hasVigencia = link.startDate || link.endDate;
  const vigenciaText = hasVigencia
    ? `${link.startDate ? formatDate(link.startDate) : '—'} — ${link.endDate ? formatDate(link.endDate) : 'Indeterminado'}`
    : null;

  return (
    <article className="fp-card">
      <div className="fp-card__header">
        <h3 className="fp-card__name">{producer.name}</h3>
        <div className="fp-card__badges">
          <span className="fp-card__badge fp-card__badge--type">{TYPE_LABELS[producer.type]}</span>
          <span
            className={`fp-card__badge ${producer.status === 'ACTIVE' ? 'fp-card__badge--active' : 'fp-card__badge--inactive'}`}
          >
            {producer.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
          </span>
          {link.isItrDeclarant && <span className="fp-card__badge fp-card__badge--itr">ITR</span>}
        </div>
      </div>

      <p className="fp-card__document">{formatDocument(producer.document, producer.type)}</p>

      <dl className="fp-card__details">
        <dt>Vínculo</dt>
        <dd>
          {bondLabel}
          {link.participationPct != null && ` (${link.participationPct}%)`}
        </dd>

        {vigenciaText && (
          <>
            <dt>Vigência</dt>
            <dd>{vigenciaText}</dd>
          </>
        )}
      </dl>

      {producer.stateRegistrations.length > 0 && (
        <div className="fp-card__section">
          <h4 className="fp-card__section-title">IEs ATIVAS</h4>
          <ul className="fp-card__ie-list">
            {producer.stateRegistrations.map((ie) => (
              <li key={ie.id} className="fp-card__ie-item">
                <span>
                  {ie.number} ({ie.state})
                </span>
                {ie.isDefaultForFarm && <span className="fp-card__ie-default">padrão</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {link.registrationLinks.length > 0 && (
        <div className="fp-card__section">
          <h4 className="fp-card__section-title">MATRÍCULAS</h4>
          <ul className="fp-card__reg-list">
            {link.registrationLinks.map((rl) => (
              <li key={rl.id} className="fp-card__reg-item">
                {rl.farmRegistration.number}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function FarmProducersPanel({ farmId, onClose }: FarmProducersPanelProps) {
  const { producers, isLoading } = useFarmProducers(farmId);

  return (
    <div className="fp-panel" role="region" aria-label="Produtores da fazenda">
      <div className="fp-panel__header">
        <h2 className="fp-panel__title">Produtores</h2>
        <button
          type="button"
          className="fp-panel__close"
          onClick={onClose}
          aria-label="Fechar painel de produtores"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="fp-panel__body">
        {isLoading ? (
          <SkeletonCards />
        ) : producers.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="fp-panel__list">
            {producers.map((link) => (
              <li key={link.id}>
                <ProducerCard link={link} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default FarmProducersPanel;
