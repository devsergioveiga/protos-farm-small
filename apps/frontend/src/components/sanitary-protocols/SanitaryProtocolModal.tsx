import { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { api } from '@/services/api';
import type {
  SanitaryProtocol,
  CreateSanitaryProtocolInput,
  ItemInput,
} from '@/types/sanitary-protocol';
import {
  PROCEDURE_TYPES,
  TRIGGER_TYPES,
  EVENT_TRIGGERS,
  CALENDAR_FREQUENCIES,
  TARGET_CATEGORIES,
  ADMINISTRATION_ROUTES,
  DOSAGE_UNITS,
  MONTH_NAMES,
} from '@/types/sanitary-protocol';
import './SanitaryProtocolModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  protocol?: SanitaryProtocol | null;
  onSuccess: () => void;
}

const EMPTY_ITEM: ItemInput = {
  order: 1,
  procedureType: 'VACCINATION',
  productId: null,
  productName: '',
  dosage: null,
  dosageUnit: 'ML_ANIMAL',
  administrationRoute: 'SC',
  triggerType: 'AGE',
  triggerAgeDays: null,
  triggerAgeMaxDays: null,
  triggerEvent: null,
  triggerEventOffsetDays: null,
  calendarFrequency: null,
  calendarMonths: [],
  isReinforcement: false,
  reinforcementIntervalDays: null,
  reinforcementDoseNumber: null,
  withdrawalMeatDays: null,
  withdrawalMilkDays: null,
  notes: null,
};

interface FormData {
  name: string;
  description: string;
  authorName: string;
  status: string;
  isObligatory: boolean;
  targetCategories: string[];
  items: ItemInput[];
}

const EMPTY_FORM: FormData = {
  name: '',
  description: '',
  authorName: '',
  status: 'ACTIVE',
  isObligatory: false,
  targetCategories: [],
  items: [{ ...EMPTY_ITEM }],
};

