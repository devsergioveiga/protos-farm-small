import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import type { AnimalBulkPreviewRow } from '@/types/animal';
import { SEX_LABELS, CATEGORY_LABELS } from '@/types/animal';
import type { AnimalSex, AnimalCategory } from '@/types/animal';
import './AnimalBulkImportModal.css';

interface AnimalBulkPreviewTableProps {
  rows: AnimalBulkPreviewRow[];
  selectedIndices: Set<number>;
  onToggle: (index: number) => void;
  onSelectAllValid: () => void;
  onDeselectAll: () => void;
}

function getStatusIcon(row: AnimalBulkPreviewRow) {
  if (!row.validation.valid) {
    return <XCircle size={16} aria-hidden="true" className="bulk-preview-table__icon--error" />;
  }
  if (row.validation.warnings.length > 0) {
    return (
      <AlertTriangle size={16} aria-hidden="true" className="bulk-preview-table__icon--warning" />
    );
  }
  return <CheckCircle size={16} aria-hidden="true" className="bulk-preview-table__icon--valid" />;
}

function getStatusLabel(row: AnimalBulkPreviewRow): string {
  if (!row.validation.valid) return 'Inválido';
  if (row.validation.warnings.length > 0) return 'Atenção';
  return 'Válido';
}

function formatBreeds(row: AnimalBulkPreviewRow): string {
  if (row.derived.resolvedBreeds && row.derived.resolvedBreeds.length > 0) {
    return row.derived.resolvedBreeds.map((b) => `${b.breedName} ${b.percentage}%`).join(' + ');
  }
  if (row.parsed.breeds && row.parsed.breeds.length > 0) {
    return row.parsed.breeds.map((b) => `${b.name} ${b.pct}%`).join(' + ');
  }
  return '—';
}

function AnimalBulkPreviewTable({
  rows,
  selectedIndices,
  onToggle,
  onSelectAllValid,
  onDeselectAll,
}: AnimalBulkPreviewTableProps) {
  const validCount = rows.filter((r) => r.validation.valid).length;
  const selectedCount = selectedIndices.size;

  return (
    <div className="animal-bulk-preview">
      <div className="bulk-preview-table__header">
        <div className="bulk-preview-table__counts">
          <span>{rows.length} linhas encontradas</span>
          <span className="bulk-preview-table__sep">|</span>
          <span>{validCount} válidas</span>
          <span className="bulk-preview-table__sep">|</span>
          <span>{selectedCount} selecionadas</span>
        </div>
        <div className="bulk-preview-table__actions">
          <button
            type="button"
            className="bulk-preview-table__action-btn"
            onClick={onSelectAllValid}
          >
            Selecionar válidas
          </button>
          <button type="button" className="bulk-preview-table__action-btn" onClick={onDeselectAll}>
            Limpar seleção
          </button>
        </div>
      </div>

      <div className="animal-bulk-preview__scroll" role="table" aria-label="Preview dos animais">
        <div className="animal-bulk-preview__row animal-bulk-preview__row--header" role="row">
          <div
            className="animal-bulk-preview__cell animal-bulk-preview__cell--check"
            role="columnheader"
          >
            <span className="sr-only">Seleção</span>
          </div>
          <div
            className="animal-bulk-preview__cell animal-bulk-preview__cell--status"
            role="columnheader"
          >
            Status
          </div>
          <div
            className="animal-bulk-preview__cell animal-bulk-preview__cell--eartag"
            role="columnheader"
          >
            Brinco
          </div>
          <div
            className="animal-bulk-preview__cell animal-bulk-preview__cell--sex"
            role="columnheader"
          >
            Sexo
          </div>
          <div
            className="animal-bulk-preview__cell animal-bulk-preview__cell--breed"
            role="columnheader"
          >
            Raça
          </div>
          <div
            className="animal-bulk-preview__cell animal-bulk-preview__cell--info"
            role="columnheader"
          >
            Detalhes
          </div>
        </div>

        {rows.map((row) => {
          const isValid = row.validation.valid;
          const isSelected = selectedIndices.has(row.index);

          return (
            <div
              key={row.index}
              className={`animal-bulk-preview__row ${!isValid ? 'animal-bulk-preview__row--invalid' : ''}`}
              role="row"
            >
              <div
                className="animal-bulk-preview__cell animal-bulk-preview__cell--check"
                role="cell"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={!isValid}
                  onChange={() => onToggle(row.index)}
                  aria-label={`Selecionar ${row.parsed.earTag ?? `linha ${row.index + 1}`}`}
                />
              </div>
              <div
                className="animal-bulk-preview__cell animal-bulk-preview__cell--status"
                role="cell"
              >
                {getStatusIcon(row)}
                <span className="sr-only">{getStatusLabel(row)}</span>
              </div>
              <div
                className="animal-bulk-preview__cell animal-bulk-preview__cell--eartag"
                role="cell"
              >
                <span className="animal-bulk-preview__eartag-value">
                  {row.parsed.earTag ?? '—'}
                </span>
                {row.parsed.name && (
                  <span className="animal-bulk-preview__name-value">{row.parsed.name}</span>
                )}
              </div>
              <div className="animal-bulk-preview__cell animal-bulk-preview__cell--sex" role="cell">
                {row.parsed.sex ? (SEX_LABELS[row.parsed.sex as AnimalSex] ?? row.parsed.sex) : '—'}
              </div>
              <div
                className="animal-bulk-preview__cell animal-bulk-preview__cell--breed"
                role="cell"
              >
                {formatBreeds(row)}
              </div>
              <div
                className="animal-bulk-preview__cell animal-bulk-preview__cell--info"
                role="cell"
              >
                {row.derived.suggestedCategory && (
                  <span className="bulk-preview-table__badge bulk-preview-table__badge--valid">
                    {CATEGORY_LABELS[row.derived.suggestedCategory as AnimalCategory] ??
                      row.derived.suggestedCategory}
                  </span>
                )}
                {row.validation.errors.map((e, i) => (
                  <span
                    key={`e-${i}`}
                    className="bulk-preview-table__badge bulk-preview-table__badge--error"
                  >
                    {e}
                  </span>
                ))}
                {row.validation.warnings.map((w, i) => (
                  <span
                    key={`w-${i}`}
                    className="bulk-preview-table__badge bulk-preview-table__badge--warning"
                  >
                    {w}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AnimalBulkPreviewTable;
