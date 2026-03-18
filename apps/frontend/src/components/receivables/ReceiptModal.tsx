import { useState, useEffect, useRef, useCallback } from 'react';
import { X, AlertCircle, ArrowDownCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { Receivable } from '@/hooks/useReceivables';
import './ReceivableModal.css';

// ─── Types ──────────────────────────────────────────────────────────

interface BankAccountOption {
  id: string;
  name: string;
}

interface ReceiptModalProps {
  receivable: Receivable;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormErrors {
  receivedAt?: string;
  amount?: string;
  bankAccountId?: string;
}

function parseBRL(value: string): number {
  const clean = value.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

// ─── Component ───────────────────────────────────────────────────────

const ReceiptModal = ({ receivable, onClose, onSuccess }: ReceiptModalProps) => {
  const today = new Date().toISOString().slice(0, 10);

  const [receivedAt, setReceivedAt] = useState(today);
  const [amountDisplay, setAmountDisplay] = useState(formatBRL(receivable.totalAmount));
  const [bankAccountId, setBankAccountId] = useState(receivable.bankAccount?.id ?? '');
  const [interestAmount, setInterestAmount] = useState('');
  const [fineAmount, setFineAmount] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);

  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Effective amount = received + interest + fine - discount
  const effectiveAmount = (() => {
    const base = parseBRL(amountDisplay);
    const interest = parseBRL(interestAmount);
    const fine = parseBRL(fineAmount);
    const discount = parseBRL(discountAmount);
    return base + interest + fine - discount;
  })();

  // Expected net (after FUNRURAL)
  const expectedNet =
    receivable.funruralAmount != null ? receivable.totalAmount - receivable.funruralAmount : null;

  // Load bank accounts
  useEffect(() => {
    void api
      .get<BankAccountOption[]>('/org/bank-accounts')
      .then((r) => setBankAccounts(r ?? []))
      .catch(() => {});
  }, []);

  // Focus
  useEffect(() => {
    setTimeout(() => firstFieldRef.current?.focus(), 50);
  }, []);

  // Keyboard close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!receivedAt) newErrors.receivedAt = 'Data de recebimento é obrigatória';
    const amount = parseBRL(amountDisplay);
    if (amount <= 0) newErrors.amount = 'Valor recebido é obrigatório';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setIsSubmitting(true);
      setSubmitError(null);

      const payload: Record<string, unknown> = {
        receivedAt,
        amount: parseBRL(amountDisplay),
      };
      if (bankAccountId) payload.bankAccountId = bankAccountId;
      const interest = parseBRL(interestAmount);
      const fine = parseBRL(fineAmount);
      const discount = parseBRL(discountAmount);
      if (interest > 0) payload.interestAmount = interest;
      if (fine > 0) payload.fineAmount = fine;
      if (discount > 0) payload.discountAmount = discount;

      try {
        await api.post(`/org/receivables/${receivable.id}/settle`, payload);
        onSuccess();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao registrar';
        setSubmitError(`Não foi possível registrar o recebimento. ${message}`);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      receivedAt,
      amountDisplay,
      bankAccountId,
      interestAmount,
      fineAmount,
      discountAmount,
      receivable.id,
      onSuccess,
    ],
  );

  return (
    <div
      className="cr-modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Registrar recebimento"
    >
      <div className="cr-modal__panel">
        <header className="cr-modal__header">
          <div className="cr-modal__header-icon" aria-hidden="true">
            <ArrowDownCircle size={20} />
          </div>
          <h2 className="cr-modal__title">Registrar recebimento</h2>
          <button type="button" className="cr-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="cr-modal__body">
            {submitError && (
              <div className="cr-modal__submit-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {submitError}
              </div>
            )}

            {/* Read-only info */}
            <div className="cr-receipt__info">
              <div className="cr-receipt__info-row">
                <span className="cr-receipt__info-label">Cliente</span>
                <span className="cr-receipt__info-value">{receivable.clientName}</span>
              </div>
              <div className="cr-receipt__info-row">
                <span className="cr-receipt__info-label">Valor original</span>
                <span className="cr-receipt__info-value cr-receipt__info-mono">
                  {formatBRL(receivable.totalAmount)}
                </span>
              </div>
              <div className="cr-receipt__info-row">
                <span className="cr-receipt__info-label">Vencimento</span>
                <span className="cr-receipt__info-value cr-receipt__info-mono">
                  {formatDate(receivable.dueDate)}
                </span>
              </div>
              {receivable.funruralAmount != null && (
                <div className="cr-receipt__info-row">
                  <span className="cr-receipt__info-label">FUNRURAL retido</span>
                  <span className="cr-receipt__info-value cr-receipt__info-mono cr-receipt__info-funrural">
                    {formatBRL(receivable.funruralAmount)}
                  </span>
                </div>
              )}
              {expectedNet != null && (
                <div className="cr-receipt__info-hint">
                  <AlertCircle size={14} aria-hidden="true" />
                  Valor esperado líquido (após FUNRURAL): <strong>{formatBRL(expectedNet)}</strong>
                </div>
              )}
            </div>

            {/* Data recebimento */}
            <div className="cr-modal__field">
              <label htmlFor="cr-receipt-date" className="cr-modal__label">
                Data de recebimento <span aria-label="obrigatório">*</span>
              </label>
              <input
                id="cr-receipt-date"
                ref={firstFieldRef}
                type="date"
                className={`cr-modal__input ${errors.receivedAt ? 'cr-modal__input--error' : ''}`}
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                aria-required="true"
              />
              {errors.receivedAt && (
                <span className="cr-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {errors.receivedAt}
                </span>
              )}
            </div>

            {/* Valor recebido */}
            <div className="cr-modal__field">
              <label htmlFor="cr-receipt-amount" className="cr-modal__label">
                Valor recebido <span aria-label="obrigatório">*</span>
              </label>
              <input
                id="cr-receipt-amount"
                type="text"
                className={`cr-modal__input cr-modal__input--mono ${errors.amount ? 'cr-modal__input--error' : ''}`}
                value={amountDisplay}
                onChange={(e) => setAmountDisplay(e.target.value)}
                onBlur={(e) => {
                  const num = parseBRL(e.target.value);
                  if (num > 0) {
                    setAmountDisplay(formatBRL(num));
                    setErrors((p) => ({ ...p, amount: undefined }));
                  } else {
                    setErrors((p) => ({ ...p, amount: 'Valor recebido é obrigatório' }));
                  }
                }}
                aria-required="true"
                placeholder="R$ 0,00"
              />
              {errors.amount && (
                <span className="cr-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {errors.amount}
                </span>
              )}
            </div>

            {/* Conta bancária */}
            <div className="cr-modal__field">
              <label htmlFor="cr-receipt-bank" className="cr-modal__label">
                Conta bancária de destino
              </label>
              <select
                id="cr-receipt-bank"
                className="cr-modal__input"
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
              >
                <option value="">Selecione (opcional)</option>
                {bankAccounts.map((ba) => (
                  <option key={ba.id} value={ba.id}>
                    {ba.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Juros / Multa / Glosa */}
            <div className="cr-modal__row">
              <div className="cr-modal__field cr-modal__field--grow">
                <label htmlFor="cr-receipt-interest" className="cr-modal__label">
                  Juros
                </label>
                <input
                  id="cr-receipt-interest"
                  type="text"
                  className="cr-modal__input cr-modal__input--mono"
                  value={interestAmount}
                  onChange={(e) => setInterestAmount(e.target.value)}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="cr-modal__field cr-modal__field--grow">
                <label htmlFor="cr-receipt-fine" className="cr-modal__label">
                  Multa
                </label>
                <input
                  id="cr-receipt-fine"
                  type="text"
                  className="cr-modal__input cr-modal__input--mono"
                  value={fineAmount}
                  onChange={(e) => setFineAmount(e.target.value)}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="cr-modal__field cr-modal__field--grow">
                <label htmlFor="cr-receipt-discount" className="cr-modal__label">
                  Desconto/Glosa
                </label>
                <input
                  id="cr-receipt-discount"
                  type="text"
                  className="cr-modal__input cr-modal__input--mono"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="R$ 0,00"
                />
              </div>
            </div>

            {/* Effective amount */}
            <div className="cr-receipt__effective">
              <span className="cr-receipt__effective-label">Valor efetivo:</span>
              <span className="cr-receipt__effective-value cr-modal__input--mono">
                {formatBRL(effectiveAmount)}
              </span>
            </div>
          </div>

          <footer className="cr-modal__footer">
            <button type="button" className="cr-modal__btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="cr-modal__btn-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Registrando...' : 'Registrar recebimento'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default ReceiptModal;
