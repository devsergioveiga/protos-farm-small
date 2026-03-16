import { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, ShoppingCart } from 'lucide-react';
import type { AddExpenseInput } from '@/hooks/useCreditCards';
import './CreditCardExpenseModal.css';

// ─── Types ──────────────────────────────────────────────────────────

interface CreditCardExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (input: AddExpenseInput) => Promise<void>;
  cardId: string;
}

interface FormErrors {
  description?: string;
  amount?: string;
  totalInstallments?: string;
  expenseDate?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────

function parseBRL(val: string): number {
  const cleaned = val.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function formatBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Component ────────────────────────────────────────────────────

const CreditCardExpenseModal = ({ isOpen, onClose, onSuccess }: CreditCardExpenseModalProps) => {
  const [description, setDescription] = useState('');
  const [amountDisplay, setAmountDisplay] = useState('');
  const [totalInstallments, setTotalInstallments] = useState('1');
  const [expenseDate, setExpenseDate] = useState(today());
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const firstFieldRef = useRef<HTMLInputElement>(null);
  const titleId = 'expense-modal-title';

  const installmentCount = parseInt(totalInstallments) || 1;
  const totalAmount = parseBRL(amountDisplay);
  const installmentValue = installmentCount > 0 ? totalAmount / installmentCount : 0;

  // Reset
  useEffect(() => {
    if (!isOpen) {
      setDescription('');
      setAmountDisplay('');
      setTotalInstallments('1');
      setExpenseDate(today());
      setCategory('');
      setNotes('');
      setErrors({});
      setSubmitError(null);
    }
  }, [isOpen]);

  // Focus first field
  useEffect(() => {
    if (isOpen) setTimeout(() => firstFieldRef.current?.focus(), 50);
  }, [isOpen]);

  // Escape closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!description.trim()) newErrors.description = 'Descrição é obrigatória';
    if (description.trim().length > 200)
      newErrors.description = 'Descrição deve ter no máximo 200 caracteres';
    const amount = parseBRL(amountDisplay);
    if (!amount || amount <= 0) newErrors.amount = 'Valor é obrigatório e deve ser maior que zero';
    const inst = parseInt(totalInstallments);
    if (!inst || inst < 1 || inst > 24)
      newErrors.totalInstallments = 'Parcelas deve ser entre 1 e 24';
    if (!expenseDate) newErrors.expenseDate = 'Data do gasto é obrigatória';
    else if (expenseDate > today()) newErrors.expenseDate = 'Data do gasto não pode ser futura';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const input: AddExpenseInput = {
      description: description.trim(),
      amount: parseBRL(amountDisplay),
      totalInstallments: parseInt(totalInstallments),
      expenseDate,
      category: category.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    try {
      await onSuccess(input);
    } catch {
      setSubmitError('Não foi possível registrar o gasto. Verifique os dados e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="cem-modal__backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="cem-modal__panel">
        <header className="cem-modal__header">
          <div className="cem-modal__header-icon" aria-hidden="true">
            <ShoppingCart size={20} />
          </div>
          <h2 id={titleId} className="cem-modal__title">
            Novo gasto
          </h2>
          <button type="button" className="cem-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="cem-modal__body">
            {submitError && (
              <div className="cem-modal__submit-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {submitError}
              </div>
            )}

            {/* Descrição */}
            <div className="cem-modal__field">
              <label htmlFor="cem-description" className="cem-modal__label">
                Descrição <span aria-label="obrigatório">*</span>
              </label>
              <input
                id="cem-description"
                ref={firstFieldRef}
                type="text"
                maxLength={200}
                className={`cem-modal__input${errors.description ? ' cem-modal__input--error' : ''}`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => {
                  if (!description.trim())
                    setErrors((p) => ({ ...p, description: 'Descrição é obrigatória' }));
                  else setErrors((p) => ({ ...p, description: undefined }));
                }}
                aria-required="true"
                aria-describedby={errors.description ? 'cem-desc-err' : undefined}
                placeholder="Ex: Combustível, Material de escritório..."
              />
              {errors.description && (
                <span id="cem-desc-err" className="cem-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {errors.description}
                </span>
              )}
            </div>

            {/* Valor + Parcelas */}
            <div className="cem-modal__row">
              <div className="cem-modal__field">
                <label htmlFor="cem-amount" className="cem-modal__label">
                  Valor total <span aria-label="obrigatório">*</span>
                </label>
                <input
                  id="cem-amount"
                  type="text"
                  inputMode="decimal"
                  className={`cem-modal__input cem-modal__input--mono${errors.amount ? ' cem-modal__input--error' : ''}`}
                  value={amountDisplay}
                  onChange={(e) => setAmountDisplay(e.target.value)}
                  onBlur={() => {
                    const num = parseBRL(amountDisplay);
                    if (num > 0) {
                      setAmountDisplay(formatBRL(num));
                      setErrors((p) => ({ ...p, amount: undefined }));
                    } else {
                      setErrors((p) => ({
                        ...p,
                        amount: 'Valor é obrigatório e deve ser maior que zero',
                      }));
                    }
                  }}
                  aria-required="true"
                  placeholder="R$ 0,00"
                />
                {errors.amount && (
                  <span className="cem-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.amount}
                  </span>
                )}
              </div>

              <div className="cem-modal__field">
                <label htmlFor="cem-installments" className="cem-modal__label">
                  Parcelas <span aria-label="obrigatório">*</span>
                </label>
                <input
                  id="cem-installments"
                  type="number"
                  min={1}
                  max={24}
                  className={`cem-modal__input${errors.totalInstallments ? ' cem-modal__input--error' : ''}`}
                  value={totalInstallments}
                  onChange={(e) => setTotalInstallments(e.target.value)}
                  onBlur={() => {
                    const val = parseInt(totalInstallments);
                    if (!val || val < 1 || val > 24) {
                      setErrors((p) => ({
                        ...p,
                        totalInstallments: 'Parcelas deve ser entre 1 e 24',
                      }));
                    } else {
                      setErrors((p) => ({ ...p, totalInstallments: undefined }));
                    }
                  }}
                  aria-required="true"
                  aria-describedby="cem-installment-preview"
                />
                {errors.totalInstallments && (
                  <span className="cem-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.totalInstallments}
                  </span>
                )}
              </div>
            </div>

            {/* Installment preview */}
            {totalAmount > 0 && installmentCount > 1 && (
              <p id="cem-installment-preview" className="cem-modal__installment-preview">
                Cada parcela: <strong>{formatBRL(installmentValue)}</strong> ({installmentCount}x de{' '}
                {formatBRL(installmentValue)})
              </p>
            )}

            {/* Data do gasto */}
            <div className="cem-modal__field">
              <label htmlFor="cem-expense-date" className="cem-modal__label">
                Data do gasto <span aria-label="obrigatório">*</span>
              </label>
              <input
                id="cem-expense-date"
                type="date"
                max={today()}
                className={`cem-modal__input${errors.expenseDate ? ' cem-modal__input--error' : ''}`}
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                onBlur={() => {
                  if (!expenseDate)
                    setErrors((p) => ({ ...p, expenseDate: 'Data do gasto é obrigatória' }));
                  else if (expenseDate > today())
                    setErrors((p) => ({ ...p, expenseDate: 'Data não pode ser futura' }));
                  else setErrors((p) => ({ ...p, expenseDate: undefined }));
                }}
                aria-required="true"
              />
              {errors.expenseDate && (
                <span className="cem-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {errors.expenseDate}
                </span>
              )}
            </div>

            {/* Categoria */}
            <div className="cem-modal__field">
              <label htmlFor="cem-category" className="cem-modal__label">
                Categoria
              </label>
              <input
                id="cem-category"
                type="text"
                className="cem-modal__input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ex: Combustível, Alimentação..."
              />
            </div>

            {/* Observações */}
            <div className="cem-modal__field">
              <label htmlFor="cem-notes" className="cem-modal__label">
                Observações
              </label>
              <textarea
                id="cem-notes"
                className="cem-modal__textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Informações adicionais..."
              />
            </div>
          </div>

          <footer className="cem-modal__footer">
            <button type="button" className="cem-modal__btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="cem-modal__btn-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Registrando...' : 'Registrar gasto'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default CreditCardExpenseModal;