export default function SanitaryProtocolModal({ isOpen, onClose, protocol, onSuccess }: Props) {
  const [formData, setFormData] = useState<FormData>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (protocol) {
      setFormData({
        name: protocol.name,
        description: protocol.description ?? '',
        authorName: protocol.authorName,
        status: protocol.status,
        isObligatory: protocol.isObligatory,
        targetCategories: [...protocol.targetCategories],
        items: protocol.items.map((i) => ({
          order: i.order,
          procedureType: i.procedureType,
          productId: i.productId,
          productName: i.productName,
          dosage: i.dosage,
          dosageUnit: i.dosageUnit,
          administrationRoute: i.administrationRoute,
          triggerType: i.triggerType,
          triggerAgeDays: i.triggerAgeDays,
          triggerAgeMaxDays: i.triggerAgeMaxDays,
          triggerEvent: i.triggerEvent,
          triggerEventOffsetDays: i.triggerEventOffsetDays,
          calendarFrequency: i.calendarFrequency,
          calendarMonths: [...i.calendarMonths],
          isReinforcement: i.isReinforcement,
          reinforcementIntervalDays: i.reinforcementIntervalDays,
          reinforcementDoseNumber: i.reinforcementDoseNumber,
          withdrawalMeatDays: i.withdrawalMeatDays,
          withdrawalMilkDays: i.withdrawalMilkDays,
          notes: i.notes,
        })),
      });
    } else {
      setFormData({ ...EMPTY_FORM, items: [{ ...EMPTY_ITEM }] });
    }
    setError(null);
  }, [protocol, isOpen]);

  const updateItem = useCallback((index: number, field: string, value: unknown) => {
    setFormData((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  }, []);

  const addItem = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { ...EMPTY_ITEM, order: prev.items.length + 1 }],
    }));
  }, []);

  const removeItem = useCallback((index: number) => {
    setFormData((prev) => {
      const items = prev.items
        .filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, order: i + 1 }));
      return { ...prev, items };
    });
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setFormData((prev) => {
      const categories = prev.targetCategories.includes(category)
        ? prev.targetCategories.filter((c) => c !== category)
        : [...prev.targetCategories, category];
      return { ...prev, targetCategories: categories };
    });
  }, []);

  const toggleMonth = useCallback((index: number, month: number) => {
    setFormData((prev) => {
      const items = [...prev.items];
      const currentMonths = items[index].calendarMonths ?? [];
      const newMonths = currentMonths.includes(month)
        ? currentMonths.filter((m) => m !== month)
        : [...currentMonths, month].sort((a, b) => a - b);
      items[index] = { ...items[index], calendarMonths: newMonths };
      return { ...prev, items };
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const payload: CreateSanitaryProtocolInput = {
      name: formData.name,
      description: formData.description || null,
      authorName: formData.authorName,
      status: formData.status,
      isObligatory: formData.isObligatory,
      targetCategories: formData.targetCategories,
      items: formData.items.map((item) => ({
        ...item,
        productId: item.productId || null,
        notes: item.notes || null,
        dosage: item.dosage ?? null,
        dosageUnit: item.dosageUnit || null,
        administrationRoute: item.administrationRoute || null,
        triggerAgeDays: item.triggerType === 'AGE' ? (item.triggerAgeDays ?? null) : null,
        triggerAgeMaxDays: item.triggerType === 'AGE' ? (item.triggerAgeMaxDays ?? null) : null,
        triggerEvent: item.triggerType === 'EVENT' ? (item.triggerEvent ?? null) : null,
        triggerEventOffsetDays:
          item.triggerType === 'EVENT' ? (item.triggerEventOffsetDays ?? null) : null,
        calendarFrequency:
          item.triggerType === 'CALENDAR' ? (item.calendarFrequency ?? null) : null,
        calendarMonths: item.triggerType === 'CALENDAR' ? (item.calendarMonths ?? []) : [],
        withdrawalMeatDays: item.withdrawalMeatDays ?? null,
        withdrawalMilkDays: item.withdrawalMilkDays ?? null,
        reinforcementIntervalDays: item.isReinforcement
          ? (item.reinforcementIntervalDays ?? null)
          : null,
        reinforcementDoseNumber: item.isReinforcement
          ? (item.reinforcementDoseNumber ?? null)
          : null,
      })),
    };

    try {
      if (protocol) {
        await api.patch(`/org/sanitary-protocols/${protocol.id}`, payload);
      } else {
        await api.post('/org/sanitary-protocols', payload);
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
    <div className="sp-modal__overlay" onClick={onClose}>
      <div
        className="sp-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sp-modal-title"
      >
        <header className="sp-modal__header">
          <h2 id="sp-modal-title">
            {protocol ? 'Editar protocolo sanitário' : 'Novo protocolo sanitário'}
          </h2>
          <button type="button" className="sp-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="sp-modal__form">
          {error && (
            <div className="sp-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Basic info */}
          <div className="sp-modal__row">
            <div className="sp-modal__field">
              <label htmlFor="sp-name">Nome do protocolo *</label>
              <input
                id="sp-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                aria-required="true"
                placeholder="Ex: Protocolo Vacinal Bezerras"
              />
            </div>
            <div className="sp-modal__field">
              <label htmlFor="sp-author">Autor *</label>
              <input
                id="sp-author"
                type="text"
                value={formData.authorName}
                onChange={(e) => setFormData({ ...formData, authorName: e.target.value })}
                required
                aria-required="true"
                placeholder="Ex: Dr. João Silva"
              />
            </div>
          </div>

          <div className="sp-modal__row">
            <div className="sp-modal__field">
              <label htmlFor="sp-status">Status</label>
              <select
                id="sp-status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </select>
            </div>
            <div className="sp-modal__field" style={{ justifyContent: 'flex-end' }}>
              <div className="sp-modal__checkbox">
                <input
                  id="sp-obligatory"
                  type="checkbox"
                  checked={formData.isObligatory}
                  onChange={(e) => setFormData({ ...formData, isObligatory: e.target.checked })}
                />
                <label htmlFor="sp-obligatory">Protocolo obrigatório (MAPA)</label>
              </div>
            </div>
          </div>

          <div className="sp-modal__field">
            <label htmlFor="sp-description">Descrição</label>
            <textarea
              id="sp-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          {/* Target categories */}
          <fieldset className="sp-modal__fieldset">
            <legend>Categorias alvo</legend>
            <div className="sp-modal__category-grid">
              {TARGET_CATEGORIES.map((c) => (
                <label key={c.value} className="sp-modal__category-chip">
                  <input
                    type="checkbox"
                    checked={formData.targetCategories.includes(c.value)}
                    onChange={() => toggleCategory(c.value)}
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Items (procedures) */}
          <fieldset className="sp-modal__fieldset">
            <legend>Procedimentos *</legend>
            {formData.items.map((item, idx) => (
              <div key={idx} className="sp-modal__item">
                <div className="sp-modal__item-header">
                  <span className="sp-modal__item-number">Procedimento {idx + 1}</span>
                  {formData.items.length > 1 && (
                    <button
                      type="button"
                      className="sp-modal__item-remove"
                      onClick={() => removeItem(idx)}
                      aria-label={`Remover procedimento ${idx + 1}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>

                {/* Product + type */}
                <div className="sp-modal__row">
                  <div className="sp-modal__field">
                    <label htmlFor={`item-product-${idx}`}>Produto/Vacina *</label>
                    <input
                      id={`item-product-${idx}`}
                      type="text"
                      value={item.productName}
                      onChange={(e) => updateItem(idx, 'productName', e.target.value)}
                      required
                      aria-required="true"
                    />
                  </div>
                  <div className="sp-modal__field">
                    <label htmlFor={`item-type-${idx}`}>Tipo *</label>
                    <select
                      id={`item-type-${idx}`}
                      value={item.procedureType}
                      onChange={(e) => updateItem(idx, 'procedureType', e.target.value)}
                      required
                      aria-required="true"
                    >
                      {PROCEDURE_TYPES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Dosage + route */}
                <div className="sp-modal__row--three">
                  <div className="sp-modal__field">
                    <label htmlFor={`item-dosage-${idx}`}>Dosagem</label>
                    <input
                      id={`item-dosage-${idx}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.dosage ?? ''}
                      onChange={(e) =>
                        updateItem(idx, 'dosage', e.target.value ? Number(e.target.value) : null)
                      }
                    />
                  </div>
                  <div className="sp-modal__field">
                    <label htmlFor={`item-unit-${idx}`}>Unidade</label>
                    <select
                      id={`item-unit-${idx}`}
                      value={item.dosageUnit ?? ''}
                      onChange={(e) => updateItem(idx, 'dosageUnit', e.target.value || null)}
                    >
                      <option value="">Selecione...</option>
                      {DOSAGE_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sp-modal__field">
                    <label htmlFor={`item-route-${idx}`}>Via</label>
                    <select
                      id={`item-route-${idx}`}
                      value={item.administrationRoute ?? ''}
                      onChange={(e) =>
                        updateItem(idx, 'administrationRoute', e.target.value || null)
                      }
                    >
                      <option value="">Selecione...</option>
                      {ADMINISTRATION_ROUTES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Trigger */}
                <p className="sp-modal__trigger-label">Gatilho</p>
                <div className="sp-modal__row--three">
                  <div className="sp-modal__field">
                    <label htmlFor={`item-trigger-${idx}`}>Tipo de gatilho *</label>
                    <select
                      id={`item-trigger-${idx}`}
                      value={item.triggerType}
                      onChange={(e) => updateItem(idx, 'triggerType', e.target.value)}
                      required
                      aria-required="true"
                    >
                      {TRIGGER_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* AGE fields */}
                  {item.triggerType === 'AGE' && (
                    <>
                      <div className="sp-modal__field">
                        <label htmlFor={`item-age-${idx}`}>Idade (dias) *</label>
                        <input
                          id={`item-age-${idx}`}
                          type="number"
                          min="1"
                          value={item.triggerAgeDays ?? ''}
                          onChange={(e) =>
                            updateItem(
                              idx,
                              'triggerAgeDays',
                              e.target.value ? Number(e.target.value) : null,
                            )
                          }
                          required
                          aria-required="true"
                        />
                      </div>
                      <div className="sp-modal__field">
                        <label htmlFor={`item-age-max-${idx}`}>Idade máx. (dias)</label>
                        <input
                          id={`item-age-max-${idx}`}
                          type="number"
                          min="1"
                          value={item.triggerAgeMaxDays ?? ''}
                          onChange={(e) =>
                            updateItem(
                              idx,
                              'triggerAgeMaxDays',
                              e.target.value ? Number(e.target.value) : null,
                            )
                          }
                        />
                      </div>
                    </>
                  )}

                  {/* EVENT fields */}
                  {item.triggerType === 'EVENT' && (
                    <>
                      <div className="sp-modal__field">
                        <label htmlFor={`item-event-${idx}`}>Evento *</label>
                        <select
                          id={`item-event-${idx}`}
                          value={item.triggerEvent ?? ''}
                          onChange={(e) => updateItem(idx, 'triggerEvent', e.target.value || null)}
                          required
                          aria-required="true"
                        >
                          <option value="">Selecione...</option>
                          {EVENT_TRIGGERS.map((ev) => (
                            <option key={ev.value} value={ev.value}>
                              {ev.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sp-modal__field">
                        <label htmlFor={`item-offset-${idx}`}>Offset (dias)</label>
                        <input
                          id={`item-offset-${idx}`}
                          type="number"
                          value={item.triggerEventOffsetDays ?? ''}
                          onChange={(e) =>
                            updateItem(
                              idx,
                              'triggerEventOffsetDays',
                              e.target.value ? Number(e.target.value) : null,
                            )
                          }
                          placeholder="Ex: -30 = 30 dias antes"
                        />
                      </div>
                    </>
                  )}

                  {/* CALENDAR fields */}
                  {item.triggerType === 'CALENDAR' && (
                    <>
                      <div className="sp-modal__field">
                        <label htmlFor={`item-freq-${idx}`}>Frequência *</label>
                        <select
                          id={`item-freq-${idx}`}
                          value={item.calendarFrequency ?? ''}
                          onChange={(e) =>
                            updateItem(idx, 'calendarFrequency', e.target.value || null)
                          }
                          required
                          aria-required="true"
                        >
                          <option value="">Selecione...</option>
                          {CALENDAR_FREQUENCIES.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sp-modal__field" />
                    </>
                  )}
                </div>

                {/* Calendar months */}
                {item.triggerType === 'CALENDAR' && (
                  <div className="sp-modal__field">
                    <label>Meses de aplicação</label>
                    <div className="sp-modal__month-grid">
                      {MONTH_NAMES.map((name, mIdx) => (
                        <label key={mIdx} className="sp-modal__month-chip">
                          <input
                            type="checkbox"
                            checked={(item.calendarMonths ?? []).includes(mIdx + 1)}
                            onChange={() => toggleMonth(idx, mIdx + 1)}
                          />
                          <span>{name.slice(0, 3)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reinforcement */}
                <div className="sp-modal__checkbox">
                  <input
                    id={`item-reinf-${idx}`}
                    type="checkbox"
                    checked={item.isReinforcement ?? false}
                    onChange={(e) => updateItem(idx, 'isReinforcement', e.target.checked)}
                  />
                  <label htmlFor={`item-reinf-${idx}`}>É reforço/revacinação</label>
                </div>

                {item.isReinforcement && (
                  <div className="sp-modal__row">
                    <div className="sp-modal__field">
                      <label htmlFor={`item-reinf-interval-${idx}`}>Intervalo reforço (dias)</label>
                      <input
                        id={`item-reinf-interval-${idx}`}
                        type="number"
                        min="1"
                        value={item.reinforcementIntervalDays ?? ''}
                        onChange={(e) =>
                          updateItem(
                            idx,
                            'reinforcementIntervalDays',
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      />
                    </div>
                    <div className="sp-modal__field">
                      <label htmlFor={`item-reinf-dose-${idx}`}>Nº da dose</label>
                      <input
                        id={`item-reinf-dose-${idx}`}
                        type="number"
                        min="1"
                        value={item.reinforcementDoseNumber ?? ''}
                        onChange={(e) =>
                          updateItem(
                            idx,
                            'reinforcementDoseNumber',
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      />
                    </div>
                  </div>
                )}

                {/* Withdrawal */}
                <div className="sp-modal__row">
                  <div className="sp-modal__field">
                    <label htmlFor={`item-meat-${idx}`}>Carência abate (dias)</label>
                    <input
                      id={`item-meat-${idx}`}
                      type="number"
                      min="0"
                      value={item.withdrawalMeatDays ?? ''}
                      onChange={(e) =>
                        updateItem(
                          idx,
                          'withdrawalMeatDays',
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                    />
                  </div>
                  <div className="sp-modal__field">
                    <label htmlFor={`item-milk-${idx}`}>Carência leite (dias)</label>
                    <input
                      id={`item-milk-${idx}`}
                      type="number"
                      min="0"
                      value={item.withdrawalMilkDays ?? ''}
                      onChange={(e) =>
                        updateItem(
                          idx,
                          'withdrawalMilkDays',
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="sp-modal__field">
                  <label htmlFor={`item-notes-${idx}`}>Observações</label>
                  <input
                    id={`item-notes-${idx}`}
                    type="text"
                    value={item.notes ?? ''}
                    onChange={(e) => updateItem(idx, 'notes', e.target.value || null)}
                  />
                </div>
              </div>
            ))}

            <button type="button" className="sp-modal__add-item" onClick={addItem}>
              <Plus size={16} aria-hidden="true" />
              Adicionar procedimento
            </button>
          </fieldset>

          <footer className="sp-modal__footer">
            <button
              type="button"
              className="sp-modal__btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button type="submit" className="sp-modal__btn-save" disabled={isLoading}>
              {isLoading ? 'Salvando...' : protocol ? 'Salvar alterações' : 'Cadastrar protocolo'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
