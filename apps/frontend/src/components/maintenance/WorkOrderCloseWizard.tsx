import { useEffect, useState } from 'react';
import { X, AlertTriangle, Info } from 'lucide-react';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import type { WorkOrder, AccountingTreatment } from '@/types/maintenance';
import './WorkOrderCloseWizard.css';

// ─── Props ─────────────────────────────────────────────────────────────

interface WorkOrderCloseWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  workOrder: WorkOrder;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const TREATMENT_LABELS: Record<AccountingTreatment, string> = {
  DESPESA: 'Despesa imediata',
  CAPITALIZACAO: 'Capitalizacao',
  DIFERIMENTO: 'Diferimento',
};

// ─── Main component ────────────────────────────────────────────────────

export default function WorkOrderCloseWizard({
  isOpen,
  onClose,
  onSuccess,
  workOrder,
}: WorkOrderCloseWizardProps) {
  const { closeWorkOrder } = useWorkOrders();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [accountingTreatment, setAccountingTreatment] = useState<AccountingTreatment | null>(null);
  const [deferralMonths, setDeferralMonths] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep(1);
    setAccountingTreatment(null);
    setDeferralMonths('');
    setIsSubmitting(false);
    setSubmitError(null);
  }, [isOpen]);

  // Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Computed costs
  const partsCost = workOrder.totalPartsCost ?? 0;
  const laborCost = workOrder.totalLaborCost ?? 0;
  const extCost = workOrder.externalCost ?? 0;
  const totalCost = partsCost + laborCost + extCost;
  const belowThreshold = totalCost < 1000;
  const newBookValue = totalCost; // Simplified — in real app would add to current book value

  async function handleClose() {
    if (!accountingTreatment) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await closeWorkOrder(
        workOrder.id,
        {
          accountingTreatment,
          deferralMonths:
            accountingTreatment === 'DIFERIMENTO' && deferralMonths
              ? Number(deferralMonths)
              : undefined,
        },
        onSuccess,
      );
    } catch {
      setSubmitError(
        'Nao foi possivel encerrar a OS. Verifique se todos os campos estao preenchidos.',
      );
      setIsSubmitting(false);
    }
  }

  function getStepDotClass(dotStep: number): string {
    if (dotStep < step) return 'wo-wizard__step-dot wo-wizard__step-dot--completed';
    if (dotStep === step) return 'wo-wizard__step-dot wo-wizard__step-dot--active';
    return 'wo-wizard__step-dot wo-wizard__step-dot--inactive';
  }

  function getRadioCardClass(treatment: AccountingTreatment): string {
    if (accountingTreatment !== treatment) return 'wo-wizard__radio-card';
    if (treatment === 'DESPESA')
      return 'wo-wizard__radio-card wo-wizard__radio-card--selected-despesa';
    if (treatment === 'CAPITALIZACAO')
      return 'wo-wizard__radio-card wo-wizard__radio-card--selected-capitalizacao';
    return 'wo-wizard__radio-card wo-wizard__radio-card--selected-diferimento';
  }

  return (
    <div
      className="wo-wizard__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wo-wizard-title"
    >
      <div className="wo-wizard">
        {/* Header */}
        <header className="wo-wizard__header">
          <div className="wo-wizard__header-row">
            <h2 className="wo-wizard__title" id="wo-wizard-title">
              Encerrar OS #{String(workOrder.sequentialNumber).padStart(4, '0')}
            </h2>
            <button
              type="button"
              className="wo-wizard__close"
              onClick={onClose}
              aria-label="Fechar"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          {/* Stepper */}
          <div
            className="wo-wizard__stepper"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={3}
            aria-valuenow={step}
            aria-label={`Passo ${step} de 3`}
          >
            <span className={getStepDotClass(1)} aria-hidden="true" />
            <span className={getStepDotClass(2)} aria-hidden="true" />
            <span className={getStepDotClass(3)} aria-hidden="true" />
          </div>
        </header>

        {/* Body */}
        <div className="wo-wizard__body">
          {/* ─── Step 1: Resumo de Custos ─────────────────── */}
          <div style={{ display: step === 1 ? 'block' : 'none' }}>
            <p className="wo-wizard__step-label">Passo 1 de 3 — Resumo de Custos</p>
            <table className="wo-wizard__cost-table">
              <caption className="sr-only">Resumo dos custos da OS</caption>
              <tbody>
                <tr>
                  <td>Pecas</td>
                  <td>{formatBRL(partsCost)}</td>
                </tr>
                <tr>
                  <td>Mao de obra</td>
                  <td>{formatBRL(laborCost)}</td>
                </tr>
                <tr>
                  <td>Custo externo</td>
                  <td>{formatBRL(extCost)}</td>
                </tr>
                <tr className="wo-wizard__cost-total">
                  <td>Total</td>
                  <td>{formatBRL(totalCost)}</td>
                </tr>
              </tbody>
            </table>

            {belowThreshold && (
              <div className="wo-wizard__info-banner" role="note">
                <Info size={20} aria-hidden="true" />
                <div>
                  Classificacao automatica: Despesa imediata.{' '}
                  <button
                    type="button"
                    className="wo-wizard__info-banner-link"
                    onClick={() => setStep(2)}
                  >
                    Alterar classificacao
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ─── Step 2: Classificacao Contabil ──────────── */}
          <div style={{ display: step === 2 ? 'block' : 'none' }}>
            <p className="wo-wizard__step-label">Passo 2 de 3 — Classificacao Contabil</p>
            <div
              className="wo-wizard__radio-cards"
              role="radiogroup"
              aria-label="Classificacao contabil"
            >
              {/* DESPESA */}
              <label className={getRadioCardClass('DESPESA')}>
                <input
                  type="radio"
                  name="accounting-treatment"
                  value="DESPESA"
                  checked={accountingTreatment === 'DESPESA'}
                  onChange={() => setAccountingTreatment('DESPESA')}
                />
                <p className="wo-wizard__radio-card-title">Despesa imediata</p>
                <p className="wo-wizard__radio-card-desc">
                  Custo vai direto para o resultado do periodo. Use quando a manutencao nao estende
                  a vida util do ativo.
                </p>
              </label>

              {/* CAPITALIZACAO */}
              <label className={getRadioCardClass('CAPITALIZACAO')}>
                <input
                  type="radio"
                  name="accounting-treatment"
                  value="CAPITALIZACAO"
                  checked={accountingTreatment === 'CAPITALIZACAO'}
                  onChange={() => setAccountingTreatment('CAPITALIZACAO')}
                />
                <p className="wo-wizard__radio-card-title">Capitalizacao</p>
                <p className="wo-wizard__radio-card-desc">
                  Custo e somado ao valor do ativo e comeca a depreciar. Use quando a manutencao
                  restaura ou aumenta a capacidade produtiva.
                </p>
              </label>

              {/* DIFERIMENTO */}
              <label className={getRadioCardClass('DIFERIMENTO')}>
                <input
                  type="radio"
                  name="accounting-treatment"
                  value="DIFERIMENTO"
                  checked={accountingTreatment === 'DIFERIMENTO'}
                  onChange={() => setAccountingTreatment('DIFERIMENTO')}
                />
                <p className="wo-wizard__radio-card-title">Diferimento</p>
                <p className="wo-wizard__radio-card-desc">
                  Custo e distribuido nos proximos meses. Use para manutencoes programadas de grande
                  porte.
                </p>
                {/* Deferral months — display:none, no animation per CLAUDE.md */}
                <div
                  className="wo-wizard__deferral-field"
                  style={{ display: accountingTreatment === 'DIFERIMENTO' ? 'block' : 'none' }}
                >
                  <label htmlFor="deferral-months" className="wo-wizard__deferral-label">
                    Distribuir em X meses
                  </label>
                  <input
                    id="deferral-months"
                    type="number"
                    min="1"
                    max="60"
                    className="wo-wizard__deferral-input"
                    value={deferralMonths}
                    onChange={(e) => setDeferralMonths(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </label>
            </div>
          </div>

          {/* ─── Step 3: Confirmar Encerramento ───────────── */}
          <div style={{ display: step === 3 ? 'block' : 'none' }}>
            <p className="wo-wizard__step-label">Passo 3 de 3 — Confirmar Encerramento</p>
            <table className="wo-wizard__confirm-table">
              <caption className="sr-only">Resumo do encerramento</caption>
              <tbody>
                <tr>
                  <td>OS</td>
                  <td className="confirm-mono">
                    #{String(workOrder.sequentialNumber).padStart(4, '0')}
                  </td>
                </tr>
                <tr>
                  <td>Ativo</td>
                  <td>{workOrder.asset?.name ?? '—'}</td>
                </tr>
                <tr>
                  <td>Classificacao</td>
                  <td>{accountingTreatment ? TREATMENT_LABELS[accountingTreatment] : '—'}</td>
                </tr>
                <tr>
                  <td>Custo total</td>
                  <td className="confirm-mono">{formatBRL(totalCost)}</td>
                </tr>
              </tbody>
            </table>

            {/* Capitalizacao warning */}
            {accountingTreatment === 'CAPITALIZACAO' && (
              <div className="wo-wizard__warning-banner" role="alert">
                <AlertTriangle size={20} aria-hidden="true" style={{ flexShrink: 0 }} />
                <span>
                  O valor contabil do ativo sera atualizado para {formatBRL(newBookValue)}. Revise a
                  configuracao de depreciacao apos o encerramento.
                </span>
              </div>
            )}

            {/* Submit error */}
            {submitError && (
              <div className="wo-wizard__error" role="alert">
                {submitError}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="wo-wizard__footer">
          <div>
            {step > 1 && (
              <button
                type="button"
                className="wo-wizard__btn-back"
                onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
                disabled={isSubmitting}
              >
                Voltar
              </button>
            )}
          </div>

          <div className="wo-wizard__footer-right">
            <button
              type="button"
              className="wo-wizard__btn-close"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>

            {step === 1 && (
              <button
                type="button"
                className="wo-wizard__btn-primary"
                onClick={() => {
                  if (belowThreshold && accountingTreatment === null) {
                    setAccountingTreatment('DESPESA');
                  }
                  setStep(2);
                }}
              >
                Continuar para classificacao
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                className="wo-wizard__btn-primary"
                onClick={() => {
                  if (!accountingTreatment) return;
                  setStep(3);
                }}
                disabled={!accountingTreatment}
              >
                Confirmar e encerrar
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                className="wo-wizard__btn-primary"
                onClick={() => void handleClose()}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Encerrando...' : 'Encerrar OS'}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
