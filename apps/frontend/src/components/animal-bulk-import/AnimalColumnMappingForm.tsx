import type { AnimalColumnMapping } from '@/types/animal';
import './AnimalBulkImportModal.css';

interface AnimalColumnMappingFormProps {
  columnHeaders: string[];
  columnMapping: AnimalColumnMapping;
  onChange: (mapping: AnimalColumnMapping) => void;
}

interface FieldGroup {
  title: string;
  fields: { key: keyof AnimalColumnMapping; label: string; required?: boolean }[];
}

const FIELD_GROUPS: FieldGroup[] = [
  {
    title: 'Identificação',
    fields: [
      { key: 'earTag', label: 'Brinco', required: true },
      { key: 'name', label: 'Nome' },
      { key: 'rfidTag', label: 'RFID' },
    ],
  },
  {
    title: 'Dados básicos',
    fields: [
      { key: 'sex', label: 'Sexo', required: true },
      { key: 'birthDate', label: 'Data de nascimento' },
      { key: 'category', label: 'Categoria' },
      { key: 'origin', label: 'Origem' },
    ],
  },
  {
    title: 'Composição racial',
    fields: [
      { key: 'breed1', label: 'Raça 1' },
      { key: 'pct1', label: 'Percentual 1' },
      { key: 'breed2', label: 'Raça 2' },
      { key: 'pct2', label: 'Percentual 2' },
      { key: 'breed3', label: 'Raça 3' },
      { key: 'pct3', label: 'Percentual 3' },
    ],
  },
  {
    title: 'Saúde e genealogia',
    fields: [
      { key: 'entryWeightKg', label: 'Peso de entrada (kg)' },
      { key: 'bodyConditionScore', label: 'Escore corporal (1-5)' },
      { key: 'sireEarTag', label: 'Brinco do pai' },
      { key: 'damEarTag', label: 'Brinco da mãe' },
      { key: 'notes', label: 'Observações' },
    ],
  },
];

function AnimalColumnMappingForm({
  columnHeaders,
  columnMapping,
  onChange,
}: AnimalColumnMappingFormProps) {
  function handleChange(field: keyof AnimalColumnMapping, value: string) {
    onChange({ ...columnMapping, [field]: value || undefined });
  }

  return (
    <div className="animal-column-mapping">
      <h3 className="column-mapping__title">Mapeamento de colunas</h3>
      <p className="column-mapping__description">
        Associe as colunas do arquivo com os campos do sistema. Campos não mapeados serão ignorados.
      </p>

      {FIELD_GROUPS.map((group) => (
        <fieldset key={group.title} className="animal-column-mapping__group">
          <legend className="animal-column-mapping__group-title">{group.title}</legend>
          <div className="column-mapping__grid">
            {group.fields.map(({ key, label, required }) => (
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
                  {columnHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export default AnimalColumnMappingForm;
