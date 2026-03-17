import { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle, Banknote } from 'lucide-react';
import { api } from '@/services/api';
import type { Payable } from '@/hooks/usePayables';
import './PayableModal.css';

// ─── Types ──────────────────────────────────────────────────────────

interface BankAccountOption {
  id: string;
  name: string;
}

interface BatchItem {
  payableId: string;
  amount: string;
  interestAmount: string;
  fineAmount: string;
  discountAmount: string;
}

interface BatchPaymentModalProps {
  payableIds: string[];
  payables: Payable[];
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

const BatchPaymentModal = ({ payables, onClose, onSuccess }: BatchPaymentModalProps) => {
  const [paidAt, setPaidAt] = useState(todayISO());
  const [bankAccountId, setBankAccountId] = useState('');
  const [bankError, setBankError] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Per-item adjustments
  const [items, setItems] = useState<BatchItem[]>(() =>
    payables.map((p) => ({
      payableId: p.id,
      amount: formatBRL(p.totalAmount),
      interestAmount: '',
      fineAmount: '',
      discountAmount: '',
    })),
  );

  useEffect(() => {
    void api
      .get<BankAccountOption[]>('/org/bank-accounts')
      .then((r) => setBankAccounts(r ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const updateItem = useCallback((id: string, field: keyof BatchItem, val: string) => {
    setItems((prev) => prev.map((it) => (it.payableId === id ? { ...it, [field]: val } : it)));
  }, []);

  const blurAmount = useCallback(
    (id: string, field: keyof BatchItem, val: string) => {
      const num = parseBRL(val);
      if (num >= 0) updateItem(id, field, num > 0 ? formatBRL(num) : '');
    },
    [updateItem],
  );

  const effectiveTotal = items.reduce((sum, it) => {
    return (
      sum +
      parseBRL(it.amount) +
      parseBRL(it.interestAmount) +
      parseBRL(it.fineAmount) -
      parseBRL(it.discountAmount)
    );
  }, 0);

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
        const payload = {
          bankAccountId,
          paidAt,
          items: items.map((it) => ({
            payableId: it.payableId,
            amount: parseBRL(it.amount),
            interestAmount: parseBRL(it.interestAmount) || undefined,
            fineAmount: parseBRL(it.fineAmount) || undefined,
            discountAmount: parseBRL(it.discountAmount) || undefined,
          })),
        };
        await api.post('/org/payables/batch-settle', payload);
        onSuccess();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao processar';
        setSubmitError(`Não foi possível registrar as baixas. ${msg}`);
      } finally {
        setIsSubmitting(false);
      }
    },
    [bankAccountId, paidAt, items, onSuccess],
  );

  return (
    <div
      className="pm-modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Baixa em lote de contas a pagar"
    >
      <div className="pm-modal__panel" style={{ maxWidth: 680 }}>
        <header className="pm-modal__header">
          <div className="pm-modal__header-icon" aria-hidden="true">
            <Banknote size={20} />
          </div>
          <h2 className="pm-modal__title">
            Baixa em lote — {payables.length} {payables.length === 1 ? 'título' : 'títulos'}
          </h2>
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

            {/* Common fields */}
            <div className="pm-modal__row">
              <div className="pm-modal__field">
                <label htmlFor="batch-date" className="pm-modal__label">
                  Data de pagamento <span aria-label="obrigatório">*</span>
                </label>
                <input
                  id="batch-date"
                  type="date"
                  className="pm-modal__input"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  aria-required="true"
                />
              </div>

              <div className="pm-modal__field">
                <label htmlFor="batch-bank" className="pm-modal__label">
                  Conta bancária <span aria-label="obrigatório">*</span>
                </label>
                <select
                  id="batch-bank"
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
            </div>

            {/* Per-item table */}
            <div className="pm-modal__installments-wrap">
              <table className="pm-modal__installments-table">
                <caption className="sr-only">Títulos para baixa em lote</caption>
                <thead>
                  <tr>
                    <th scope="col">Fornecedor</th>
                    <th scope="col">Vencimento</th>
                    <th scope="col">Valor pago</th>
                    <th scope="col">Juros</th>
                    <th scope="col">Multa</th>
                    <th scope="col">Desconto</th>
                  </tr>
                </thead>
                <tbody>
                  {payables.map((p, idx) => {
                    const it = items[idx];
                    if (!it) return null;
                    return (
                      <tr key={p.id}>
                        <td>
                          <strong style={{ display: 'block', fontSize: '0.875rem' }}>
                            {p.supplierName}
                          </strong>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--color-neutral-500, #9e9e9e)',
                            }}
                          >
                            {formatBRL(p.totalAmount)}
                          </span>
                        </td>
                        <td
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '0.8125rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatDate(p.dueDate)}
                        </td>
                        <td>
                          <input
                            type="text"
                            className="pm-modal__input pm-modal__input--mono"
                            value={it.amount}
                            onChange={(e) => updateItem(p.id, 'amount', e.target.value)}
                            onBlur={(e) => blurAmount(p.id, 'amount', e.target.value)}
                            aria-label={`Valor pago para ${p.supplierName}`}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="pm-modal__input pm-modal__input--mono"
                            value={it.interestAmount}
                            onChange={(e) => updateItem(p.id, 'interestAmount', e.target.value)}
                            onBlur={(e) => blurAmount(p.id, 'interestAmount', e.target.value)}
                            placeholder="R$ 0,00"
                            aria-label={`Juros para ${p.supplierName}`}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="pm-modal__input pm-modal__input--mono"
                            value={it.fineAmount}
                            onChange={(e) => updateItem(p.id, 'fineAmount', e.target.value)}
                            onBlur={(e) => blurAmount(p.id, 'fineAmount', e.target.value)}
                            placeholder="R$ 0,00"
                            aria-label={`Multa para ${p.supplierName}`}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="pm-modal__input pm-modal__input--mono"
                            value={it.discountAmount}
                            onChange={(e) => updateItem(p.id, 'discountAmount', e.target.value)}
                            onBlur={(e) => blurAmount(p.id, 'discountAmount', e.target.value)}
                            placeholder="R$ 0,00"
                            aria-label={`Desconto para ${p.supplierName}`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Total */}
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
                Total efetivo
              </span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '1.125rem',
                  color: 'var(--color-primary-800, #1a3a1c)',
                }}
              >
                {formatBRL(effectiveTotal)}
              </span>
            </div>
          </div>

          <footer className="pm-modal__footer">
            <button type="button" className="pm-modal__btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="pm-modal__btn-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Processando...' : `Confirmar ${payables.length} baixas`}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default BatchPaymentModal;
