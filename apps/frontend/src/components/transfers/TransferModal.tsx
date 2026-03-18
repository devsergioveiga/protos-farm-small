import { useState, useEffect, useRef, useCallback } from 'react';
import { X, AlertCircle, ArrowLeftRight } from 'lucide-react';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useTransfers } from '@/hooks/useTransfers';
import type { TransferType } from '@/hooks/useTransfers';
import './TransferModal.css';

// ─── Types ──────────────────────────────────────────────────────────

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormErrors {
  fromAccountId?: string;
  toAccountId?: string;
  amount?: string;
  feeAmount?: string;
  transferDate?: string;
  description?: string;
  accounts?: string;
}

const TRANSFER_TYPE_OPTIONS: { value: TransferType; label: string }[] = [
  { value: 'INTERNA', label: 'Interna' },
  { value: 'TED', label: 'TED' },
  { value: 'APLICACAO', label: 'Aplicação' },
  { value: 'RESGATE', label: 'Resgate' },
];

// ─── Helpers ──────────────────────────────────────────────────────

function parseBRL(val: string): number {
  const cleaned = val.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function formatBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Component ────────────────────────────────────────────────────

const TransferModal = ({ isOpen, onClose, onSuccess }: TransferModalProps) => {
  // Form state
  const [type, setType] = useState<TransferType>('INTERNA');
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amountDisplay, setAmountDisplay] = useState('');
  const [feeAmountDisplay, setFeeAmountDisplay] = useState('');
  const [transferDate, setTransferDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  // UI state
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const firstFieldRef = useRef<HTMLSelectElement>(null);

  const { accounts, isLoading: accountsLoading } = useBankAccounts();
  const { createTransfer } = useTransfers();

  // Reset form on close
  useEffect(() => {
    if (!isOpen) {
      setType('INTERNA');
      setFromAccountId('');
      setToAccountId('');
      setAmountDisplay('');
      setFeeAmountDisplay('');
      setTransferDate(todayISO());
      setDescription('');
      setNotes('');
      setErrors({});
      setSubmitError(null);
    }
  }, [isOpen]);

  // Focus first field on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstFieldRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleAmountBlur = useCallback(() => {
    const num = parseBRL(amountDisplay);
    if (num > 0) {
      setAmountDisplay(formatBRL(num));
      setErrors((p) => ({ ...p, amount: undefined }));
    } else if (amountDisplay) {
      setErrors((p) => ({ ...p, amount: 'Valor deve ser maior que zero' }));
    }
  }, [amountDisplay]);

  const handleFeeAmountBlur = useCallback(() => {
    const num = parseBRL(feeAmountDisplay);
    if (feeAmountDisplay && num < 0) {
      setErrors((p) => ({ ...p, feeAmount: 'Tarifa deve ser maior ou igual a zero' }));
    } else if (feeAmountDisplay && num >= 0) {
      setFeeAmountDisplay(formatBRL(num));
      setErrors((p) => ({ ...p, feeAmount: undefined }));
    }
  }, [feeAmountDisplay]);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!fromAccountId) newErrors.fromAccountId = 'Conta de origem é obrigatória';
    if (!toAccountId) newErrors.toAccountId = 'Conta de destino é obrigatória';

    if (fromAccountId && toAccountId && fromAccountId === toAccountId) {
      newErrors.accounts = 'Conta de origem e destino devem ser diferentes';
    }

    const amount = parseBRL(amountDisplay);
    if (!amount || amount <= 0) newErrors.amount = 'Valor é obrigatório e deve ser maior que zero';

    if (!transferDate) newErrors.transferDate = 'Data é obrigatória';

    if (!description.trim()) newErrors.description = 'Descrição é obrigatória';
    else if (description.trim().length > 200)
      newErrors.description = 'Descrição deve ter no máximo 200 caracteres';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setIsSubmitting(true);
      setSubmitError(null);

      try {
        const feeValue = parseBRL(feeAmountDisplay);
        await createTransfer({
          fromAccountId,
          toAccountId,
          type,
          amount: parseBRL(amountDisplay),
          feeAmount: feeValue > 0 ? feeValue : undefined,
          description: description.trim(),
          transferDate,
          notes: notes.trim() || undefined,
        });
        onSuccess();
        onClose();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao registrar';
        setSubmitError(`Não foi possível registrar a transferência. ${msg}`);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      fromAccountId,
      toAccountId,
      type,
      amountDisplay,
      feeAmountDisplay,
      transferDate,
      description,
      notes,
      createTransfer,
      onSuccess,
      onClose,
    ],
  );

  if (!isOpen) return null;

  return (
    <div
      className="tm-modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tm-modal-title"
    >
      <div className="tm-modal__panel">
        <header className="tm-modal__header">
          <div className="tm-modal__header-icon" aria-hidden="true">
            <ArrowLeftRight size={20} />
          </div>
          <h2 id="tm-modal-title" className="tm-modal__title">
            Nova transferência
          </h2>
          <button type="button" className="tm-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="tm-modal__body">
            {submitError && (
              <div className="tm-modal__submit-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {submitError}
              </div>
            )}

            {errors.accounts && (
              <div className="tm-modal__submit-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {errors.accounts}
              </div>
            )}

            {/* Tipo */}
            <div className="tm-modal__field">
              <label htmlFor="tm-type" className="tm-modal__label">
                Tipo <span aria-label="obrigatório">*</span>
              </label>
              <select
                id="tm-type"
                ref={firstFieldRef}
                className="tm-modal__input"
                value={type}
                onChange={(e) => setType(e.target.value as TransferType)}
                aria-required="true"
              >
                {TRANSFER_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Conta Origem + Conta Destino */}
            <div className="tm-modal__row">
              <div className="tm-modal__field">
                <label htmlFor="tm-from" className="tm-modal__label">
                  Conta de origem <span aria-label="obrigatório">*</span>
                </label>
                <select
                  id="tm-from"
                  className={`tm-modal__input${errors.fromAccountId ? ' tm-modal__input--error' : ''}`}
                  value={fromAccountId}
                  onChange={(e) => {
                    setFromAccountId(e.target.value);
                    setErrors((p) => ({ ...p, fromAccountId: undefined, accounts: undefined }));
                  }}
                  onBlur={() => {
                    if (!fromAccountId)
                      setErrors((p) => ({
                        ...p,
                        fromAccountId: 'Conta de origem é obrigatória',
                      }));
                  }}
                  aria-required="true"
                  aria-describedby={errors.fromAccountId ? 'tm-from-err' : undefined}
                  disabled={accountsLoading}
                >
                  <option value="">Selecione a conta</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {errors.fromAccountId && (
                  <span id="tm-from-err" className="tm-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.fromAccountId}
                  </span>
                )}
              </div>

              <div className="tm-modal__field">
                <label htmlFor="tm-to" className="tm-modal__label">
                  Conta de destino <span aria-label="obrigatório">*</span>
                </label>
                <select
                  id="tm-to"
                  className={`tm-modal__input${errors.toAccountId ? ' tm-modal__input--error' : ''}`}
                  value={toAccountId}
                  onChange={(e) => {
                    setToAccountId(e.target.value);
                    setErrors((p) => ({ ...p, toAccountId: undefined, accounts: undefined }));
                  }}
                  onBlur={() => {
                    if (!toAccountId)
                      setErrors((p) => ({
                        ...p,
                        toAccountId: 'Conta de destino é obrigatória',
                      }));
                  }}
                  aria-required="true"
                  aria-describedby={errors.toAccountId ? 'tm-to-err' : undefined}
                  disabled={accountsLoading}
                >
                  <option value="">Selecione a conta</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {errors.toAccountId && (
                  <span id="tm-to-err" className="tm-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.toAccountId}
                  </span>
                )}
              </div>
            </div>

            {/* Valor + Tarifa */}
            <div className="tm-modal__row">
              <div className="tm-modal__field">
                <label htmlFor="tm-amount" className="tm-modal__label">
                  Valor <span aria-label="obrigatório">*</span>
                </label>
                <input
                  id="tm-amount"
                  type="text"
                  className={`tm-modal__input tm-modal__input--mono${errors.amount ? ' tm-modal__input--error' : ''}`}
                  value={amountDisplay}
                  onChange={(e) => setAmountDisplay(e.target.value)}
                  onBlur={handleAmountBlur}
                  aria-required="true"
                  aria-describedby={errors.amount ? 'tm-amount-err' : undefined}
                  placeholder="R$ 0,00"
                />
                {errors.amount && (
                  <span id="tm-amount-err" className="tm-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.amount}
                  </span>
                )}
              </div>

              <div className="tm-modal__field">
                <label htmlFor="tm-fee" className="tm-modal__label">
                  Tarifa
                </label>
                <input
                  id="tm-fee"
                  type="text"
                  className={`tm-modal__input tm-modal__input--mono${errors.feeAmount ? ' tm-modal__input--error' : ''}`}
                  value={feeAmountDisplay}
                  onChange={(e) => setFeeAmountDisplay(e.target.value)}
                  onBlur={handleFeeAmountBlur}
                  aria-describedby={errors.feeAmount ? 'tm-fee-err' : undefined}
                  placeholder="R$ 0,00"
                />
                {errors.feeAmount && (
                  <span id="tm-fee-err" className="tm-modal__error" role="alert">
                    <AlertCircle size={12} aria-hidden="true" /> {errors.feeAmount}
                  </span>
                )}
              </div>
            </div>

            {/* Data */}
            <div className="tm-modal__field">
              <label htmlFor="tm-date" className="tm-modal__label">
                Data <span aria-label="obrigatório">*</span>
              </label>
              <input
                id="tm-date"
                type="date"
                className={`tm-modal__input${errors.transferDate ? ' tm-modal__input--error' : ''}`}
                value={transferDate}
                max={todayISO()}
                onChange={(e) => {
                  setTransferDate(e.target.value);
                  setErrors((p) => ({ ...p, transferDate: undefined }));
                }}
                aria-required="true"
                aria-describedby={errors.transferDate ? 'tm-date-err' : undefined}
              />
              {errors.transferDate && (
                <span id="tm-date-err" className="tm-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {errors.transferDate}
                </span>
              )}
            </div>

            {/* Descrição */}
            <div className="tm-modal__field">
              <label htmlFor="tm-desc" className="tm-modal__label">
                Descrição <span aria-label="obrigatório">*</span>
              </label>
              <input
                id="tm-desc"
                type="text"
                className={`tm-modal__input${errors.description ? ' tm-modal__input--error' : ''}`}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (e.target.value.trim()) setErrors((p) => ({ ...p, description: undefined }));
                }}
                onBlur={() => {
                  if (!description.trim())
                    setErrors((p) => ({ ...p, description: 'Descrição é obrigatória' }));
                  else if (description.trim().length > 200)
                    setErrors((p) => ({
                      ...p,
                      description: 'Descrição deve ter no máximo 200 caracteres',
                    }));
                  else setErrors((p) => ({ ...p, description: undefined }));
                }}
                aria-required="true"
                aria-describedby={errors.description ? 'tm-desc-err' : undefined}
                maxLength={200}
                placeholder="Ex: Transferência para reserva de emergência"
              />
              {errors.description && (
                <span id="tm-desc-err" className="tm-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {errors.description}
                </span>
              )}
            </div>

            {/* Observações */}
            <div className="tm-modal__field">
              <label htmlFor="tm-notes" className="tm-modal__label">
                Observações
              </label>
              <textarea
                id="tm-notes"
                className="tm-modal__textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Informações adicionais..."
              />
            </div>
          </div>

          <footer className="tm-modal__footer">
            <button type="button" className="tm-modal__btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="tm-modal__btn-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Registrando...' : 'Registrar transferência'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default TransferModal;
