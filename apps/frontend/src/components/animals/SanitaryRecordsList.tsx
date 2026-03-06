import { Pencil, Trash2 } from 'lucide-react';
import type { HealthRecordItem, HealthEventType, ApplicationMethod } from '@/types/animal';
import { HEALTH_EVENT_TYPE_LABELS, APPLICATION_METHOD_LABELS } from '@/types/animal';
import './SanitaryRecordsList.css';

interface SanitaryRecordsListProps {
  records: HealthRecordItem[];
  onEdit: (record: HealthRecordItem) => void;
  onDelete: (recordId: string) => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

const TYPE_COLORS: Record<HealthEventType, string> = {
  VACCINATION: 'sanitary-records__badge--vaccination',
  DEWORMING: 'sanitary-records__badge--deworming',
  TREATMENT: 'sanitary-records__badge--treatment',
  EXAM: 'sanitary-records__badge--exam',
};

function SanitaryRecordsList({ records, onEdit, onDelete }: SanitaryRecordsListProps) {
  if (records.length === 0) return null;

  return (
    <section className="sanitary-records" aria-labelledby="sanitary-records-title">
      <h3 className="sanitary-records__title" id="sanitary-records-title">
        Registros sanitários
      </h3>

      {/* Desktop table */}
      <div className="sanitary-records__table-wrapper">
        <table className="sanitary-records__table">
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Tipo</th>
              <th scope="col">Produto</th>
              <th scope="col">Dosagem</th>
              <th scope="col">Responsável</th>
              <th scope="col">Observações</th>
              <th scope="col">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td>{formatDate(r.eventDate)}</td>
                <td>
                  <span className={`sanitary-records__badge ${TYPE_COLORS[r.type]}`}>
                    {HEALTH_EVENT_TYPE_LABELS[r.type]}
                  </span>
                </td>
                <td>{r.productName ?? '—'}</td>
                <td>{r.dosage ?? '—'}</td>
                <td>{r.veterinaryName || r.recorderName}</td>
                <td className="sanitary-records__notes">{r.notes ?? '—'}</td>
                <td className="sanitary-records__actions">
                  <button
                    type="button"
                    className="sanitary-records__action-btn"
                    aria-label={`Editar registro de ${formatDate(r.eventDate)}`}
                    onClick={() => onEdit(r)}
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="sanitary-records__action-btn sanitary-records__action-btn--delete"
                    aria-label={`Excluir registro de ${formatDate(r.eventDate)}`}
                    onClick={() => onDelete(r.id)}
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
      <div className="sanitary-records__cards">
        {records.map((r) => (
          <div key={r.id} className="sanitary-records__card">
            <div className="sanitary-records__card-header">
              <span className="sanitary-records__card-date">{formatDate(r.eventDate)}</span>
              <span className={`sanitary-records__badge ${TYPE_COLORS[r.type]}`}>
                {HEALTH_EVENT_TYPE_LABELS[r.type]}
              </span>
            </div>
            <div className="sanitary-records__card-body">
              {r.productName && (
                <span className="sanitary-records__card-field">Produto: {r.productName}</span>
              )}
              {r.dosage && <span className="sanitary-records__card-field">Dose: {r.dosage}</span>}
              {r.applicationMethod && (
                <span className="sanitary-records__card-field">
                  Método: {APPLICATION_METHOD_LABELS[r.applicationMethod as ApplicationMethod]}
                </span>
              )}
              {r.diagnosis && (
                <span className="sanitary-records__card-field">Diagnóstico: {r.diagnosis}</span>
              )}
              {r.examResult && (
                <span className="sanitary-records__card-field">Resultado: {r.examResult}</span>
              )}
              <span className="sanitary-records__card-field">
                Por: {r.veterinaryName || r.recorderName}
              </span>
              {r.notes && <span className="sanitary-records__card-notes">{r.notes}</span>}
            </div>
            <div className="sanitary-records__card-actions">
              <button
                type="button"
                className="sanitary-records__action-btn"
                aria-label={`Editar registro de ${formatDate(r.eventDate)}`}
                onClick={() => onEdit(r)}
              >
                <Pencil size={16} aria-hidden="true" />
                Editar
              </button>
              <button
                type="button"
                className="sanitary-records__action-btn sanitary-records__action-btn--delete"
                aria-label={`Excluir registro de ${formatDate(r.eventDate)}`}
                onClick={() => onDelete(r.id)}
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

export default SanitaryRecordsList;
