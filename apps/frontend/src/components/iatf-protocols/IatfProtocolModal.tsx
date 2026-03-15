import { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import type {
  IatfProtocolDetail,
  CreateIatfProtocolInput,
  StepInput,
  StepProductInput,
} from '@/types/iatf-protocol';
import { TARGET_CATEGORIES, DOSE_UNITS, ADMINISTRATION_ROUTES_IATF } from '@/types/iatf-protocol';
import './IatfProtocolModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  protocol?: IatfProtocolDetail | null;
  onSuccess: () => void;
}

const EMPTY_PRODUCT: StepProductInput = {
  productId: null,
  productName: '',
  dose: 0,
  doseUnit: 'mL',
  administrationRoute: null,
  notes: null,
};

const EMPTY_STEP: StepInput = {
  dayNumber: 0,
  description: '',
  isAiDay: false,
  sortOrder: 1,
  products: [{ ...EMPTY_PRODUCT }],
};

interface FormData {
  name: string;
  description: string;
  targetCategory: string;
  veterinaryAuthor: string;
  status: string;
  notes: string;
  steps: StepInput[];
}

const EMPTY_FORM: FormData = {
  name: '',
  description: '',
  targetCategory: 'COWS',
  veterinaryAuthor: '',
  status: 'ACTIVE',
  notes: '',
  steps: [{ ...EMPTY_STEP, products: [{ ...EMPTY_PRODUCT }] }],
};

