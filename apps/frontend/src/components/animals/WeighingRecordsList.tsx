import { Pencil, Trash2 } from 'lucide-react';
import type { WeighingItem } from '@/types/animal';
import './WeighingRecordsList.css';

interface WeighingRecordsListProps {
  weighings: WeighingItem[];
  onEdit: (weighing: WeighingItem) => void;
  onDelete: (weighingId: string) => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

function WeighingRecordsList({ weighings, onEdit, onDelete }: WeighingRecordsListProps) {
  if (weighings.length === 0) return null;

  return (
    <section className="weighing-records" aria-labelledby="weighing-records-title">
      <h3 className="weighing-records__title" id="weighing-records-title">
        Registros de pesagem
      </h3>

      {/* Desktop table */}
      <div className="weighing-records__table-wrapper">
        <table className="weighing-records__table">
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Peso (kg)</th>
              <th scope="col">ECC</th>
              <th scope="col">Registrado por</th>
              <th scope="col">Observações</th>
              <th scope="col">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {weighings.map((w) => (
              <tr key={w.id}>
                <td>{formatDate(w.measuredAt)}</td>
                <td className="weighing-records__weight">
                  {w.weightKg.toFixed(2).replace('.', ',')}
                </td>
                <td>{w.bodyConditionScore ?? '—'}</td>
                <td>{w.recorderName}</td>
                <td className="weighing-records__notes">{w.notes ?? '—'}</td>
                <td className="weighing-records__actions">
                  <button
                    type="button"
                    className="weighing-records__action-btn"
                    aria-label={`Editar pesagem de ${formatDate(w.measuredAt)}`}
                    onClick={() => onEdit(w)}
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="weighing-records__action-btn weighing-records__action-btn--delete"
                    aria-label={`Excluir pesagem de ${formatDate(w.measuredAt)}`}
                    onClick={() => onDelete(w.id)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="weighing-records__cards">
        {weighings.map((w) => (
          <div key={w.id} className="weighing-records__card">
            <div className="weighing-records__card-header">
              <span className="weighing-records__card-date">{formatDate(w.measuredAt)}</span>
              <span className="weighing-records__card-weight">
                {w.weightKg.toFixed(2).replace('.', ',')} kg
              </span>
            </div>
            <div className="weighing-records__card-body">
              {w.bodyConditionScore != null && (
                <span className="weighing-records__card-field">ECC: {w.bodyConditionScore}/5</span>
              )}
              <span className="weighing-records__card-field">Por: {w.recorderName}</span>
              {w.notes && <span className="weighing-records__card-notes">{w.notes}</span>}
            </div>
            <div className="weighing-records__card-actions">
              <button
                type="button"
                className="weighing-records__action-btn"
                aria-label={`Editar pesagem de ${formatDate(w.measuredAt)}`}
                onClick={() => onEdit(w)}
              >
                <Pencil size={16} aria-hidden="true" />
                Editar
              </button>
              <button
                type="button"
                className="weighing-records__action-btn weighing-records__action-btn--delete"
                aria-label={`Excluir pesagem de ${formatDate(w.measuredAt)}`}
                onClick={() => onDelete(w.id)}
              >
                <Trash2 size={16} aria-hidden="true" />
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default WeighingRecordsList;
