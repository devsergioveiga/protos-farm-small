import { useState, useCallback, useEffect } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import {
  applyExtraordinaryAmortization,
  type ExtraordinaryAmortizationData,
} from '@/hooks/useRuralCredit';
import './ExtraordinaryAmortizationModal.css';

// ─── Helpers ─────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function parseCurrency(value: string): number {
  const clean = value.replace(/[R$\s.]/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

function formatCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

const TODAY = new Date().toISOString().split('T')[0];

// ─── Props ────────────────────────────────────────────────────────

interface ExtraordinaryAmortizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contractId: string;
  outstandingBalance: number;
}

// ─── Component ───────────────────────────────────────────────────

export default function ExtraordinaryAmortizationModal({
  isOpen,
  onClose,
  onSuccess,
  contractId,
  outstandingBalance,
}: ExtraordinaryAmortizationModalProps) {
  const [amount, setAmount] = useState('');
  const [recalculationMode, setRecalculationMode] = useState<'REDUCE_TERM' | 'REDUCE_INSTALLMENT'>(
    'REDUCE_TERM',
  );
  const [paidAt, setPaidAt] = useState(TODAY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountTouched, setAmountTouched] = useState(false);

  const parsedAmount = parseCurrency(amount);
  const remainingBalance = outstandingBalance - parsedAmount;
  const amountError =
    amountTouched && parsedAmount <= 0
      ? 'Valor deve ser maior que zero'
      : amountTouched && parsedAmount > outstandingBalance
        ? `Valor nao pode ser maior que o saldo devedor (${formatBRL(outstandingBalance)})`
        : null;

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(async () => {
    setAmountTouched(true);
    if (parsedAmount <= 0 || parsedAmount > outstandingBalance) return;
    if (!paidAt) return;

    setSubmitting(true);
    setError(null);
    try {
      const data: ExtraordinaryAmortizationData = {
        amount: parsedAmount,
        recalculationMode,
        paidAt,
      };
      await applyExtraordinaryAmortization(contractId, data);
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel aplicar a amortizacao. Verifique sua conexao.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [parsedAmount, outstandingBalance, paidAt, recalculationMode, contractId, onSuccess]);

  if (!isOpen) return null;

  return (
    <div
      className="eam__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="eam-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="eam__panel">
        {/* Header */}
        <header className="eam__header">
          <h2 id="eam-title" className="eam__title">
            Amortizacao extraordinaria
          </h2>
          <button type="button" className="eam__close-btn" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {/* Body */}
        <div className="eam__body">
          {error && (
            <div className="eam__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Balance info */}
          <div className="eam__info-box" role="note">
            <p>
              Saldo devedor atual: <strong>{formatBRL(outstandingBalance)}</strong>
            </p>
            {parsedAmount > 0 && parsedAmount <= outstandingBalance && (
              <p>
                Apos amortizacao: <strong>{formatBRL(Math.max(0, remainingBalance))}</strong>
              </p>
            )}
          </div>

          {/* Amount field */}
          <div className="eam__field">
            <label htmlFor="eam-amount" className="eam__label">
              Valor da amortizacao <span className="eam__required">*</span>
            </label>
            <input
              id="eam-amount"
              type="text"
              inputMode="numeric"
              className={`eam__input eam__input--mono${amountError ? ' eam__input--error' : ''}`}
              value={amount}
              onChange={(e) => setAmount(formatCurrencyInput(e.target.value))}
              onBlur={() => setAmountTouched(true)}
              aria-required="true"
              placeholder="0,00"
              aria-describedby={amountError ? 'eam-amount-err' : undefined}
            />
            {amountError && (
              <span id="eam-amount-err" className="eam__field-error" role="alert">
                {amountError}
              </span>
            )}
          </div>

          {/* Recalculation mode */}
          <fieldset className="eam__fieldset">
            <legend className="eam__legend">
              Modo de recalculo <span className="eam__required">*</span>
            </legend>

            <label className="eam__radio-label">
              <input
                type="radio"
                name="recalculation-mode"
                value="REDUCE_TERM"
                checked={recalculationMode === 'REDUCE_TERM'}
                onChange={() => setRecalculationMode('REDUCE_TERM')}
                className="eam__radio"
              />
              <span className="eam__radio-text">
                <strong>Reduzir prazo</strong>
                <span className="eam__radio-desc">
                  Mantem o valor das parcelas e reduz o numero de meses
                </span>
              </span>
            </label>

            <label className="eam__radio-label">
              <input
                type="radio"
                name="recalculation-mode"
                value="REDUCE_INSTALLMENT"
                checked={recalculationMode === 'REDUCE_INSTALLMENT'}
                onChange={() => setRecalculationMode('REDUCE_INSTALLMENT')}
                className="eam__radio"
              />
              <span className="eam__radio-text">
                <strong>Reduzir valor das parcelas</strong>
                <span className="eam__radio-desc">
                  Mantem o prazo e recalcula o valor das parcelas restantes
                </span>
              </span>
            </label>
          </fieldset>

          {/* Payment date */}
          <div className="eam__field">
            <label htmlFor="eam-paid-at" className="eam__label">
              Data do pagamento <span className="eam__required">*</span>
            </label>
            <input
              id="eam-paid-at"
              type="date"
              className="eam__input"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              aria-required="true"
            />
          </div>
        </div>

        {/* Footer */}
        <footer className="eam__footer">
          <button type="button" className="eam__btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="eam__btn-primary"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting && <Loader2 size={16} className="eam__spinner" aria-hidden="true" />}
            Aplicar amortizacao
          </button>
        </footer>
      </div>
    </div>
  );
}
