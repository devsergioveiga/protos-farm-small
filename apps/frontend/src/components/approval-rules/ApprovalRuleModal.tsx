import { useState, useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { ApprovalRule, CreateApprovalRuleInput } from '@/hooks/useApprovalRules';
import { SUPPLIER_CATEGORY_LABELS } from '@/types/purchase-request';
import './ApprovalRuleModal.css';

interface ApprovalRuleModalProps {
  isOpen: boolean;
  rule: ApprovalRule | null;
  existingRules: ApprovalRule[];
  onClose: () => void;
  onSave: (input: CreateApprovalRuleInput) => Promise<void>;
}

interface OrgUser {
  id: string;
  name: string;
  email: string;
}

interface FormState {
  name: string;
  requestType: string;
  minValue: string;
  maxValue: string;
  noMaxValue: boolean;
  approver1Id: string;
  doubleApproval: boolean;
  approver2Id: string;
  priority: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  requestType: '',
  minValue: '0',
  maxValue: '',
  noMaxValue: false,
  approver1Id: '',
  doubleApproval: false,
  approver2Id: '',
  priority: '',
};

function ruleToForm(rule: ApprovalRule): FormState {
  return {
    name: rule.name,
    requestType: rule.requestType ?? '',
    minValue: String(rule.minValue),
    maxValue: rule.maxValue != null ? String(rule.maxValue) : '',
    noMaxValue: rule.maxValue == null,
    approver1Id: rule.approver1Id,
    doubleApproval: rule.approver2Id != null,
    approver2Id: rule.approver2Id ?? '',
    priority: String(rule.priority),
  };
}

function detectOverlap(
  minVal: number,
  maxVal: number | null,
  existingRules: ApprovalRule[],
  excludeId?: string,
): boolean {
  for (const rule of existingRules) {
    if (rule.id === excludeId) continue;
    const rMax = rule.maxValue;
    // Check if ranges overlap
    const startOverlaps = rMax == null || minVal <= rMax;
    const endOverlaps = maxVal == null || maxVal >= rule.minValue;
    if (startOverlaps && endOverlaps) return true;
  }
  return false;
}

export default function ApprovalRuleModal({
  isOpen,
  rule,
  existingRules,
  onClose,
  onSave,
}: ApprovalRuleModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [overlapWarning, setOverlapWarning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [orgUsers] = useState<OrgUser[]>([]);
  const firstFocusRef = useRef<HTMLInputElement>(null);

  const isEdit = rule != null;

  useEffect(() => {
    if (isOpen) {
      setForm(rule ? ruleToForm(rule) : EMPTY_FORM);
      setErrors({});
      setApiError(null);
      setOverlapWarning(false);
      setTimeout(() => firstFocusRef.current?.focus(), 100);
    }
  }, [isOpen, rule]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  function handleClose() {
    const isDirty = JSON.stringify(form) !== JSON.stringify(rule ? ruleToForm(rule) : EMPTY_FORM);
    if (isDirty) {
      setShowUnsavedConfirm(true);
    } else {
      onClose();
    }
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormState, string>> = {};

    if (!form.name.trim()) newErrors.name = 'Nome da regra e obrigatorio';
    if (!form.approver1Id) newErrors.approver1Id = 'Aprovador 1 e obrigatorio';
    if (form.doubleApproval && !form.approver2Id)
      newErrors.approver2Id = 'Aprovador 2 e obrigatorio para aprovacao dupla';
    if (
      !form.priority ||
      isNaN(Number(form.priority)) ||
      Number(form.priority) < 1 ||
      Number(form.priority) > 99
    ) {
      newErrors.priority = 'Prioridade deve ser entre 1 e 99';
    }

    const minVal = parseFloat(form.minValue);
    if (isNaN(minVal) || minVal < 0) newErrors.minValue = 'Valor minimo invalido';

    if (!form.noMaxValue && form.maxValue) {
      const maxVal = parseFloat(form.maxValue);
      if (isNaN(maxVal)) {
        newErrors.maxValue = 'Valor maximo invalido';
      } else if (!isNaN(minVal) && maxVal <= minVal) {
        newErrors.maxValue = 'Valor maximo deve ser maior que o minimo';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const minVal = parseFloat(form.minValue) || 0;
    const maxVal = form.noMaxValue || !form.maxValue ? null : parseFloat(form.maxValue);

    // Check overlap warning
    const hasOverlap = detectOverlap(minVal, maxVal, existingRules, rule?.id);
    if (hasOverlap) setOverlapWarning(true);

    const input: CreateApprovalRuleInput = {
      name: form.name.trim(),
      requestType: form.requestType || null,
      minValue: minVal,
      maxValue: maxVal,
      approver1Id: form.approver1Id,
      approver2Id: form.doubleApproval && form.approver2Id ? form.approver2Id : null,
      priority: parseInt(form.priority, 10),
    };

    setIsLoading(true);
    setApiError(null);
    try {
      await onSave(input);
      onClose();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Erro ao salvar regra');
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) return null;

  const requestTypeOptions = Object.entries(SUPPLIER_CATEGORY_LABELS);

  return (
    <>
      <div
        className="arm-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="arm-title"
      >
        <div className="arm-modal">
          <header className="arm-modal__header">
            <h2 id="arm-title" className="arm-modal__title">
              {isEdit ? 'Editar Regra de Alcada' : 'Nova Regra de Alcada'}
            </h2>
            <button
              type="button"
              className="arm-modal__close"
              onClick={handleClose}
              aria-label="Fechar modal"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </header>

          <form className="arm-modal__body" onSubmit={handleSubmit} noValidate>
            {apiError && (
              <p className="arm-error-msg arm-error-msg--block" role="alert">
                {apiError}
              </p>
            )}

            {overlapWarning && (
              <div className="arm-warning-banner" role="alert">
                Aviso: os valores desta regra se sobrepoem com outra regra existente. Verifique as
                prioridades.
              </div>
            )}

            {/* Nome */}
            <div className="arm-field">
              <label htmlFor="arm-name" className="arm-label">
                Nome da regra <span aria-hidden="true">*</span>
              </label>
              <input
                ref={firstFocusRef}
                id="arm-name"
                type="text"
                className={`arm-input${errors.name ? ' arm-input--error' : ''}`}
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                aria-required="true"
                aria-describedby={errors.name ? 'arm-name-error' : undefined}
                placeholder="Ex: Compras de insumos acima de R$ 5.000"
              />
              {errors.name && (
                <span id="arm-name-error" className="arm-error-msg" role="alert">
                  {errors.name}
                </span>
              )}
            </div>

            {/* Tipo de RC */}
            <div className="arm-field">
              <label htmlFor="arm-type" className="arm-label">
                Tipo de RC
              </label>
              <select
                id="arm-type"
                className="arm-select"
                value={form.requestType}
                onChange={(e) => updateField('requestType', e.target.value)}
              >
                <option value="">Todos os tipos</option>
                {requestTypeOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Valor min / max */}
            <div className="arm-field-row">
              <div className="arm-field">
                <label htmlFor="arm-min-value" className="arm-label">
                  Valor minimo (R$)
                </label>
                <input
                  id="arm-min-value"
                  type="number"
                  min="0"
                  step="0.01"
                  className={`arm-input${errors.minValue ? ' arm-input--error' : ''}`}
                  value={form.minValue}
                  onChange={(e) => updateField('minValue', e.target.value)}
                  aria-describedby={errors.minValue ? 'arm-min-error' : undefined}
                />
                {errors.minValue && (
                  <span id="arm-min-error" className="arm-error-msg" role="alert">
                    {errors.minValue}
                  </span>
                )}
              </div>

              <div className="arm-field">
                <label htmlFor="arm-max-value" className="arm-label">
                  Valor maximo (R$)
                </label>
                <input
                  id="arm-max-value"
                  type="number"
                  min="0"
                  step="0.01"
                  className={`arm-input${errors.maxValue ? ' arm-input--error' : ''}`}
                  value={form.noMaxValue ? '' : form.maxValue}
                  onChange={(e) => updateField('maxValue', e.target.value)}
                  disabled={form.noMaxValue}
                  placeholder={form.noMaxValue ? 'Sem limite' : ''}
                  aria-describedby={errors.maxValue ? 'arm-max-error' : undefined}
                />
                {errors.maxValue && (
                  <span id="arm-max-error" className="arm-error-msg" role="alert">
                    {errors.maxValue}
                  </span>
                )}
                <label className="arm-checkbox-label arm-checkbox-label--inline">
                  <input
                    type="checkbox"
                    checked={form.noMaxValue}
                    onChange={(e) => updateField('noMaxValue', e.target.checked)}
                  />
                  Sem limite superior
                </label>
              </div>
            </div>

            {/* Aprovador 1 */}
            <div className="arm-field">
              <label htmlFor="arm-approver1" className="arm-label">
                Aprovador 1 <span aria-hidden="true">*</span>
              </label>
              <select
                id="arm-approver1"
                className={`arm-select${errors.approver1Id ? ' arm-select--error' : ''}`}
                value={form.approver1Id}
                onChange={(e) => updateField('approver1Id', e.target.value)}
                aria-required="true"
                aria-describedby={errors.approver1Id ? 'arm-approver1-error' : undefined}
              >
                <option value="">Selecione um aprovador</option>
                {orgUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
                {/* Placeholder when no users loaded — shows text field hint */}
                {orgUsers.length === 0 && form.approver1Id && (
                  <option value={form.approver1Id}>{form.approver1Id}</option>
                )}
              </select>
              {orgUsers.length === 0 && (
                <p className="arm-hint">
                  Cole o ID do usuario aprovador (disponivel apos sincronizacao de usuarios)
                </p>
              )}
              {errors.approver1Id && (
                <span id="arm-approver1-error" className="arm-error-msg" role="alert">
                  {errors.approver1Id}
                </span>
              )}
            </div>

            {/* Aprovacao dupla */}
            <div className="arm-field">
              <label className="arm-checkbox-label">
                <input
                  type="checkbox"
                  checked={form.doubleApproval}
                  onChange={(e) => updateField('doubleApproval', e.target.checked)}
                />
                Aprovacao dupla (requer dois aprovadores)
              </label>
            </div>

            {/* Aprovador 2 — collapsible */}
            <div
              className={`arm-field arm-field--collapsible${form.doubleApproval ? ' arm-field--visible' : ''}`}
            >
              <label htmlFor="arm-approver2" className="arm-label">
                Aprovador 2 <span aria-hidden="true">*</span>
              </label>
              <select
                id="arm-approver2"
                className={`arm-select${errors.approver2Id ? ' arm-select--error' : ''}`}
                value={form.approver2Id}
                onChange={(e) => updateField('approver2Id', e.target.value)}
                aria-required={form.doubleApproval}
                disabled={!form.doubleApproval}
                aria-describedby={errors.approver2Id ? 'arm-approver2-error' : undefined}
              >
                <option value="">Selecione o segundo aprovador</option>
                {orgUsers
                  .filter((u) => u.id !== form.approver1Id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                {orgUsers.length === 0 && form.approver2Id && (
                  <option value={form.approver2Id}>{form.approver2Id}</option>
                )}
              </select>
              {errors.approver2Id && (
                <span id="arm-approver2-error" className="arm-error-msg" role="alert">
                  {errors.approver2Id}
                </span>
              )}
            </div>

            {/* Prioridade */}
            <div className="arm-field arm-field--half">
              <label htmlFor="arm-priority" className="arm-label">
                Prioridade <span aria-hidden="true">*</span>
              </label>
              <input
                id="arm-priority"
                type="number"
                min="1"
                max="99"
                className={`arm-input${errors.priority ? ' arm-input--error' : ''}`}
                value={form.priority}
                onChange={(e) => updateField('priority', e.target.value)}
                aria-required="true"
                aria-describedby="arm-priority-hint"
                placeholder="1–99"
              />
              <span id="arm-priority-hint" className="arm-hint">
                Menor numero = maior prioridade na avaliacao de alcada
              </span>
              {errors.priority && (
                <span className="arm-error-msg" role="alert">
                  {errors.priority}
                </span>
              )}
            </div>

            <div className="arm-modal__footer">
              <button
                type="button"
                className="arm-btn arm-btn--ghost"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancelar
              </button>
              <button type="submit" className="arm-btn arm-btn--primary" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="arm-spin" aria-hidden="true" />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmModal
        isOpen={showUnsavedConfirm}
        title="Descartar alteracoes?"
        message="Voce tem alteracoes nao salvas. Se fechar agora, elas serao perdidas."
        confirmLabel="Descartar"
        cancelLabel="Continuar editando"
        variant="warning"
        onConfirm={() => {
          setShowUnsavedConfirm(false);
          onClose();
        }}
        onCancel={() => setShowUnsavedConfirm(false)}
      />
    </>
  );
}
