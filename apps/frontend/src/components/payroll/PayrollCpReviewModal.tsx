import { useEffect, useRef } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { useCpPreview } from '@/hooks/useCpPreview';
import PayrollRunStatusBadge from './PayrollRunStatusBadge';
import type { CpPreviewItem } from '@/types/payroll-integration';
import { CP_TYPE_LABELS, CP_SECTION_KEYS } from '@/types/payroll-integration';
import './PayrollCpReviewModal.css';

interface PayrollCpReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  runId: string | null;
  referenceMonth: string;
  onConfirmClose: () => void;
  isConfirming?: boolean;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR');
}

function getMonthLabel(referenceMonth: string): string {
  const [year, month] = referenceMonth.split('-');
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  const m = parseInt(month, 10) - 1;
  return `${monthNames[m] ?? month}/${year}`;
}

function SkeletonCell() {
  return (
    <td className="cp-review-modal__td" aria-hidden="true">
      <div className="cp-review-modal__skeleton-pulse" />
    </td>
  );
}

function SkeletonRow() {
  return (
    <tr>
      <SkeletonCell />
      <SkeletonCell />
      <SkeletonCell />
      <SkeletonCell />
      <SkeletonCell />
    </tr>
  );
}

interface SectionGroup {
  title: string;
  items: CpPreviewItem[];
  total: number;
}

function groupItemsBySection(items: CpPreviewItem[]): SectionGroup[] {
  return Object.entries(CP_SECTION_KEYS).map(([title, types]) => {
    const sectionItems = items.filter((it) => types.includes(it.type));
    const total = sectionItems.reduce((sum, it) => sum + it.amount, 0);
    return { title, items: sectionItems, total };
  }).filter((g) => g.items.length > 0);
}

