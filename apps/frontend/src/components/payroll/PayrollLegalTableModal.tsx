import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { CreateLegalTableInput, LegalTableType } from '@/types/payroll';
import { LEGAL_TABLE_TYPE_LABELS } from '@/types/payroll';
import './PayrollLegalTableModal.css';

interface BracketRow {
  fromValue: string;
  upTo: string;
  rate: string;
  deduction: string;
}

interface ScalarField {
  key: string;
  label: string;
  value: string;
}

interface PayrollLegalTableModalProps {
  isOpen: boolean;
  tableType: LegalTableType;
  onSave: (data: CreateLegalTableInput) => Promise<boolean>;
  onClose: () => void;
}

const BRACKET_TYPES: LegalTableType[] = ['INSS', 'IRRF'];
const HAS_DEDUCTION: LegalTableType[] = ['IRRF'];

function getScalarFields(tableType: LegalTableType): ScalarField[] {
  switch (tableType) {
    case 'SALARY_FAMILY':
      return [
        { key: 'valor_por_filho', label: 'Valor por filho (R$)', value: '' },
        { key: 'limite_renda', label: 'Limite de renda (R$)', value: '' },
      ];
    case 'MINIMUM_WAGE':
      return [{ key: 'salario_minimo_federal', label: 'Salário Mínimo Federal (R$)', value: '' }];
    case 'FUNRURAL':
      return [
        { key: 'pf_social', label: 'PF Social (%)', value: '' },
        { key: 'pf_rat', label: 'PF RAT (%)', value: '' },
        { key: 'pf_senar', label: 'PF SENAR (%)', value: '' },
        { key: 'pf_total', label: 'PF Total (%)', value: '' },
        { key: 'pj_funrural', label: 'PJ FUNRURAL (%)', value: '' },
        { key: 'pj_senar', label: 'PJ SENAR (%)', value: '' },
        { key: 'pj_total', label: 'PJ Total (%)', value: '' },
      ];
    default:
      return [];
  }
}

function defaultBracketRow(): BracketRow {
  return { fromValue: '', upTo: '', rate: '', deduction: '' };
}

