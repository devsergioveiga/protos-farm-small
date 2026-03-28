import { useEffect, useRef, useState } from 'react';
import { X, Lock, RotateCcw } from 'lucide-react';
import PayrollRunStatusBadge from './PayrollRunStatusBadge';
import PayrollRunItemRow from './PayrollRunItemRow';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { PayrollRun } from '@/types/payroll-runs';
import { RUN_TYPE_LABELS } from '@/types/payroll-runs';
import './PayrollRunDetailModal.css';

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getRunReference(run: PayrollRun): string {
  const [year, month] = run.referenceMonth.split('-');
  const monthNames = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  const monthName = monthNames[parseInt(month, 10) - 1] ?? month;
  const typeLabel = RUN_TYPE_LABELS[run.runType] ?? run.runType;
  return `${monthName}/${year} - ${typeLabel}`;
}

interface PayrollRunDetailModalProps {
  isOpen: boolean;
  run: PayrollRun | null;
  onClose: () => void;
  onCloseRun: (runId: string) => Promise<boolean>;
  onRevertRun: (runId: string) => Promise<boolean>;
  onRecalculateEmployee: (runId: string, employeeId: string) => Promise<boolean>;
  onDownloadItemPayslip: (runId: string, itemId: string) => Promise<void>;
  isLoading?: boolean;
}

export default function PayrollRunDetailModal({
  isOpen,
  run,
  onClose,
  onCloseRun,
  onRevertRun,
  onRecalculateEmployee,
  onDownloadItemPayslip,
  isLoading = false,
}: PayrollRunDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [recalculatingEmployeeId, setRecalculatingEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => closeButtonRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !showRevertConfirm) {
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
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, showRevertConfirm]);

  if (!isOpen || !run) return null;

  const runReference = getRunReference(run);
  const totalDiscounts =
    run.totalGross !== null && run.totalNet !== null ? run.totalGross - run.totalNet : null;

  async function handleCloseRun() {
    if (!run) return;
    setIsClosing(true);
    const success = await onCloseRun(run.id);
    setIsClosing(false);
    if (success) onClose();
  }

  async function handleRevertConfirm() {
    if (!run) return;
    setIsReverting(true);
    const success = await onRevertRun(run.id);
    setIsReverting(false);
    setShowRevertConfirm(false);
    if (success) onClose();
  }

  async function handleRecalculate(employeeId: string) {
    if (!run) return;
    setRecalculatingEmployeeId(employeeId);
    await onRecalculateEmployee(run.id, employeeId);
    setRecalculatingEmployeeId(null);
  }

  async function handleDownloadPayslip(itemId: string) {
    if (!run) return;
    await onDownloadItemPayslip(run.id, itemId);
  }

  return (
    <div
      className="payroll-detail-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !showRevertConfirm) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="payroll-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payroll-detail-title"
      >
        {/* Header */}
        <div className="payroll-detail-modal__header">
          <div className="payroll-detail-modal__header-left">
            <h2 id="payroll-detail-title" className="payroll-detail-modal__title">
              Folha {runReference}
            </h2>
            <PayrollRunStatusBadge status={run.status} />
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="payroll-detail-modal__close-btn"
            onClick={onClose}
            aria-label="Fechar detalhes da folha"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Summary */}
        <div className="payroll-detail-modal__summary">
          <div className="payroll-detail-modal__summary-item">
            <span className="payroll-detail-modal__summary-label">Total Bruto</span>
            <span className="payroll-detail-modal__summary-value">
              {formatCurrency(run.totalGross)}
            </span>
          </div>
          <div className="payroll-detail-modal__summary-item">
            <span className="payroll-detail-modal__summary-label">Total Descontos</span>
            <span className="payroll-detail-modal__summary-value">
              {formatCurrency(totalDiscounts)}
            </span>
          </div>
          <div className="payroll-detail-modal__summary-item">
            <span className="payroll-detail-modal__summary-label">Total Líquido</span>
            <span className="payroll-detail-modal__summary-value payroll-detail-modal__summary-value--highlight">
              {formatCurrency(run.totalNet)}
            </span>
          </div>
          <div className="payroll-detail-modal__summary-item">
            <span className="payroll-detail-modal__summary-label">Encargos</span>
            <span className="payroll-detail-modal__summary-value">
              {formatCurrency(run.totalCharges)}
            </span>
          </div>
        </div>

        {/* Items table */}
        <div className="payroll-detail-modal__body">
          {run.items && run.items.length > 0 ? (
            <table className="payroll-detail-modal__table">
              <caption className="sr-only">Itens da folha de pagamento</caption>
              <thead>
                <tr>
                  <th scope="col" className="payroll-detail-modal__th">
                    COLABORADOR
                  </th>
                  <th scope="col" className="payroll-detail-modal__th">
                    STATUS
                  </th>
                  <th scope="col" className="payroll-detail-modal__th">
                    BRUTO
                  </th>
                  <th scope="col" className="payroll-detail-modal__th">
                    LIQUIDO
                  </th>
                  <th scope="col" className="payroll-detail-modal__th">
                    ACOES
                  </th>
                </tr>
              </thead>
              <tbody>
                {run.items.map((item) => (
                  <PayrollRunItemRow
                    key={item.id}
                    item={item}
                    onRecalculate={handleRecalculate}
                    onDownloadPayslip={handleDownloadPayslip}
                    isRecalculating={recalculatingEmployeeId === item.employeeId}
                  />
                ))}
              </tbody>
            </table>
          ) : (
            <p className="payroll-detail-modal__empty">Nenhum colaborador nesta folha.</p>
          )}
        </div>

        {/* Footer actions */}
        <div className="payroll-detail-modal__footer">
          {run.status === 'CALCULATED' && (
            <button
              type="button"
              className="payroll-detail-modal__btn payroll-detail-modal__btn--primary"
              onClick={handleCloseRun}
              disabled={isLoading || isClosing}
            >
              <Lock size={16} aria-hidden="true" />
              {isClosing ? 'Fechando...' : 'Fechar Folha'}
            </button>
          )}
          {run.status === 'COMPLETED' && (
            <button
              type="button"
              className="payroll-detail-modal__btn payroll-detail-modal__btn--danger"
              onClick={() => setShowRevertConfirm(true)}
              disabled={isLoading || isReverting}
            >
              <RotateCcw size={16} aria-hidden="true" />
              Estornar Folha
            </button>
          )}
        </div>
      </div>

      {/* Revert confirmation — medium criticality, ConfirmModal variant=danger per UI-SPEC */}
      <ConfirmModal
        isOpen={showRevertConfirm}
        title="Estornar fechamento da folha?"
        message="Esta ação cancela todas as contas a pagar geradas e os lançamentos contábeis do fechamento. O espelho de ponto volta a ficar editável. Não é possível desfazer sem reprocessar a folha."
        confirmLabel="Estornar Folha"
        cancelLabel="Manter Fechamento"
        variant="danger"
        isLoading={isReverting}
        onConfirm={handleRevertConfirm}
        onCancel={() => setShowRevertConfirm(false)}
      />
    </div>
  );
}
