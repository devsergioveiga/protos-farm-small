import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import type { BulkPreviewFeature, ColumnMapping } from '@/types/farm';
import './BulkImportModal.css';

interface BulkPreviewTableProps {
  features: BulkPreviewFeature[];
  selectedIndices: Set<number>;
  onToggle: (index: number) => void;
  onSelectAllValid: () => void;
  onDeselectAll: () => void;
  columnMapping: ColumnMapping;
}

function getStatusIcon(feature: BulkPreviewFeature) {
  if (!feature.validation.valid) {
    return <XCircle size={16} aria-hidden="true" className="bulk-preview-table__icon--error" />;
  }
  if (feature.validation.warnings.length > 0) {
    return (
      <AlertTriangle size={16} aria-hidden="true" className="bulk-preview-table__icon--warning" />
    );
  }
  return <CheckCircle size={16} aria-hidden="true" className="bulk-preview-table__icon--valid" />;
}

function getStatusLabel(feature: BulkPreviewFeature): string {
  if (!feature.validation.valid) return 'Inválido';
  if (feature.validation.warnings.length > 0) return 'Atenção';
  return 'Válido';
}

function resolvedName(feature: BulkPreviewFeature, mapping: ColumnMapping): string {
  if (mapping.name && feature.properties[mapping.name] != null) {
    return String(feature.properties[mapping.name]);
  }
  return `Feature ${feature.index}`;
}

function BulkPreviewTable({
  features,
  selectedIndices,
  onToggle,
  onSelectAllValid,
  onDeselectAll,
  columnMapping,
}: BulkPreviewTableProps) {
  const validCount = features.filter((f) => f.validation.valid).length;
  const selectedCount = selectedIndices.size;

  return (
    <div className="bulk-preview-table">
      <div className="bulk-preview-table__header">
        <div className="bulk-preview-table__counts">
          <span>{features.length} features encontradas</span>
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

      <div className="bulk-preview-table__scroll" role="table" aria-label="Preview dos talhões">
        <div className="bulk-preview-table__row bulk-preview-table__row--header" role="row">
          <div
            className="bulk-preview-table__cell bulk-preview-table__cell--check"
            role="columnheader"
          >
            <span className="sr-only">Seleção</span>
          </div>
          <div
            className="bulk-preview-table__cell bulk-preview-table__cell--status"
            role="columnheader"
          >
            Status
          </div>
          <div
            className="bulk-preview-table__cell bulk-preview-table__cell--name"
            role="columnheader"
          >
            Nome
          </div>
          <div
            className="bulk-preview-table__cell bulk-preview-table__cell--area"
            role="columnheader"
          >
            Área (ha)
          </div>
          <div
            className="bulk-preview-table__cell bulk-preview-table__cell--info"
            role="columnheader"
          >
            Detalhes
          </div>
        </div>

        {features.map((feature) => {
          const isValid = feature.validation.valid;
          const isSelected = selectedIndices.has(feature.index);

          return (
            <div
              key={feature.index}
              className={`bulk-preview-table__row ${!isValid ? 'bulk-preview-table__row--invalid' : ''}`}
              role="row"
            >
              <div className="bulk-preview-table__cell bulk-preview-table__cell--check" role="cell">
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={!isValid}
                  onChange={() => onToggle(feature.index)}
                  aria-label={`Selecionar ${resolvedName(feature, columnMapping)}`}
                />
              </div>
              <div
                className="bulk-preview-table__cell bulk-preview-table__cell--status"
                role="cell"
              >
                {getStatusIcon(feature)}
                <span className="sr-only">{getStatusLabel(feature)}</span>
              </div>
              <div className="bulk-preview-table__cell bulk-preview-table__cell--name" role="cell">
                {resolvedName(feature, columnMapping)}
              </div>
              <div className="bulk-preview-table__cell bulk-preview-table__cell--area" role="cell">
                {isValid ? feature.areaHa.toFixed(2) : '—'}
              </div>
              <div className="bulk-preview-table__cell bulk-preview-table__cell--info" role="cell">
                {feature.validation.errors.map((e, i) => (
                  <span
                    key={`e-${i}`}
                    className="bulk-preview-table__badge bulk-preview-table__badge--error"
                  >
                    {e}
                  </span>
                ))}
                {feature.validation.warnings.map((w, i) => (
                  <span
                    key={`w-${i}`}
                    className="bulk-preview-table__badge bulk-preview-table__badge--warning"
                  >
                    {w}
                  </span>
                ))}
                {isValid && feature.validation.warnings.length === 0 && (
                  <span className="bulk-preview-table__badge bulk-preview-table__badge--valid">
                    OK
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default BulkPreviewTable;