export default function PayrollCpReviewModal({
  isOpen,
  onClose,
  runId,
  referenceMonth,
  onConfirmClose,
  isConfirming = false,
}: PayrollCpReviewModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const { data, isLoading, error } = useCpPreview(isOpen ? runId : null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => confirmBtnRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sections = data ? groupItemsBySection(data.items) : [];
  const monthLabel = getMonthLabel(referenceMonth);

  return (
    <div
      className="cp-review-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="cp-review-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cp-review-title"
      >
        {/* Header */}
        <div className="cp-review-modal__header">
          <div className="cp-review-modal__header-left">
            <h2 id="cp-review-title" className="cp-review-modal__title">
              Revisão de Contas a Pagar — {monthLabel}
            </h2>
            <PayrollRunStatusBadge status="CALCULATED" />
          </div>
          <button
            type="button"
            className="cp-review-modal__close-btn"
            onClick={onClose}
            aria-label="Fechar revisão de contas a pagar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="cp-review-modal__body">
          {/* Error state */}
          {error && (
            <div className="cp-review-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" className="cp-review-modal__error-icon" />
              <span>{error}</span>
            </div>
          )}

          {/* Main CP table (grouped by section) */}
          <div className="cp-review-modal__table-wrapper">
            <table className="cp-review-modal__table">
              <caption className="sr-only">Contas a pagar a serem geradas no fechamento</caption>
              <thead>
                <tr>
                  <th scope="col" className="cp-review-modal__th">TIPO</th>
                  <th scope="col" className="cp-review-modal__th">COLABORADOR</th>
                  <th scope="col" className="cp-review-modal__th cp-review-modal__th--mono">VALOR</th>
                  <th scope="col" className="cp-review-modal__th">VENCIMENTO</th>
                  <th scope="col" className="cp-review-modal__th">CENTRO DE CUSTO</th>
                </tr>
              </thead>
              <tbody>
                {isLoading &&
                  Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}

                {!isLoading && !error && sections.map((section) => (
                  <tr key={section.title} className="cp-review-modal__section-row">
                    <td colSpan={5} className="cp-review-modal__section-cell">
                      <details className="cp-review-modal__details" open>
                        <summary className="cp-review-modal__summary">
                          <span className="cp-review-modal__section-title">{section.title}</span>
                          <span className="cp-review-modal__section-total">
                            {formatCurrency(section.total)}
                          </span>
                        </summary>
                        <table className="cp-review-modal__inner-table">
                          <tbody>
                            {section.items.map((item, idx) => (
                              <tr key={idx} className="cp-review-modal__inner-row">
                                <td className="cp-review-modal__inner-td">
                                  {CP_TYPE_LABELS[item.type] ?? item.type}
                                </td>
                                <td className="cp-review-modal__inner-td">
                                  {item.employeeName ?? '—'}
                                </td>
                                <td className="cp-review-modal__inner-td cp-review-modal__inner-td--mono">
                                  {formatCurrency(item.amount)}
                                </td>
                                <td className="cp-review-modal__inner-td">
                                  {formatDate(item.dueDate)}
                                </td>
                                <td className="cp-review-modal__inner-td">
                                  {item.costCenterItems.length > 0
                                    ? item.costCenterItems
                                        .map((cc) => `${cc.costCenterName} (${cc.percentage}%)`)
                                        .join(', ')
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tax guides section */}
          {!isLoading && !error && data && data.taxGuideItems.length > 0 && (
            <div className="cp-review-modal__tax-section">
              <h3 className="cp-review-modal__tax-title">Guias e Tributos</h3>
              <table className="cp-review-modal__tax-table">
                <caption className="sr-only">Guias de recolhimento tributário</caption>
                <thead>
                  <tr>
                    <th scope="col" className="cp-review-modal__th">TIPO</th>
                    <th scope="col" className="cp-review-modal__th cp-review-modal__th--mono">VALOR</th>
                    <th scope="col" className="cp-review-modal__th">VENCIMENTO</th>
                    <th scope="col" className="cp-review-modal__th">COMPETÊNCIA</th>
                  </tr>
                </thead>
                <tbody>
                  {data.taxGuideItems.map((tg, idx) => (
                    <tr key={idx} className="cp-review-modal__tax-row">
                      <td className="cp-review-modal__td">{tg.type}</td>
                      <td className="cp-review-modal__td cp-review-modal__td--mono">
                        {formatCurrency(tg.amount)}
                      </td>
                      <td className="cp-review-modal__td">{formatDate(tg.dueDate)}</td>
                      <td className="cp-review-modal__td">{tg.referenceMonth}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="cp-review-modal__td cp-review-modal__td--label" colSpan={1}>
                      Total guias
                    </td>
                    <td className="cp-review-modal__td cp-review-modal__td--mono cp-review-modal__td--total" colSpan={3}>
                      {formatCurrency(data.totalTaxGuides)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Reconciliation row */}
          {!isLoading && !error && data && (
            <div
              className={`cp-review-modal__reconciliation${data.reconciled ? ' cp-review-modal__reconciliation--ok' : ' cp-review-modal__reconciliation--warn'}`}
              role="status"
            >
              <div className="cp-review-modal__reconciliation-totals">
                <span>
                  Total CPs gerados:{' '}
                  <span className="cp-review-modal__mono">{formatCurrency(data.totalAmount)}</span>
                </span>
                <span className="cp-review-modal__reconciliation-sep">—</span>
                <span>
                  Total folha líquida:{' '}
                  <span className="cp-review-modal__mono">{formatCurrency(data.runTotalNet)}</span>
                </span>
              </div>
              <div className="cp-review-modal__reconciliation-status">
                {data.reconciled ? (
                  <>
                    <CheckCircle size={16} aria-hidden="true" className="cp-review-modal__icon-ok" />
                    <span>Total reconciliado com a folha.</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={16} aria-hidden="true" className="cp-review-modal__icon-warn" />
                    <span>
                      Atenção: diferença de{' '}
                      {formatCurrency(Math.abs(data.totalAmount - data.runTotalNet))}{' '}
                      entre CPs e folha líquida. Verifique rateios por centro de custo.
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="cp-review-modal__footer">
          <button
            type="button"
            className="cp-review-modal__btn cp-review-modal__btn--secondary"
            onClick={onClose}
            disabled={isConfirming}
          >
            Voltar à Folha
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className="cp-review-modal__btn cp-review-modal__btn--primary"
            onClick={onConfirmClose}
            disabled={isLoading || isConfirming || !!error}
          >
            {isConfirming ? 'Fechando...' : 'Confirmar Fechamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
