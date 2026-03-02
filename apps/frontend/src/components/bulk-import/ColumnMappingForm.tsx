import type { ColumnMapping } from '@/types/farm';
import './BulkImportModal.css';

interface ColumnMappingFormProps {
  propertyKeys: string[];
  columnMapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
}

const FIELDS: { key: keyof ColumnMapping; label: string; required?: boolean }[] = [
  { key: 'name', label: 'Nome do talhão', required: true },
  { key: 'code', label: 'Código' },
  { key: 'soilType', label: 'Tipo de solo' },
  { key: 'currentCrop', label: 'Cultura atual' },
  { key: 'previousCrop', label: 'Cultura anterior' },
  { key: 'notes', label: 'Observações' },
];

function ColumnMappingForm({ propertyKeys, columnMapping, onChange }: ColumnMappingFormProps) {
  function handleChange(field: keyof ColumnMapping, value: string) {
    onChange({ ...columnMapping, [field]: value || undefined });
  }

  return (
    <div className="column-mapping">
      <h3 className="column-mapping__title">Mapeamento de colunas</h3>
      <p className="column-mapping__description">
        Associe os campos do arquivo com os campos do sistema. Campos não mapeados serão ignorados.
      </p>
      <div className="column-mapping__grid">
        {FIELDS.map(({ key, label, required }) => (
          <div key={key} className="column-mapping__field">
            <label htmlFor={`mapping-${key}`} className="column-mapping__label">
              {label}
              {required && <span className="column-mapping__required"> *</span>}
            </label>
            <select
              id={`mapping-${key}`}
              value={columnMapping[key] ?? ''}
              onChange={(e) => handleChange(key, e.target.value)}
              className="column-mapping__select"
            >
              <option value="">— Não mapear —</option>
              {propertyKeys.map((pk) => (
                <option key={pk} value={pk}>
                  {pk}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ColumnMappingForm;
