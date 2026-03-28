import { CheckCircle, XCircle, Clock, ArrowRight } from 'lucide-react';
import type { InvariantResult } from '@/types/financial-statements';
import './InvariantCard.css';

interface InvariantCardProps {
  invariant: InvariantResult;
}

export default function InvariantCard({ invariant }: InvariantCardProps) {
  const { status, title, expected, found, difference, investigateUrl } = invariant;

  if (status === 'PENDING') {
    return (
      <div className="invariant-card invariant-card--pending">
        <div className="invariant-card__icon">
          <Clock size={24} aria-hidden="true" />
        </div>
        <div className="invariant-card__title">{title}</div>
        <p className="invariant-card__pending-text">Aguardando DFC (Phase 40)</p>
      </div>
    );
  }

  if (status === 'FAILED') {
    return (
      <div className="invariant-card invariant-card--failed">
        <div className="invariant-card__icon">
          <XCircle size={24} aria-hidden="true" />
        </div>
        <div className="invariant-card__title">{title}</div>
        {difference !== null && (
          <div className="invariant-card__difference">
            Diferenca: R$ {difference}
          </div>
        )}
        {investigateUrl && (
          <a
            href={investigateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="invariant-card__investigate"
            aria-label={`Investigar divergencia em ${title}`}
          >
            Investigar
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        )}
      </div>
    );
  }

  // PASSED
  return (
    <div className="invariant-card invariant-card--passed">
      <div className="invariant-card__icon">
        <CheckCircle size={24} aria-hidden="true" />
      </div>
      <div className="invariant-card__title">{title}</div>
      {(expected !== null || found !== null) && (
        <div className="invariant-card__detail">
          Esperado: <span>{expected ?? '—'}</span> | Encontrado:{' '}
          <span>{found ?? '—'}</span>
        </div>
      )}
    </div>
  );
}