export default function PayrollLegalTableModal({
  isOpen,
  tableType,
  onSave,
  onClose,
}: PayrollLegalTableModalProps) {
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<Element | null>(null);

  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [notes, setNotes] = useState('');
  const [brackets, setBrackets] = useState<BracketRow[]>([defaultBracketRow()]);
  const [scalars, setScalars] = useState<ScalarField[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isBracketType = BRACKET_TYPES.includes(tableType);
  const hasDeduction = HAS_DEDUCTION.includes(tableType);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
      setEffectiveFrom('');
      setNotes('');
      setBrackets([defaultBracketRow()]);
      setScalars(getScalarFields(tableType));
      setErrors({});
      setTimeout(() => firstFieldRef.current?.focus(), 100);
    }
  }, [isOpen, tableType]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        setTimeout(() => {
          if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
        }, 50);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const addBracket = () => {
    setBrackets((prev) => [...prev, defaultBracketRow()]);
  };

  const removeBracket = (index: number) => {
    setBrackets((prev) => prev.filter((_, i) => i !== index));
  };

  const updateBracket = (index: number, field: keyof BracketRow, value: string) => {
    setBrackets((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const updateScalar = (index: number, value: string) => {
    setScalars((prev) => prev.map((s, i) => (i === index ? { ...s, value } : s)));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!effectiveFrom) {
      newErrors.effectiveFrom = 'Vigência é obrigatória';
    }

    if (isBracketType) {
      if (brackets.length === 0) {
        newErrors.brackets = 'Adicione pelo menos uma faixa';
      }
      brackets.forEach((b, i) => {
        if (!b.fromValue) newErrors[`bracket-from-${i}`] = 'Campo obrigatório';
        if (!b.rate) newErrors[`bracket-rate-${i}`] = 'Campo obrigatório';
        const rate = parseFloat(b.rate);
        if (b.rate && (isNaN(rate) || rate < 0 || rate > 100)) {
          newErrors[`bracket-rate-${i}`] = 'Alíquota deve ser 0–100%';
        }
      });
    } else {
      scalars.forEach((s, i) => {
        if (!s.value) newErrors[`scalar-${i}`] = 'Campo obrigatório';
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const data: CreateLegalTableInput = {
        tableType,
        effectiveFrom: `${effectiveFrom}-01`,
        notes: notes.trim() || undefined,
        ...(isBracketType
          ? {
              brackets: brackets.map((b, idx) => ({
                fromValue: parseFloat(b.fromValue),
                upTo: b.upTo ? parseFloat(b.upTo) : null,
                rate: parseFloat(b.rate),
                ...(hasDeduction && b.deduction ? { deduction: parseFloat(b.deduction) } : {}),
                order: idx + 1,
              })),
            }
          : {
              scalarValues: scalars
                .filter((s) => s.value)
                .map((s) => ({ key: s.key, value: parseFloat(s.value) })),
            }),
      };

      const success = await onSave(data);
      if (success) {
        onClose();
        setTimeout(() => {
          if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
        }, 50);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = () => {
    if (!effectiveFrom) return false;
    if (isBracketType && brackets.length === 0) return false;
    return true;
  };

  if (!isOpen) return null;

  return (
    <div
      className="legal-table-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-table-modal-title"
    >
      <div className="legal-table-modal">
        {/* Header */}
        <div className="legal-table-modal__header">
          <h2 id="legal-table-modal-title" className="legal-table-modal__title">
            Atualizar Tabela — {LEGAL_TABLE_TYPE_LABELS[tableType]}
          </h2>
          <button
            type="button"
            className="legal-table-modal__close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => { void handleSubmit(e); }} noValidate>
          <div className="legal-table-modal__body">
            {/* Table type (display only) */}
            <div className="legal-table-modal__field">
              <span className="legal-table-modal__label">Tipo de Tabela</span>
              <div className="legal-table-modal__readonly">{LEGAL_TABLE_TYPE_LABELS[tableType]}</div>
            </div>

            {/* Effective from (month picker) */}
            <div className="legal-table-modal__field">
              <label htmlFor="legal-table-effective" className="legal-table-modal__label">
                Vigência a partir de <span aria-hidden="true">*</span>
              </label>
              <input
                ref={firstFieldRef}
                id="legal-table-effective"
                type="month"
                className={`legal-table-modal__input ${errors.effectiveFrom ? 'legal-table-modal__input--error' : ''}`}
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                required
                aria-required="true"
                aria-describedby={errors.effectiveFrom ? 'legal-table-effective-error' : undefined}
              />
              {errors.effectiveFrom && (
                <span id="legal-table-effective-error" className="legal-table-modal__error" role="alert">
                  {errors.effectiveFrom}
                </span>
              )}
              {errors.effectiveFrom === 'Já existe uma tabela com vigência neste mês. Escolha uma data diferente.' && (
                <span className="legal-table-modal__error" role="alert">
                  Já existe uma tabela com vigência neste mês. Escolha uma data diferente.
                </span>
              )}
            </div>

            {/* Bracket rows (INSS / IRRF) */}
            {isBracketType && (
              <div className="legal-table-modal__brackets-section">
                <div className="legal-table-modal__section-header">
                  <span className="legal-table-modal__label">Faixas de tributação</span>
                  {errors.brackets && (
                    <span className="legal-table-modal__error" role="alert">
                      {errors.brackets}
                    </span>
                  )}
                </div>
                <div className="legal-table-modal__bracket-wrapper">
                  <table className="legal-table-modal__bracket-table">
                    <thead>
                      <tr>
                        <th scope="col">De (R$)</th>
                        <th scope="col">Até (R$)</th>
                        <th scope="col">Alíquota (%)</th>
                        {hasDeduction && <th scope="col">Deduzir (R$)</th>}
                        <th scope="col">
                          <span className="sr-only">Ações</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {brackets.map((bracket, idx) => {
                        const isLastRow = idx === brackets.length - 1;
                        return (
                          <tr key={idx}>
                            {/* De (R$) */}
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className={`legal-table-modal__bracket-input ${errors[`bracket-from-${idx}`] ? 'legal-table-modal__input--error' : ''}`}
                                value={bracket.fromValue}
                                onChange={(e) => updateBracket(idx, 'fromValue', e.target.value)}
                                aria-label={`De (R$) - Faixa ${idx + 1}`}
                                aria-describedby={errors[`bracket-from-${idx}`] ? `bracket-from-${idx}-error` : undefined}
                              />
                              {errors[`bracket-from-${idx}`] && (
                                <span id={`bracket-from-${idx}-error`} className="legal-table-modal__error" role="alert">
                                  {errors[`bracket-from-${idx}`]}
                                </span>
                              )}
                            </td>
                            {/* Até (R$) */}
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="legal-table-modal__bracket-input"
                                value={isLastRow ? '' : bracket.upTo}
                                onChange={(e) => updateBracket(idx, 'upTo', e.target.value)}
                                disabled={isLastRow}
                                placeholder={isLastRow ? 'Sem limite' : undefined}
                                aria-label={`Até (R$) - Faixa ${idx + 1}${isLastRow ? ' (ilimitado)' : ''}`}
                              />
                            </td>
                            {/* Alíquota (%) */}
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                className={`legal-table-modal__bracket-input ${errors[`bracket-rate-${idx}`] ? 'legal-table-modal__input--error' : ''}`}
                                value={bracket.rate}
                                onChange={(e) => updateBracket(idx, 'rate', e.target.value)}
                                aria-label={`Alíquota (%) - Faixa ${idx + 1}`}
                                aria-describedby={errors[`bracket-rate-${idx}`] ? `bracket-rate-${idx}-error` : undefined}
                              />
                              {errors[`bracket-rate-${idx}`] && (
                                <span id={`bracket-rate-${idx}-error`} className="legal-table-modal__error" role="alert">
                                  {errors[`bracket-rate-${idx}`]}
                                </span>
                              )}
                            </td>
                            {/* Deduzir (R$) — IRRF only */}
                            {hasDeduction && (
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="legal-table-modal__bracket-input"
                                  value={bracket.deduction}
                                  onChange={(e) => updateBracket(idx, 'deduction', e.target.value)}
                                  aria-label={`Deduzir (R$) - Faixa ${idx + 1}`}
                                />
                              </td>
                            )}
                            {/* Remove button */}
                            <td>
                              {brackets.length > 1 && (
                                <button
                                  type="button"
                                  className="legal-table-modal__remove-btn"
                                  onClick={() => removeBracket(idx)}
                                  aria-label={`Remover faixa ${idx + 1}`}
                                >
                                  <Trash2 size={16} aria-hidden="true" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  className="legal-table-modal__add-bracket-btn"
                  onClick={addBracket}
                >
                  <Plus size={16} aria-hidden="true" />
                  Adicionar faixa
                </button>
              </div>
            )}

            {/* Scalar fields */}
            {!isBracketType && scalars.length > 0 && (
              <div className="legal-table-modal__scalars-section">
                <span className="legal-table-modal__label">Valores</span>
                {scalars.map((scalar, idx) => (
                  <div key={scalar.key} className="legal-table-modal__field legal-table-modal__field--scalar">
                    <label
                      htmlFor={`scalar-${scalar.key}`}
                      className="legal-table-modal__label legal-table-modal__label--small"
                    >
                      {scalar.label} <span aria-hidden="true">*</span>
                    </label>
                    <input
                      id={`scalar-${scalar.key}`}
                      type="number"
                      step="0.01"
                      min="0"
                      className={`legal-table-modal__input ${errors[`scalar-${idx}`] ? 'legal-table-modal__input--error' : ''}`}
                      value={scalar.value}
                      onChange={(e) => updateScalar(idx, e.target.value)}
                      aria-describedby={errors[`scalar-${idx}`] ? `scalar-${idx}-error` : undefined}
                    />
                    {errors[`scalar-${idx}`] && (
                      <span id={`scalar-${idx}-error`} className="legal-table-modal__error" role="alert">
                        {errors[`scalar-${idx}`]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Notes */}
            <div className="legal-table-modal__field">
              <label htmlFor="legal-table-notes" className="legal-table-modal__label">
                Observações
              </label>
              <input
                id="legal-table-notes"
                type="text"
                className="legal-table-modal__input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Portaria MPS/MF nº 13/2026"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="legal-table-modal__footer">
            <button
              type="button"
              className="legal-table-modal__btn legal-table-modal__btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="legal-table-modal__btn legal-table-modal__btn--primary"
              disabled={!isFormValid() || isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : 'Confirmar Tabela'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
