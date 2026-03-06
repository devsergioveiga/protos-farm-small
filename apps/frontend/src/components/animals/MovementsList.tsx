import { ArrowRight } from 'lucide-react';
import type { AnimalMovementItem } from '@/types/animal';
import { LOT_LOCATION_TYPE_LABELS } from '@/types/animal';
import './MovementsList.css';

interface MovementsListProps {
  movements: AnimalMovementItem[];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function formatDuration(days: number): string {
  if (days === 0) return 'Hoje';
  if (days === 1) return '1 dia';
  return `${days} dias`;
}

function MovementsList({ movements }: MovementsListProps) {
  if (movements.length === 0) return null;

  return (
    <section className="movements-list" aria-labelledby="movements-list-title">
      <h3 className="movements-list__title" id="movements-list-title">
        Histórico de movimentações
      </h3>

      {/* Desktop table */}
      <div className="movements-list__table-wrapper">
        <table className="movements-list__table">
          <thead>
            <tr>
              <th scope="col">Entrada</th>
              <th scope="col">Saída</th>
              <th scope="col">Lote</th>
              <th scope="col">Tipo</th>
              <th scope="col">Local</th>
              <th scope="col">Lote anterior</th>
              <th scope="col">Duração</th>
              <th scope="col">Motivo</th>
              <th scope="col">Responsável</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id} className={m.exitedAt === null ? 'movements-list__row--current' : ''}>
                <td>{formatDate(m.enteredAt)}</td>
                <td>
                  {m.exitedAt ? (
                    formatDate(m.exitedAt)
                  ) : (
                    <span className="movements-list__badge movements-list__badge--active">
                      Atual
                    </span>
                  )}
                </td>
                <td className="movements-list__lot-name">{m.lotName}</td>
                <td>
                  <span className="movements-list__badge movements-list__badge--type">
                    {LOT_LOCATION_TYPE_LABELS[m.lotLocationType] ?? m.lotLocationType}
                  </span>
                </td>
                <td>{m.locationName ?? '—'}</td>
                <td>{m.previousLotName ?? '—'}</td>
                <td className="movements-list__duration">{formatDuration(m.durationDays)}</td>
                <td className="movements-list__reason">{m.reason ?? '—'}</td>
                <td>{m.movedByName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="movements-list__cards">
        {movements.map((m) => (
          <div
            key={m.id}
            className={`movements-list__card${m.exitedAt === null ? ' movements-list__card--current' : ''}`}
          >
            <div className="movements-list__card-header">
              <span className="movements-list__card-date">{formatDate(m.enteredAt)}</span>
              {m.exitedAt === null ? (
                <span className="movements-list__badge movements-list__badge--active">Atual</span>
              ) : (
                <span className="movements-list__card-date">
                  <ArrowRight size={14} aria-hidden="true" /> {formatDate(m.exitedAt)}
                </span>
              )}
            </div>
            <div className="movements-list__card-body">
              <span className="movements-list__card-lot">{m.lotName}</span>
              <span className="movements-list__badge movements-list__badge--type">
                {LOT_LOCATION_TYPE_LABELS[m.lotLocationType] ?? m.lotLocationType}
              </span>
              {m.locationName && (
                <span className="movements-list__card-field">Local: {m.locationName}</span>
              )}
              {m.previousLotName && (
                <span className="movements-list__card-field">De: {m.previousLotName}</span>
              )}
              <span className="movements-list__card-field">
                Duração: {formatDuration(m.durationDays)}
              </span>
              {m.reason && <span className="movements-list__card-field">Motivo: {m.reason}</span>}
              <span className="movements-list__card-field">Por: {m.movedByName}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default MovementsList;