export default function IatfProtocolModal({ isOpen, onClose, protocol, onSuccess }: Props) {
  const [formData, setFormData] = useState<FormData>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (protocol) {
      setFormData({
        name: protocol.name,
        description: protocol.description ?? '',
        targetCategory: protocol.targetCategory,
        veterinaryAuthor: protocol.veterinaryAuthor ?? '',
        status: protocol.status,
        notes: protocol.notes ?? '',
        steps: protocol.steps.map((s) => ({
          dayNumber: s.dayNumber,
          description: s.description,
          isAiDay: s.isAiDay,
          sortOrder: s.sortOrder,
          products: s.products.map((p) => ({
            productId: p.productId,
            productName: p.productName,
            dose: p.dose,
            doseUnit: p.doseUnit,
            administrationRoute: p.administrationRoute,
            notes: p.notes,
          })),
        })),
      });
    } else {
      setFormData({
        ...EMPTY_FORM,
        steps: [{ ...EMPTY_STEP, products: [{ ...EMPTY_PRODUCT }] }],
      });
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
      steps: [
        ...prev.steps,
        {
          ...EMPTY_STEP,
          sortOrder: prev.steps.length + 1,
          products: [{ ...EMPTY_PRODUCT }],
        },
      ],
    }));
  }, []);

  const removeStep = useCallback((index: number) => {
    setFormData((prev) => {
      const steps = prev.steps
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, sortOrder: i + 1 }));
      return { ...prev, steps };
    });
  }, []);

  const updateProduct = useCallback(
    (stepIndex: number, productIndex: number, field: string, value: unknown) => {
      setFormData((prev) => {
        const steps = [...prev.steps];
        const products = [...steps[stepIndex].products];
        products[productIndex] = { ...products[productIndex], [field]: value };
        steps[stepIndex] = { ...steps[stepIndex], products };
        return { ...prev, steps };
      });
    },
    [],
  );

  const addProduct = useCallback((stepIndex: number) => {
    setFormData((prev) => {
      const steps = [...prev.steps];
      steps[stepIndex] = {
        ...steps[stepIndex],
        products: [...steps[stepIndex].products, { ...EMPTY_PRODUCT }],
      };
      return { ...prev, steps };
    });
  }, []);

  const removeProduct = useCallback((stepIndex: number, productIndex: number) => {
    setFormData((prev) => {
      const steps = [...prev.steps];
      const products = steps[stepIndex].products.filter((_, i) => i !== productIndex);
      steps[stepIndex] = { ...steps[stepIndex], products };
      return { ...prev, steps };
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const payload: CreateIatfProtocolInput = {
      name: formData.name,
      description: formData.description || null,
      targetCategory: formData.targetCategory,
      veterinaryAuthor: formData.veterinaryAuthor || null,
      status: formData.status,
      notes: formData.notes || null,
      steps: formData.steps.map((s) => ({
        dayNumber: s.dayNumber,
        description: s.description,
        isAiDay: s.isAiDay,
        sortOrder: s.sortOrder,
        products: s.products.map((p) => ({
          productId: p.productId || null,
          productName: p.productName,
          dose: p.dose,
          doseUnit: p.doseUnit,
          administrationRoute: p.administrationRoute || null,
          notes: p.notes || null,
        })),
      })),
    };

    try {
      if (protocol) {
        await api.patch(`/org/iatf-protocols/${protocol.id}`, payload);
      } else {
        await api.post('/org/iatf-protocols', payload);
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar protocolo IATF.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="iatf-protocol-modal__overlay" onClick={onClose}>
      <div
        className="iatf-protocol-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="iatf-modal-title"
      >
        <header className="iatf-protocol-modal__header">
          <h2 id="iatf-modal-title">
            {protocol ? 'Editar protocolo IATF' : 'Novo protocolo IATF'}
          </h2>
          <button
            type="button"
            className="iatf-protocol-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="iatf-protocol-modal__form">
          {error && (
            <div className="iatf-protocol-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Basic info */}
          <div className="iatf-protocol-modal__row">
            <div className="iatf-protocol-modal__field">
              <label htmlFor="iatf-name">Nome do protocolo *</label>
              <input
                id="iatf-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                aria-required="true"
                placeholder="Ex: P36 — Novilhas"
              />
            </div>
            <div className="iatf-protocol-modal__field">
              <label htmlFor="iatf-category">Categoria alvo *</label>
              <select
                id="iatf-category"
                value={formData.targetCategory}
                onChange={(e) => setFormData({ ...formData, targetCategory: e.target.value })}
                required
                aria-required="true"
              >
                {TARGET_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="iatf-protocol-modal__row">
            <div className="iatf-protocol-modal__field">
              <label htmlFor="iatf-vet">Veterinário autor</label>
              <input
                id="iatf-vet"
                type="text"
                value={formData.veterinaryAuthor}
                onChange={(e) => setFormData({ ...formData, veterinaryAuthor: e.target.value })}
                placeholder="Nome do veterinário responsável"
              />
            </div>
            <div className="iatf-protocol-modal__field">
              <label htmlFor="iatf-status">Status</label>
              <select
                id="iatf-status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </select>
            </div>
          </div>

          <div className="iatf-protocol-modal__field">
            <label htmlFor="iatf-description">Descrição</label>
            <textarea
              id="iatf-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              placeholder="Descrição do protocolo..."
            />
          </div>

          {/* Steps */}
          <fieldset className="iatf-protocol-modal__fieldset">
            <legend>Etapas do protocolo *</legend>
            {formData.steps.map((step, stepIdx) => (
              <div key={stepIdx} className="iatf-protocol-modal__step">
                <div className="iatf-protocol-modal__step-header">
                  <div className="iatf-protocol-modal__step-title">
                    <span
                      className={`iatf-protocol-modal__day-badge${step.isAiDay ? ' iatf-protocol-modal__day-badge--ai' : ''}`}
                    >
                      D{step.dayNumber}
                    </span>
                    <span className="iatf-protocol-modal__step-number">Etapa {stepIdx + 1}</span>
                  </div>
                  {formData.steps.length > 1 && (
                    <button
                      type="button"
                      className="iatf-protocol-modal__step-remove"
                      onClick={() => removeStep(stepIdx)}
                      aria-label={`Remover etapa ${stepIdx + 1}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="iatf-protocol-modal__row--three iatf-protocol-modal__row">
                  <div className="iatf-protocol-modal__field">
                    <label htmlFor={`step-day-${stepIdx}`}>Dia *</label>
                    <input
                      id={`step-day-${stepIdx}`}
                      type="number"
                      min="0"
                      value={step.dayNumber}
                      onChange={(e) =>
                        updateStep(stepIdx, 'dayNumber', Number(e.target.value) || 0)
                      }
                      required
                      aria-required="true"
                    />
                  </div>
                  <div className="iatf-protocol-modal__field" style={{ gridColumn: 'span 2' }}>
                    <label htmlFor={`step-desc-${stepIdx}`}>Descrição *</label>
                    <input
                      id={`step-desc-${stepIdx}`}
                      type="text"
                      value={step.description}
                      onChange={(e) => updateStep(stepIdx, 'description', e.target.value)}
                      required
                      aria-required="true"
                      placeholder="Ex: Inserção de dispositivo intravaginal + BE"
                    />
                  </div>
                </div>

                <div className="iatf-protocol-modal__checkbox">
                  <input
                    type="checkbox"
                    id={`step-ai-${stepIdx}`}
                    checked={step.isAiDay}
                    onChange={(e) => updateStep(stepIdx, 'isAiDay', e.target.checked)}
                  />
                  <label htmlFor={`step-ai-${stepIdx}`}>Dia da IA (inseminação)</label>
                </div>

                {/* Products sub-list */}
                <div className="iatf-protocol-modal__products-header">
                  <span className="iatf-protocol-modal__products-label">Produtos</span>
                  <button
                    type="button"
                    className="iatf-protocol-modal__add-btn iatf-protocol-modal__add-btn--small"
                    onClick={() => addProduct(stepIdx)}
                  >
                    <Plus size={14} aria-hidden="true" />
                    Produto
                  </button>
                </div>

                {step.products.map((product, prodIdx) => (
                  <div key={prodIdx} className="iatf-protocol-modal__product">
                    <div className="iatf-protocol-modal__product-header">
                      <span className="iatf-protocol-modal__product-number">
                        Produto {prodIdx + 1}
                      </span>
                      {step.products.length > 1 && (
                        <button
                          type="button"
                          className="iatf-protocol-modal__product-remove"
                          onClick={() => removeProduct(stepIdx, prodIdx)}
                          aria-label={`Remover produto ${prodIdx + 1} da etapa ${stepIdx + 1}`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    <div className="iatf-protocol-modal__row">
                      <div className="iatf-protocol-modal__field">
                        <label htmlFor={`prod-name-${stepIdx}-${prodIdx}`}>Nome do produto *</label>
                        <input
                          id={`prod-name-${stepIdx}-${prodIdx}`}
                          type="text"
                          value={product.productName}
                          onChange={(e) =>
                            updateProduct(stepIdx, prodIdx, 'productName', e.target.value)
                          }
                          required
                          aria-required="true"
                          placeholder="Ex: Benzoato de estradiol"
                        />
                      </div>
                      <div className="iatf-protocol-modal__field">
                        <label htmlFor={`prod-route-${stepIdx}-${prodIdx}`}>
                          Via de administração
                        </label>
                        <select
                          id={`prod-route-${stepIdx}-${prodIdx}`}
                          value={product.administrationRoute ?? ''}
                          onChange={(e) =>
                            updateProduct(
                              stepIdx,
                              prodIdx,
                              'administrationRoute',
                              e.target.value || null,
                            )
                          }
                        >
                          <option value="">Selecione...</option>
                          {ADMINISTRATION_ROUTES_IATF.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="iatf-protocol-modal__row">
                      <div className="iatf-protocol-modal__field">
                        <label htmlFor={`prod-dose-${stepIdx}-${prodIdx}`}>Dose *</label>
                        <input
                          id={`prod-dose-${stepIdx}-${prodIdx}`}
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={product.dose || ''}
                          onChange={(e) =>
                            updateProduct(
                              stepIdx,
                              prodIdx,
                              'dose',
                              e.target.value ? Number(e.target.value) : 0,
                            )
                          }
                          required
                          aria-required="true"
                        />
                      </div>
                      <div className="iatf-protocol-modal__field">
                        <label htmlFor={`prod-unit-${stepIdx}-${prodIdx}`}>Unidade *</label>
                        <select
                          id={`prod-unit-${stepIdx}-${prodIdx}`}
                          value={product.doseUnit}
                          onChange={(e) =>
                            updateProduct(stepIdx, prodIdx, 'doseUnit', e.target.value)
                          }
                          required
                          aria-required="true"
                        >
                          {DOSE_UNITS.map((u) => (
                            <option key={u.value} value={u.value}>
                              {u.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            <button type="button" className="iatf-protocol-modal__add-btn" onClick={addStep}>
              <Plus size={16} aria-hidden="true" />
              Adicionar etapa
            </button>
          </fieldset>

          {/* Notes */}
          <div className="iatf-protocol-modal__field">
            <label htmlFor="iatf-notes">Observações gerais</label>
            <textarea
              id="iatf-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <footer className="iatf-protocol-modal__footer">
            <button
              type="button"
              className="iatf-protocol-modal__btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button type="submit" className="iatf-protocol-modal__btn-save" disabled={isLoading}>
              {isLoading ? 'Salvando...' : protocol ? 'Salvar alterações' : 'Cadastrar protocolo'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
