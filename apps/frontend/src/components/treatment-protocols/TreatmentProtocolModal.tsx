import { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import type { ProtocolItem, CreateProtocolInput, StepInput } from '@/types/treatment-protocol';
import { ADMINISTRATION_ROUTES, DOSAGE_UNITS } from '@/types/treatment-protocol';
import type { DiseaseItem } from '@/types/disease';
import { DISEASE_SEVERITIES } from '@/types/disease';
import './TreatmentProtocolModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  protocol?: ProtocolItem | null;
  onSuccess: () => void;
}

const EMPTY_STEP: StepInput = {
  order: 1,
  productId: null,
  productName: '',
  dosage: 0,
  dosageUnit: 'MG_KG',
  administrationRoute: 'IM',
  frequencyPerDay: 1,
  startDay: 1,
  durationDays: 1,
  withdrawalMeatDays: null,
  withdrawalMilkDays: null,
  notes: null,
};

interface FormData {
  name: string;
  description: string;
  notes: string;
  severity: string;
  authorName: string;
  status: string;
  diseaseIds: string[];
  steps: StepInput[];
}

const EMPTY_FORM: FormData = {
  name: '',
  description: '',
  notes: '',
  severity: '',
  authorName: '',
  status: 'ACTIVE',
  diseaseIds: [],
  steps: [{ ...EMPTY_STEP }],
};

