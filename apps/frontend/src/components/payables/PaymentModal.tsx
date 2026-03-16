import { useState, useEffect, useCallback, useRef } from 'react';
import { X, AlertCircle, CreditCard } from 'lucide-react';
import { api } from '@/services/api';
import type { Payable } from '@/hooks/usePayables';
import './PayableModal.css';

// ─── Types ──────────────────────────────────────────────────────────

interface BankAccountOption {
  id: string;
  name: string;
}

interface PaymentModalProps {
  payable: Payable;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────

function parseBRL(val: string): number {
  const cleaned = val.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function formatBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Component ────────────────────────────────────────────────────

const PaymentModal = ({ payable, onClose, onSuccess }: PaymentModalProps) => {
  const [paidAt, setPaidAt] = useState(todayISO());
  const [paidAmountDisplay, setPaidAmountDisplay] = useState(formatBRL(payable.totalAmount));
  const [bankAccountId, setBankAccountId] = useState('');
  const [interestDisplay, setInterestDisplay] = useState('');
  const [fineDisplay, setFineDisplay] = useState('');
  const [discountDisplay, setDiscountDisplay] = useState('');
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);

  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void api
      .get<BankAccountOption[]>('/org/bank-accounts')
      .then((r) => setBankAccounts(r ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setTimeout(() => firstFieldRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Effective amount = paidAmount + interest + fine - discount
  const effectiveAmount =
    parseBRL(paidAmountDisplay) +
    parseBRL(interestDisplay) +
    parseBRL(fineDisplay) -
    parseBRL(discountDisplay);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!bankAccountId) {
        setBankError('Conta bancária é obrigatória');
        return;
      }
      setBankError(null);

      setIsSubmitting(true);
      setSubmitError(null);

      try {
        await api.post(`/org/payables/${payable.id}/settle`, {
          paidAt,
          amount: parseBRL(paidAmountDisplay),
          bankAccountId,
          interestAmount: parseBRL(interestDisplay) || undefined,
          fineAmount: parseBRL(fineDisplay) || undefined,
          discountAmount: parseBRL(discountDisplay) || undefined,
        });
        onSuccess();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao registrar';
        setSubmitError(`Não foi possível dar baixa. ${msg}`);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      payable.id,
      paidAt,
      paidAmountDisplay,
      bankAccountId,
      interestDisplay,
      fineDisplay,
      discountDisplay,
      onSuccess,
    ],
  );

  return (
    <div
      className="pm-modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Dar baixa em conta a pagar"
    >
      <div className="pm-modal__panel" style={{ maxWidth: 480 }}>
        <header className="pm-modal__header">
          <div className="pm-modal__header-icon" aria-hidden="true">
            <CreditCard size={20} />
          </div>
          <h2 className="pm-modal__title">Dar baixa</h2>
          <button type="button" className="pm-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="pm-modal__body">
            {submitError && (
              <div className="pm-modal__submit-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {submitError}
              </div>
            )}

            {/* Read-only payable summary */}
            <div
              style={{
                padding: '12px 16px',
                background: 'var(--color-neutral-50, #fafaf8)',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <span
                style={{
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontWeight: 700,
                  fontSize: '1rem',
                  color: 'var(--color-neutral-800, #2a2520)',
                }}
              >
                {payable.supplierName}
              </span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.875rem',
                  color: 'var(--color-neutral-600, #757575)',
                }}
              >
                Valor original: {formatBRL(payable.totalAmount)} — Vencimento:{' '}
                {formatDate(payable.dueDate)}
              </span>
            </div>

            {/* Data de pagamento */}
            <div className="pm-modal__field">
              <label htmlFor="pmt-date" className="pm-modal__label">
                Data de pagamento <span aria-label="obrigatório">*</span>
              </label>
              <input
                id="pmt-date"
                ref={firstFieldRef}
                type="date"
                className="pm-modal__input"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                aria-required="true"
              />
            </div>

            {/* Valor pago */}
            <div className="pm-modal__field">
              <label htmlFor="pmt-amount" className="pm-modal__label">
                Valor pago <span aria-label="obrigatório">*</span>
              </label>
              <input
                id="pmt-amount"
                type="text"
                className="pm-modal__input pm-modal__input--mono"
                value={paidAmountDisplay}
                onChange={(e) => setPaidAmountDisplay(e.target.value)}
                onBlur={(e) => {
                  const num = parseBRL(e.target.value);
                  if (num >= 0) setPaidAmountDisplay(formatBRL(num));
                }}
                aria-required="true"
              />
            </div>

            {/* Conta bancária */}
            <div className="pm-modal__field">
              <label htmlFor="pmt-bank" className="pm-modal__label">
                Conta bancária <span aria-label="obrigatório">*</span>
              </label>
              <select
                id="pmt-bank"
                className={`pm-modal__input${bankError ? ' pm-modal__input--error' : ''}`}
                value={bankAccountId}
                onChange={(e) => {
                  setBankAccountId(e.target.value);
                  setBankError(null);
                }}
                onBlur={() => {
                  if (!bankAccountId) setBankError('Conta bancária é obrigatória');
                }}
                aria-required="true"
              >
                <option value="">Selecione a conta bancária</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {bankError && (
                <span className="pm-modal__error" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> {bankError}
                </span>
              )}
            </div>

            {/* Juros + Multa + Desconto */}
            <div className="pm-modal__row">
              <div className="pm-modal__field">
                <label htmlFor="pmt-interest" className="pm-modal__label">
                  Juros
                </label>
                <input
                  id="pmt-interest"
                  type="text"
                  className="pm-modal__input pm-modal__input--mono"
                  value={interestDisplay}
                  onChange={(e) => setInterestDisplay(e.target.value)}
                  onBlur={(e) => {
                    const num = parseBRL(e.target.value);
                    if (num > 0) setInterestDisplay(formatBRL(num));
                    else setInterestDisplay('');
                  }}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="pm-modal__field">
                <label htmlFor="pmt-fine" className="pm-modal__label">
                  Multa
                </label>
                <input
                  id="pmt-fine"
                  type="text"
                  className="pm-modal__input pm-modal__input--mono"
                  value={fineDisplay}
                  onChange={(e) => setFineDisplay(e.target.value)}
                  onBlur={(e) => {
                    const num = parseBRL(e.target.value);
                    if (num > 0) setFineDisplay(formatBRL(num));
                    else setFineDisplay('');
                  }}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="pm-modal__field">
                <label htmlFor="pmt-discount" className="pm-modal__label">
                  Desconto
                </label>
                <input
                  id="pmt-discount"
                  type="text"
                  className="pm-modal__input pm-modal__input--mono"
                  value={discountDisplay}
                  onChange={(e) => setDiscountDisplay(e.target.value)}
                  onBlur={(e) => {
                    const num = parseBRL(e.target.value);
                    if (num > 0) setDiscountDisplay(formatBRL(num));
                    else setDiscountDisplay('');
                  }}
                  placeholder="R$ 0,00"
                />
              </div>
            </div>

            {/* Effective amount */}
            <div
              style={{
                padding: '12px 16px',
                background: 'var(--color-primary-50, #e8f5e9)',
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: "'Source Sans 3', system-ui, sans-serif",
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: 'var(--color-primary-700, #1b5e20)',
                }}
              >
                Valor efetivo
              </span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '1.125rem',
                  color: 'var(--color-primary-800, #1a3a1c)',
                }}
              >
                {formatBRL(effectiveAmount)}
              </span>
            </div>
          </div>

          <footer className="pm-modal__footer">
            <button type="button" className="pm-modal__btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="pm-modal__btn-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Registrando...' : 'Confirmar baixa'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default PaymentModal;
