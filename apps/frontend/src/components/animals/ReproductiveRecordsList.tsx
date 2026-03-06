import { Pencil, Trash2 } from 'lucide-react';
import type {
  ReproductiveRecordItem,
  ReproductiveEventType,
  HeatIntensity,
  BreedingMethod,
  CalvingType,
  PregnancyConfirmation,
} from '@/types/animal';
import {
  REPRODUCTIVE_EVENT_TYPE_LABELS,
  HEAT_INTENSITY_LABELS,
  BREEDING_METHOD_LABELS,
  CALVING_TYPE_LABELS,
  PREGNANCY_CONFIRMATION_LABELS,
} from '@/types/animal';
import './ReproductiveRecordsList.css';

interface ReproductiveRecordsListProps {
  records: ReproductiveRecordItem[];
  onEdit: (record: ReproductiveRecordItem) => void;
  onDelete: (recordId: string) => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

const TYPE_COLORS: Record<ReproductiveEventType, string> = {
  CLEARANCE: 'repro-records__badge--clearance',
  HEAT: 'repro-records__badge--heat',
  BREEDING_PLAN: 'repro-records__badge--breeding-plan',
  AI: 'repro-records__badge--ai',
  PREGNANCY: 'repro-records__badge--pregnancy',
  CALVING: 'repro-records__badge--calving',
};

function getDetails(r: ReproductiveRecordItem): string {
  switch (r.type) {
    case 'CLEARANCE':
      return r.approvedBy ? `Aprovado por: ${r.approvedBy}` : '—';
    case 'HEAT': {
      const parts: string[] = [];
      if (r.heatIntensity)
        parts.push(HEAT_INTENSITY_LABELS[r.heatIntensity as HeatIntensity] ?? r.heatIntensity);
      if (r.intervalDays != null) parts.push(`${r.intervalDays}d intervalo`);
      return parts.join(' | ') || '—';
    }
    case 'BREEDING_PLAN': {
      const parts: string[] = [];
      if (r.plannedSireName) parts.push(`Touro: ${r.plannedSireName}`);
      if (r.breedingMethod)
        parts.push(BREEDING_METHOD_LABELS[r.breedingMethod as BreedingMethod] ?? r.breedingMethod);
      if (r.plannedDate) parts.push(`Plan: ${formatDate(r.plannedDate)}`);
      return parts.join(' | ') || '—';
    }
    case 'AI': {
      const parts: string[] = [];
      if (r.sireName) parts.push(`Touro: ${r.sireName}`);
      if (r.semenBatch) parts.push(`Lote: ${r.semenBatch}`);
      if (r.technicianName) parts.push(`Téc: ${r.technicianName}`);
      return parts.join(' | ') || '—';
    }
    case 'PREGNANCY': {
      const parts: string[] = [];
      if (r.confirmationMethod)
        parts.push(
          PREGNANCY_CONFIRMATION_LABELS[r.confirmationMethod as PregnancyConfirmation] ??
            r.confirmationMethod,
        );
      if (r.expectedDueDate) parts.push(`Prev: ${formatDate(r.expectedDueDate)}`);
      return parts.join(' | ') || '—';
    }
    case 'CALVING': {
      const parts: string[] = [];
      if (r.calvingType)
        parts.push(CALVING_TYPE_LABELS[r.calvingType as CalvingType] ?? r.calvingType);
      if (r.calfEarTag) parts.push(`Cria: ${r.calfEarTag}`);
      if (r.calfSex) parts.push(r.calfSex === 'MALE' ? 'Macho' : 'Fêmea');
      if (r.calfWeightKg != null) parts.push(`${r.calfWeightKg}kg`);
      return parts.join(' | ') || '—';
    }
    default:
      return '—';
  }
}

function ReproductiveRecordsList({ records, onEdit, onDelete }: ReproductiveRecordsListProps) {
  if (records.length === 0) return null;

  return (
    <section className="repro-records" aria-labelledby="repro-records-title">
      <h3 className="repro-records__title" id="repro-records-title">
        Registros reprodutivos
      </h3>

      {/* Desktop table */}
      <div className="repro-records__table-wrapper">
        <table className="repro-records__table">
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Tipo</th>
              <th scope="col">Detalhes</th>
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
                  <span className={`repro-records__badge ${TYPE_COLORS[r.type]}`}>
                    {REPRODUCTIVE_EVENT_TYPE_LABELS[r.type]}
                  </span>
                </td>
                <td>{getDetails(r)}</td>
                <td>{r.recorderName}</td>
                <td className="repro-records__notes">{r.notes ?? '—'}</td>
                <td className="repro-records__actions">
                  <button
                    type="button"
                    className="repro-records__action-btn"
                    aria-label={`Editar registro de ${formatDate(r.eventDate)}`}
                    onClick={() => onEdit(r)}
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="repro-records__action-btn repro-records__action-btn--delete"
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
      <div className="repro-records__cards">
        {records.map((r) => (
          <div key={r.id} className="repro-records__card">
            <div className="repro-records__card-header">
              <span className="repro-records__card-date">{formatDate(r.eventDate)}</span>
              <span className={`repro-records__badge ${TYPE_COLORS[r.type]}`}>
                {REPRODUCTIVE_EVENT_TYPE_LABELS[r.type]}
              </span>
            </div>
            <div className="repro-records__card-body">
              <span className="repro-records__card-field">{getDetails(r)}</span>
              <span className="repro-records__card-field">Por: {r.recorderName}</span>
              {r.notes && <span className="repro-records__card-notes">{r.notes}</span>}
            </div>
            <div className="repro-records__card-actions">
              <button
                type="button"
                className="repro-records__action-btn"
                aria-label={`Editar registro de ${formatDate(r.eventDate)}`}
                onClick={() => onEdit(r)}
              >
                <Pencil size={16} aria-hidden="true" />
                Editar
              </button>
              <button
                type="button"
                className="repro-records__action-btn repro-records__action-btn--delete"
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

export default ReproductiveRecordsList;