export default function TreatmentProtocolModal({ isOpen, onClose, protocol, onSuccess }: Props) {
  const [formData, setFormData] = useState<FormData>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diseases, setDiseases] = useState<DiseaseItem[]>([]);

  // Fetch diseases for selector
  useEffect(() => {
    if (!isOpen) return;
    void (async () => {
      try {
        const result = await api.get<{ data: DiseaseItem[] }>('/org/diseases?limit=100');
        setDiseases(result.data);
      } catch {
        // Silently fail, diseases selector will be empty
      }
    })();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (protocol) {
      setFormData({
        name: protocol.name,
        description: protocol.description ?? '',
        notes: protocol.notes ?? '',
        severity: protocol.severity ?? '',
        authorName: protocol.authorName,
        status: protocol.status,
        diseaseIds: protocol.diseases.map((d) => d.diseaseId),
        steps: protocol.steps.map((s) => ({
          order: s.order,
          productId: s.productId,
          productName: s.productName,
          dosage: s.dosage,
          dosageUnit: s.dosageUnit,
          administrationRoute: s.administrationRoute,
          frequencyPerDay: s.frequencyPerDay,
          startDay: s.startDay,
          durationDays: s.durationDays,
          withdrawalMeatDays: s.withdrawalMeatDays,
          withdrawalMilkDays: s.withdrawalMilkDays,
          notes: s.notes,
        })),
      });
    } else {
      setFormData({ ...EMPTY_FORM, steps: [{ ...EMPTY_STEP }] });
    }
    setError(null);
  }, [protocol, isOpen]);

  const updateStep = useCallback((index: number, field: string, value: unknown) => {
    setFormData((prev) => {
      const steps = [...prev.steps];
      steps[index] = { ...steps[index], [field]: value };
      return { ...prev, steps };
    });
  }, []);

  const addStep = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      steps: [...prev.steps, { ...EMPTY_STEP, order: prev.steps.length + 1 }],
    }));
  }, []);

  const removeStep = useCallback((index: number) => {
    setFormData((prev) => {
      const steps = prev.steps
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, order: i + 1 }));
      return { ...prev, steps };
    });
  }, []);

  const toggleDisease = useCallback((diseaseId: string) => {
    setFormData((prev) => {
      const ids = prev.diseaseIds.includes(diseaseId)
        ? prev.diseaseIds.filter((id) => id !== diseaseId)
        : [...prev.diseaseIds, diseaseId];
      return { ...prev, diseaseIds: ids };
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const payload: CreateProtocolInput = {
      name: formData.name,
      description: formData.description || null,
      notes: formData.notes || null,
      severity: formData.severity || null,
      authorName: formData.authorName,
      status: formData.status,
      diseaseIds: formData.diseaseIds,
      steps: formData.steps.map((s) => ({
        ...s,
        productId: s.productId || null,
        notes: s.notes || null,
        withdrawalMeatDays: s.withdrawalMeatDays ?? null,
        withdrawalMilkDays: s.withdrawalMilkDays ?? null,
      })),
    };

    try {
      if (protocol) {
        await api.patch(`/org/treatment-protocols/${protocol.id}`, payload);
      } else {
        await api.post('/org/treatment-protocols', payload);
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar protocolo.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="tp-modal__overlay" onClick={onClose}>
      <div
        className="tp-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tp-modal-title"
      >
        <header className="tp-modal__header">
          <h2 id="tp-modal-title">
            {protocol ? 'Editar protocolo' : 'Novo protocolo de tratamento'}
          </h2>
          <button type="button" className="tp-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="tp-modal__form">
          {error && (
            <div className="tp-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Basic info */}
          <div className="tp-modal__row">
            <div className="tp-modal__field">
              <label htmlFor="tp-name">Nome do protocolo *</label>
              <input
                id="tp-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                aria-required="true"
                placeholder="Ex: Mastite clínica grau 1 — cefalosporina"
              />
            </div>
            <div className="tp-modal__field">
              <label htmlFor="tp-author">Veterinário autor *</label>
              <input
                id="tp-author"
                type="text"
                value={formData.authorName}
                onChange={(e) => setFormData({ ...formData, authorName: e.target.value })}
                required
                aria-required="true"
              />
            </div>
          </div>

          <div className="tp-modal__row">
            <div className="tp-modal__field">
              <label htmlFor="tp-severity">Gravidade indicada</label>
              <select
                id="tp-severity"
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
              >
                <option value="">Selecione...</option>
                {DISEASE_SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="tp-modal__field">
              <label htmlFor="tp-status">Status</label>
              <select
                id="tp-status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </select>
            </div>
          </div>

          <div className="tp-modal__field">
            <label htmlFor="tp-description">Descrição</label>
            <textarea
              id="tp-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          {/* Diseases */}
          <fieldset className="tp-modal__fieldset">
            <legend>Doenças vinculadas</legend>
            <div className="tp-modal__disease-grid">
              {diseases.map((d) => (
                <label key={d.id} className="tp-modal__disease-chip">
                  <input
                    type="checkbox"
                    checked={formData.diseaseIds.includes(d.id)}
                    onChange={() => toggleDisease(d.id)}
                  />
                  <span>{d.name}</span>
                </label>
              ))}
              {diseases.length === 0 && (
                <p className="tp-modal__hint">
                  Nenhuma doença cadastrada. Cadastre doenças primeiro.
                </p>
              )}
            </div>
          </fieldset>

          {/* Steps (CA2 + CA3) */}
          <fieldset className="tp-modal__fieldset">
            <legend>Etapas do tratamento *</legend>
            {formData.steps.map((step, idx) => (
              <div key={idx} className="tp-modal__step">
                <div className="tp-modal__step-header">
                  <span className="tp-modal__step-number">Medicamento {idx + 1}</span>
                  {formData.steps.length > 1 && (
                    <button
                      type="button"
                      className="tp-modal__step-remove"
                      onClick={() => removeStep(idx)}
                      aria-label={`Remover medicamento ${idx + 1}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="tp-modal__row">
                  <div className="tp-modal__field">
                    <label htmlFor={`step-product-${idx}`}>Produto/Medicamento *</label>
                    <input
                      id={`step-product-${idx}`}
                      type="text"
                      value={step.productName}
                      onChange={(e) => updateStep(idx, 'productName', e.target.value)}
                      required
                      aria-required="true"
                    />
                  </div>
                  <div className="tp-modal__field">
                    <label htmlFor={`step-route-${idx}`}>Via de administração *</label>
                    <select
                      id={`step-route-${idx}`}
                      value={step.administrationRoute}
                      onChange={(e) => updateStep(idx, 'administrationRoute', e.target.value)}
                      required
                      aria-required="true"
                    >
                      {ADMINISTRATION_ROUTES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="tp-modal__row tp-modal__row--three">
                  <div className="tp-modal__field">
                    <label htmlFor={`step-dosage-${idx}`}>Dosagem *</label>
                    <input
                      id={`step-dosage-${idx}`}
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={step.dosage || ''}
                      onChange={(e) =>
                        updateStep(idx, 'dosage', e.target.value ? Number(e.target.value) : 0)
                      }
                      required
                      aria-required="true"
                    />
                  </div>
                  <div className="tp-modal__field">
                    <label htmlFor={`step-unit-${idx}`}>Unidade *</label>
                    <select
                      id={`step-unit-${idx}`}
                      value={step.dosageUnit}
                      onChange={(e) => updateStep(idx, 'dosageUnit', e.target.value)}
                      required
                      aria-required="true"
                    >
                      {DOSAGE_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="tp-modal__field">
                    <label htmlFor={`step-freq-${idx}`}>Frequência/dia</label>
                    <input
                      id={`step-freq-${idx}`}
                      type="number"
                      min="1"
                      max="6"
                      value={step.frequencyPerDay ?? 1}
                      onChange={(e) =>
                        updateStep(idx, 'frequencyPerDay', Number(e.target.value) || 1)
                      }
                    />
                  </div>
                </div>

                <div className="tp-modal__row tp-modal__row--three">
                  <div className="tp-modal__field">
                    <label htmlFor={`step-start-${idx}`}>Dia início</label>
                    <input
                      id={`step-start-${idx}`}
                      type="number"
                      min="1"
                      value={step.startDay ?? 1}
                      onChange={(e) => updateStep(idx, 'startDay', Number(e.target.value) || 1)}
                    />
                  </div>
                  <div className="tp-modal__field">
                    <label htmlFor={`step-duration-${idx}`}>Duração (dias) *</label>
                    <input
                      id={`step-duration-${idx}`}
                      type="number"
                      min="1"
                      value={step.durationDays || ''}
                      onChange={(e) => updateStep(idx, 'durationDays', Number(e.target.value) || 1)}
                      required
                      aria-required="true"
                    />
                  </div>
                  <div className="tp-modal__field" />
                </div>

                <div className="tp-modal__row">
                  <div className="tp-modal__field">
                    <label htmlFor={`step-meat-${idx}`}>Carência abate (dias)</label>
                    <input
                      id={`step-meat-${idx}`}
                      type="number"
                      min="0"
                      value={step.withdrawalMeatDays ?? ''}
                      onChange={(e) =>
                        updateStep(
                          idx,
                          'withdrawalMeatDays',
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                    />
                  </div>
                  <div className="tp-modal__field">
                    <label htmlFor={`step-milk-${idx}`}>Carência leite (horas)</label>
                    <input
                      id={`step-milk-${idx}`}
                      type="number"
                      min="0"
                      value={step.withdrawalMilkDays ?? ''}
                      onChange={(e) =>
                        updateStep(
                          idx,
                          'withdrawalMilkDays',
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                    />
                  </div>
                </div>

                <div className="tp-modal__field">
                  <label htmlFor={`step-notes-${idx}`}>Observações da etapa</label>
                  <input
                    id={`step-notes-${idx}`}
                    type="text"
                    value={step.notes ?? ''}
                    onChange={(e) => updateStep(idx, 'notes', e.target.value || null)}
                  />
                </div>
              </div>
            ))}

            <button type="button" className="tp-modal__add-step" onClick={addStep}>
              <Plus size={16} aria-hidden="true" />
              Adicionar medicamento
            </button>
          </fieldset>

          {/* Notes */}
          <div className="tp-modal__field">
            <label htmlFor="tp-notes">Observações gerais</label>
            <textarea
              id="tp-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <footer className="tp-modal__footer">
            <button
              type="button"
              className="tp-modal__btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button type="submit" className="tp-modal__btn-save" disabled={isLoading}>
              {isLoading ? 'Salvando...' : protocol ? 'Salvar alterações' : 'Cadastrar protocolo'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
