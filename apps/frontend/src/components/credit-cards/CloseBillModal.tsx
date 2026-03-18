import { useEffect } from 'react';
import { X, AlertTriangle, AlertCircle } from 'lucide-react';
import type { BillOutput } from '@/hooks/useCreditCards';
import './CloseBillModal.css';

// ─── Types ──────────────────────────────────────────────────────────

interface CloseBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (billId: string) => Promise<void>;
  bill: BillOutput | null;
  isSubmitting?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────

function formatBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

// ─── Component ────────────────────────────────────────────────────

const CloseBillModal = ({
  isOpen,
  onClose,
  onSuccess,
  bill,
  isSubmitting = false,
}: CloseBillModalProps) => {
  const titleId = 'close-bill-modal-title';
  const hasExpenses = bill ? bill.expenses.length > 0 : false;

  // Escape closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen || !bill) return null;

  const handleConfirm = async () => {
    if (!hasExpenses || isSubmitting) return;
    await onSuccess(bill.id);
  };

  return (
    <div className="cbm-modal__backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="cbm-modal__panel">
        <header className="cbm-modal__header">
          <h2 id={titleId} className="cbm-modal__title">
            Fechar fatura
          </h2>
          <button type="button" className="cbm-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="cbm-modal__body">
          {/* Period summary */}
          <div className="cbm-modal__summary">
            <div className="cbm-modal__summary-row">
              <span className="cbm-modal__summary-label">Período</span>
              <span className="cbm-modal__summary-value">
                {formatDate(bill.periodStart)} a {formatDate(bill.periodEnd)}
              </span>
            </div>
            <div className="cbm-modal__summary-row">
              <span className="cbm-modal__summary-label">Vencimento</span>
              <span className="cbm-modal__summary-value">{formatDate(bill.dueDate)}</span>
            </div>
            <div className="cbm-modal__summary-row">
              <span className="cbm-modal__summary-label">Gastos</span>
              <span className="cbm-modal__summary-value">
                {bill.expenses.length} {bill.expenses.length === 1 ? 'gasto' : 'gastos'}
              </span>
            </div>
          </div>

          {/* Total amount */}
          <div className="cbm-modal__total-block">
            <span className="cbm-modal__total-label">Total da fatura</span>
            <span
              className="cbm-modal__total-value"
              aria-label={`Total: ${formatBRL(bill.totalAmount)} reais`}
            >
              {formatBRL(bill.totalAmount)}
            </span>
          </div>

          {/* Warning */}
          <div className="cbm-modal__warning" role="note">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>Após fechar, não é possível adicionar gastos a esta fatura.</span>
          </div>

          {/* Disabled message when no expenses */}
          {!hasExpenses && (
            <div className="cbm-modal__empty-warning" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>Adicione ao menos um gasto antes de fechar a fatura.</span>
            </div>
          )}
        </div>

        <footer className="cbm-modal__footer">
          <button type="button" className="cbm-modal__btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="cbm-modal__btn-confirm"
            onClick={() => void handleConfirm()}
            disabled={!hasExpenses || isSubmitting}
            aria-disabled={!hasExpenses || isSubmitting}
          >
            {isSubmitting
              ? 'Fechando...'
              : `Fechar fatura e gerar CP de ${formatBRL(bill.totalAmount)}`}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default CloseBillModal;
