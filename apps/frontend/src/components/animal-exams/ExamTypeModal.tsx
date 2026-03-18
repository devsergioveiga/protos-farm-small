import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { ExamTypeItem, CreateExamTypeInput } from '@/types/animal-exam';
import { EXAM_CATEGORIES, EXAM_METHODS, EXAM_MATERIALS } from '@/types/animal-exam';
import './ExamTypeModal.css';

interface ParamRow {
  paramName: string;
  unit: string;
  minReference: string;
  maxReference: string;
  isBooleanResult: boolean;
}

interface ExamTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  examType: ExamTypeItem | null;
  onSuccess: () => void;
}

export default function ExamTypeModal({
  isOpen,
  onClose,
  examType,
  onSuccess,
}: ExamTypeModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [method, setMethod] = useState('');
  const [material, setMaterial] = useState('');
  const [defaultLab, setDefaultLab] = useState('');
  const [isRegulatory, setIsRegulatory] = useState(false);
  const [validityDays, setValidityDays] = useState('');
  const [notes, setNotes] = useState('');
  const [params, setParams] = useState<ParamRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (examType) {
        setName(examType.name);
        setCategory(examType.category);
        setMethod(examType.method);
        setMaterial(examType.material ?? '');
        setDefaultLab(examType.defaultLab ?? '');
        setIsRegulatory(examType.isRegulatory);
        setValidityDays(examType.validityDays ? String(examType.validityDays) : '');
        setNotes(examType.notes ?? '');
        setParams(
          examType.referenceParams.map((p) => ({
            paramName: p.paramName,
            unit: p.unit ?? '',
            minReference: p.minReference != null ? String(p.minReference) : '',
            maxReference: p.maxReference != null ? String(p.maxReference) : '',
            isBooleanResult: p.isBooleanResult,
          })),
        );
      } else {
        setName('');
        setCategory('');
        setMethod('');
        setMaterial('');
        setDefaultLab('');
        setIsRegulatory(false);
        setValidityDays('');
        setNotes('');
        setParams([]);
      }
      setError(null);
    }
  }, [isOpen, examType]);

  const handleAddParam = useCallback(() => {
    setParams((prev) => [
      ...prev,
      { paramName: '', unit: '', minReference: '', maxReference: '', isBooleanResult: false },
    ]);
  }, []);

  const handleRemoveParam = useCallback((index: number) => {
    setParams((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleParamChange = useCallback(
    (index: number, field: keyof ParamRow, value: string | boolean) => {
      setParams((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSaving(true);

      try {
        const body: CreateExamTypeInput = {
          name: name.trim(),
          category,
          method,
          material: material || null,
          defaultLab: defaultLab || null,
          isRegulatory,
          validityDays: validityDays ? Number(validityDays) : null,
          notes: notes || null,
          referenceParams: params
            .filter((p) => p.paramName.trim())
            .map((p, i) => ({
              paramName: p.paramName.trim(),
              unit: p.unit || null,
              minReference: p.minReference ? Number(p.minReference) : null,
              maxReference: p.maxReference ? Number(p.maxReference) : null,
              isBooleanResult: p.isBooleanResult,
              sortOrder: i,
            })),
        };

        if (examType) {
          await api.patch(`/org/exam-types/${examType.id}`, body);
        } else {
          await api.post('/org/exam-types', body);
        }

        onSuccess();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao salvar tipo de exame');
      } finally {
        setSaving(false);
      }
    },
    [
      name,
      category,
      method,
      material,
      defaultLab,
      isRegulatory,
      validityDays,
      notes,
      params,
      examType,
      onSuccess,
    ],
  );

  if (!isOpen) return null;

  return (
    <div className="exam-type-modal__overlay" onClick={onClose}>
      <div
        className="exam-type-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={examType ? 'Editar tipo de exame' : 'Novo tipo de exame'}
      >
        <header className="exam-type-modal__header">
          <h2>{examType ? 'Editar tipo de exame' : 'Novo tipo de exame'}</h2>
          <button
            type="button"
            className="exam-type-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="exam-type-modal__body">
          <form className="exam-type-modal__form" onSubmit={handleSubmit} id="exam-type-form">
            {error && (
              <div className="exam-type-modal__error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {error}
              </div>
            )}

            <div className="exam-type-modal__field">
              <label htmlFor="et-name">Nome *</label>
              <input
                id="et-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Ex: Sorologia Brucelose"
              />
            </div>

            <div className="exam-type-modal__row">
              <div className="exam-type-modal__field">
                <label htmlFor="et-category">Categoria *</label>
                <select
                  id="et-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                >
                  <option value="">Selecione...</option>
                  {EXAM_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="exam-type-modal__field">
                <label htmlFor="et-method">Método *</label>
                <select
                  id="et-method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  required
                >
                  <option value="">Selecione...</option>
                  {EXAM_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="exam-type-modal__row">
              <div className="exam-type-modal__field">
                <label htmlFor="et-material">Material coletado</label>
                <select
                  id="et-material"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {EXAM_MATERIALS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="exam-type-modal__field">
                <label htmlFor="et-lab">Laboratório padrão</label>
                <input
                  id="et-lab"
                  type="text"
                  value={defaultLab}
                  onChange={(e) => setDefaultLab(e.target.value)}
                  placeholder="Ex: Lab Central"
                />
              </div>
            </div>

            <div className="exam-type-modal__row">
              <div className="exam-type-modal__field exam-type-modal__checkbox">
                <input
                  id="et-regulatory"
                  type="checkbox"
                  checked={isRegulatory}
                  onChange={(e) => setIsRegulatory(e.target.checked)}
                />
                <label htmlFor="et-regulatory">Exame regulatório/obrigatório</label>
              </div>

              {isRegulatory && (
                <div className="exam-type-modal__field">
                  <label htmlFor="et-validity">Validade (dias)</label>
                  <input
                    id="et-validity"
                    type="number"
                    min="1"
                    value={validityDays}
                    onChange={(e) => setValidityDays(e.target.value)}
                    placeholder="Ex: 365"
                  />
                </div>
              )}
            </div>

            <div className="exam-type-modal__field">
              <label htmlFor="et-notes">Observações</label>
              <textarea
                id="et-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Reference Parameters */}
            <div className="exam-type-modal__params-section">
              <div className="exam-type-modal__params-header">
                <h3>Parâmetros de referência</h3>
                <button
                  type="button"
                  className="exam-type-modal__add-param"
                  onClick={handleAddParam}
                >
                  <Plus size={14} aria-hidden="true" />
                  Adicionar
                </button>
              </div>

              {params.map((p, i) => (
                <div key={i} className="exam-type-modal__param-card">
                  <div className="exam-type-modal__param-row">
                    <input
                      type="text"
                      placeholder="Parâmetro"
                      value={p.paramName}
                      onChange={(e) => handleParamChange(i, 'paramName', e.target.value)}
                      aria-label={`Nome do parâmetro ${i + 1}`}
                    />
                    <input
                      type="text"
                      placeholder="Unidade"
                      value={p.unit}
                      onChange={(e) => handleParamChange(i, 'unit', e.target.value)}
                      aria-label={`Unidade do parâmetro ${i + 1}`}
                    />
                    <input
                      type="number"
                      placeholder="Mín"
                      value={p.minReference}
                      onChange={(e) => handleParamChange(i, 'minReference', e.target.value)}
                      aria-label={`Mínimo do parâmetro ${i + 1}`}
                      step="any"
                    />
                    <input
                      type="number"
                      placeholder="Máx"
                      value={p.maxReference}
                      onChange={(e) => handleParamChange(i, 'maxReference', e.target.value)}
                      aria-label={`Máximo do parâmetro ${i + 1}`}
                      step="any"
                    />
                    <button
                      type="button"
                      className="exam-type-modal__remove-param"
                      onClick={() => handleRemoveParam(i)}
                      aria-label={`Remover parâmetro ${i + 1}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="exam-type-modal__field exam-type-modal__checkbox">
                    <input
                      type="checkbox"
                      id={`param-bool-${i}`}
                      checked={p.isBooleanResult}
                      onChange={(e) => handleParamChange(i, 'isBooleanResult', e.target.checked)}
                    />
                    <label htmlFor={`param-bool-${i}`}>Resultado positivo/negativo</label>
                  </div>
                </div>
              ))}
            </div>
          </form>
        </div>

        <footer className="exam-type-modal__footer">
          <button type="button" className="exam-type-modal__btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            form="exam-type-form"
            className="exam-type-modal__btn-save"
            disabled={saving}
          >
            {saving ? 'Salvando...' : examType ? 'Salvar alterações' : 'Criar tipo de exame'}
          </button>
        </footer>
      </div>
    </div>
  );
}
