import { useState, useCallback, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Edit2, XCircle, CheckCircle2, Clock } from 'lucide-react';
import {
  useRuralCreditDetail,
  cancelContract,
  settleInstallment,
  type SettleInstallmentData,
} from '@/hooks/useRuralCredit';
import type { RuralCreditStatus, RuralCreditInstallmentDetail } from '@/types/rural-credit';
import { CREDIT_LINE_LABELS, AMORTIZATION_LABELS, STATUS_LABELS } from '@/types/rural-credit';
import './RuralCreditDetailPage.css';

const RuralCreditModal = lazy(() => import('@/components/rural-credit/RuralCreditModal'));
const ExtraordinaryAmortizationModal = lazy(
  () => import('@/components/rural-credit/ExtraordinaryAmortizationModal'),
);

// ─── Helpers ─────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date();
}

// ─── Status badge ─────────────────────────────────────────────────

function StatusBadge({ status }: { status: RuralCreditStatus }) {
  return (
    <span className={`rcd__status-badge rcd__status-badge--${status.toLowerCase()}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Installment status ───────────────────────────────────────────

function InstallmentStatusBadge({
  payableStatus,
  dueDate,
}: {
  payableStatus: string;
  dueDate: string;
}) {
  if (payableStatus === 'PAID') {
    return (
      <span className="rcd__inst-badge rcd__inst-badge--paid">
        <CheckCircle2 size={12} aria-hidden="true" />
        Pago
      </span>
    );
  }
  if (payableStatus === 'CANCELLED') {
    return (
      <span className="rcd__inst-badge rcd__inst-badge--cancelled">
        <XCircle size={12} aria-hidden="true" />
        Cancelado
      </span>
    );
  }
  if (payableStatus === 'PENDING' && isOverdue(dueDate)) {
    return (
      <span className="rcd__inst-badge rcd__inst-badge--overdue">
        <AlertCircle size={12} aria-hidden="true" />
        Vencido
      </span>
    );
  }
  return (
    <span className="rcd__inst-badge rcd__inst-badge--pending">
      <Clock size={12} aria-hidden="true" />
      Pendente
    </span>
  );
}

// ─── Settlement form ──────────────────────────────────────────────

interface SettlementFormProps {
  installment: RuralCreditInstallmentDetail;
  contractId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function SettlementForm({ installment, contractId, onSuccess, onCancel }: SettlementFormProps) {
  const today = new Date().toISOString().split('T')[0];
  const [paidAmount, setPaidAmount] = useState(
    new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      installment.totalAmount,
    ),
  );
  const [paidAt, setPaidAt] = useState(today);
  const [interest, setInterest] = useState('');
  const [fine, setFine] = useState('');
  const [discount, setDiscount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const data: SettleInstallmentData = {
        paidAmount: parseCurrency(paidAmount),
        paidAt,
        interestAmount: interest ? parseCurrency(interest) : undefined,
        fineAmount: fine ? parseCurrency(fine) : undefined,
        discountAmount: discount ? parseCurrency(discount) : undefined,
      };
      await settleInstallment(contractId, installment.payableId, data);
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Nao foi possivel registrar baixa. Tente novamente.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [contractId, installment.payableId, paidAmount, paidAt, interest, fine, discount, onSuccess]);

  return (
    <div className="rcd__settlement-form">
      {error && (
        <div className="rcd__settlement-error" role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </div>
      )}
      <div className="rcd__settlement-grid">
        <div className="rcd__settlement-field">
          <label htmlFor={`settle-amount-${installment.id}`} className="rcd__settlement-label">
            Valor pago
          </label>
          <input
            id={`settle-amount-${installment.id}`}
            type="text"
            inputMode="numeric"
            className="rcd__settlement-input rcd__settlement-input--mono"
            value={paidAmount}
            onChange={(e) => setPaidAmount(formatCurrencyInput(e.target.value))}
            aria-required="true"
          />
        </div>
        <div className="rcd__settlement-field">
          <label htmlFor={`settle-date-${installment.id}`} className="rcd__settlement-label">
            Data pagamento
          </label>
          <input
            id={`settle-date-${installment.id}`}
            type="date"
            className="rcd__settlement-input"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            aria-required="true"
          />
        </div>
        <div className="rcd__settlement-field">
          <label htmlFor={`settle-interest-${installment.id}`} className="rcd__settlement-label">
            Juros
          </label>
          <input
            id={`settle-interest-${installment.id}`}
            type="text"
            inputMode="numeric"
            className="rcd__settlement-input rcd__settlement-input--mono"
            value={interest}
            onChange={(e) => setInterest(formatCurrencyInput(e.target.value))}
            placeholder="0,00"
          />
        </div>
        <div className="rcd__settlement-field">
          <label htmlFor={`settle-fine-${installment.id}`} className="rcd__settlement-label">
            Multa
          </label>
          <input
            id={`settle-fine-${installment.id}`}
            type="text"
            inputMode="numeric"
            className="rcd__settlement-input rcd__settlement-input--mono"
            value={fine}
            onChange={(e) => setFine(formatCurrencyInput(e.target.value))}
            placeholder="0,00"
          />
        </div>
        <div className="rcd__settlement-field">
          <label htmlFor={`settle-discount-${installment.id}`} className="rcd__settlement-label">
            Desconto
          </label>
          <input
            id={`settle-discount-${installment.id}`}
            type="text"
            inputMode="numeric"
            className="rcd__settlement-input rcd__settlement-input--mono"
            value={discount}
            onChange={(e) => setDiscount(formatCurrencyInput(e.target.value))}
            placeholder="0,00"
          />
        </div>
      </div>
      <div className="rcd__settlement-actions">
        <button type="button" className="rcd__settlement-cancel" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className="rcd__settlement-submit"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          aria-busy={submitting}
        >
          Confirmar baixa
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

type TabId = 'cronograma' | 'amortizacoes' | 'historico';

export default function RuralCreditDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabId>('cronograma');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAmortizationModal, setShowAmortizationModal] = useState(false);
  const [expandedSettleId, setExpandedSettleId] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  const { contract, loading, error, refetch } = useRuralCreditDetail(id);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }

  const handleEditSuccess = useCallback(() => {
    setShowEditModal(false);
    void refetch();
    showToast('Contrato atualizado com sucesso');
  }, [refetch]);

  const handleAmortizationSuccess = useCallback(() => {
    setShowAmortizationModal(false);
    void refetch();
    showToast('Amortizacao extraordinaria registrada com sucesso');
  }, [refetch]);

  const handleSettleSuccess = useCallback(() => {
    setExpandedSettleId(null);
    void refetch();
    showToast('Baixa de parcela registrada com sucesso');
  }, [refetch]);

  const handleCancel = useCallback(async () => {
    if (!id) return;
    setCancelling(true);
    try {
      await cancelContract(id);
      void refetch();
      setShowCancelConfirm(false);
      showToast('Contrato cancelado com sucesso');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nao foi possivel cancelar o contrato.');
    } finally {
      setCancelling(false);
    }
  }, [id, refetch]);

  // Loading state
  if (loading) {
    return (
      <main className="rcd" id="main-content">
        <div className="rcd__loading" aria-busy="true">
          <div className="rcd__skeleton rcd__skeleton--title" />
          <div className="rcd__skeleton rcd__skeleton--subtitle" />
          <div className="rcd__summary-cards">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rcd__summary-card">
                <div className="rcd__skeleton rcd__skeleton--line" />
                <div className="rcd__skeleton rcd__skeleton--value" />
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error || !contract) {
    return (
      <main className="rcd" id="main-content">
        <div className="rcd__error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          {error ?? 'Contrato nao encontrado'}
        </div>
        <button type="button" className="rcd__back-btn" onClick={() => navigate('/rural-credit')}>
          <ArrowLeft size={16} aria-hidden="true" />
          Voltar
        </button>
      </main>
    );
  }

  const contractLabel = contract.contractNumber
    ? `${CREDIT_LINE_LABELS[contract.creditLine]} — ${contract.contractNumber}`
    : CREDIT_LINE_LABELS[contract.creditLine];

  return (
    <main className="rcd" id="main-content">
      {toast && (
        <div className="rcd__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {/* Cancel confirmation */}
      {showCancelConfirm && (
        <div
          className="rcd__confirm-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar cancelamento"
        >
          <div className="rcd__confirm-panel">
            <h3 className="rcd__confirm-title">Cancelar contrato?</h3>
            <p className="rcd__confirm-text">
              O contrato <strong>{contractLabel}</strong> sera cancelado. Esta acao nao pode ser
              desfeita.
            </p>
            <div className="rcd__confirm-actions">
              <button
                type="button"
                className="rcd__confirm-cancel"
                onClick={() => setShowCancelConfirm(false)}
              >
                Voltar
              </button>
              <button
                type="button"
                className="rcd__confirm-danger"
                onClick={() => void handleCancel()}
                disabled={cancelling}
                aria-busy={cancelling}
              >
                <XCircle size={16} aria-hidden="true" />
                Confirmar cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="rcd__breadcrumb" aria-label="Navegacao">
        <a href="/financial-dashboard" className="rcd__breadcrumb-link">
          Dashboard
        </a>
        <span className="rcd__breadcrumb-sep" aria-hidden="true">
          /
        </span>
        <a href="/rural-credit" className="rcd__breadcrumb-link">
          Credito Rural
        </a>
        <span className="rcd__breadcrumb-sep" aria-hidden="true">
          /
        </span>
        <span className="rcd__breadcrumb-current" aria-current="page">
          {contract.contractNumber ?? 'Contrato'}
        </span>
      </nav>

      {/* Header section */}
      <header className="rcd__header">
        <div className="rcd__header-info">
          <div className="rcd__header-top">
            <StatusBadge status={contract.status} />
          </div>
          <h1 className="rcd__title">{contractLabel}</h1>
          <p className="rcd__subtitle">
            {contract.farmName && <span>{contract.farmName}</span>}
            {contract.farmName && contract.bankName && (
              <span className="rcd__sep" aria-hidden="true">
                {' '}
                ·{' '}
              </span>
            )}
            {contract.bankName && <span>{contract.bankName}</span>}
            <span className="rcd__sep" aria-hidden="true">
              {' '}
              ·{' '}
            </span>
            <span>{AMORTIZATION_LABELS[contract.amortizationSystem]}</span>
          </p>
        </div>
        <div className="rcd__header-actions">
          <button
            type="button"
            className="rcd__btn-secondary"
            onClick={() => setShowEditModal(true)}
          >
            <Edit2 size={16} aria-hidden="true" />
            Editar
          </button>
          {contract.status === 'ATIVO' && (
            <button
              type="button"
              className="rcd__btn-danger"
              onClick={() => setShowCancelConfirm(true)}
            >
              <XCircle size={16} aria-hidden="true" />
              Cancelar contrato
            </button>
          )}
        </div>
      </header>

      {/* Summary cards */}
      <div className="rcd__summary-cards" role="region" aria-label="Resumo do contrato">
        <div className="rcd__summary-card">
          <span className="rcd__summary-label">Valor contratado</span>
          <span className="rcd__summary-value">{formatBRL(contract.principalAmount)}</span>
        </div>
        <div className="rcd__summary-card">
          <span className="rcd__summary-label">Saldo devedor</span>
          <span className="rcd__summary-value rcd__summary-value--prominent">
            {formatBRL(contract.outstandingBalance)}
          </span>
        </div>
        <div className="rcd__summary-card">
          <span className="rcd__summary-label">Principal amortizado</span>
          <span className="rcd__summary-value">{formatBRL(contract.totalPrincipalPaid)}</span>
        </div>
        <div className="rcd__summary-card">
          <span className="rcd__summary-label">Juros pagos</span>
          <span className="rcd__summary-value">{formatBRL(contract.totalInterestPaid)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="rcd__tabs" role="tablist" aria-label="Secoes do contrato">
        {(
          [
            { id: 'cronograma', label: 'Cronograma' },
            { id: 'amortizacoes', label: 'Amortizacoes' },
            { id: 'historico', label: 'Historico' },
          ] as { id: TabId; label: string }[]
        ).map(({ id: tabId, label }) => (
          <button
            key={tabId}
            type="button"
            role="tab"
            aria-selected={activeTab === tabId}
            className={`rcd__tab${activeTab === tabId ? ' rcd__tab--active' : ''}`}
            onClick={() => setActiveTab(tabId)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Cronograma */}
      {activeTab === 'cronograma' && (
        <section aria-label="Cronograma de parcelas">
          {/* Desktop table */}
          <div className="rcd__table-wrap">
            <table className="rcd__table">
              <caption className="sr-only">Cronograma de parcelas do contrato</caption>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Vencimento</th>
                  <th scope="col" className="rcd__col-right">
                    Principal
                  </th>
                  <th scope="col" className="rcd__col-right">
                    Juros
                  </th>
                  <th scope="col" className="rcd__col-right">
                    Total
                  </th>
                  <th scope="col" className="rcd__col-right">
                    Saldo devedor
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Acao</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(contract.installments ?? []).map((inst) => (
                  <>
                    <tr
                      key={inst.id}
                      className={inst.payableStatus === 'PAID' ? 'rcd__row--paid' : ''}
                    >
                      <td>{inst.installmentNumber}</td>
                      <td className="rcd__col-nowrap">{formatDate(inst.dueDate)}</td>
                      <td className="rcd__col-right rcd__col-mono">{formatBRL(inst.principal)}</td>
                      <td className="rcd__col-right rcd__col-mono">{formatBRL(inst.interest)}</td>
                      <td className="rcd__col-right rcd__col-mono rcd__col-bold">
                        {formatBRL(inst.totalAmount)}
                      </td>
                      <td className="rcd__col-right rcd__col-mono">
                        {formatBRL(inst.outstandingBalanceAfter)}
                      </td>
                      <td>
                        <InstallmentStatusBadge
                          payableStatus={inst.payableStatus}
                          dueDate={inst.dueDate}
                        />
                      </td>
                      <td>
                        {inst.payableStatus === 'PENDING' && (
                          <button
                            type="button"
                            className="rcd__baixa-btn"
                            onClick={() =>
                              setExpandedSettleId(expandedSettleId === inst.id ? null : inst.id)
                            }
                            aria-expanded={expandedSettleId === inst.id}
                          >
                            Baixa
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedSettleId === inst.id && (
                      <tr key={`settle-${inst.id}`} className="rcd__settlement-row">
                        <td colSpan={8}>
                          <SettlementForm
                            installment={inst}
                            contractId={contract.id}
                            onSuccess={handleSettleSuccess}
                            onCancel={() => setExpandedSettleId(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="rcd__inst-cards" aria-label="Parcelas (mobile)">
            {(contract.installments ?? []).map((inst) => (
              <div key={inst.id} className="rcd__inst-card">
                <div className="rcd__inst-card-header">
                  <span className="rcd__inst-card-num">Parcela #{inst.installmentNumber}</span>
                  <InstallmentStatusBadge
                    payableStatus={inst.payableStatus}
                    dueDate={inst.dueDate}
                  />
                </div>
                <div className="rcd__inst-card-row">
                  <span>Vencimento</span>
                  <span>{formatDate(inst.dueDate)}</span>
                </div>
                <div className="rcd__inst-card-row">
                  <span>Principal</span>
                  <span className="rcd__col-mono">{formatBRL(inst.principal)}</span>
                </div>
                <div className="rcd__inst-card-row">
                  <span>Juros</span>
                  <span className="rcd__col-mono">{formatBRL(inst.interest)}</span>
                </div>
                <div className="rcd__inst-card-row">
                  <span>Total</span>
                  <span className="rcd__col-mono rcd__col-bold">{formatBRL(inst.totalAmount)}</span>
                </div>
                {inst.payableStatus === 'PENDING' && (
                  <button
                    type="button"
                    className="rcd__baixa-btn rcd__baixa-btn--full"
                    onClick={() =>
                      setExpandedSettleId(expandedSettleId === inst.id ? null : inst.id)
                    }
                    aria-expanded={expandedSettleId === inst.id}
                  >
                    Dar baixa
                  </button>
                )}
                {expandedSettleId === inst.id && (
                  <SettlementForm
                    installment={inst}
                    contractId={contract.id}
                    onSuccess={handleSettleSuccess}
                    onCancel={() => setExpandedSettleId(null)}
                  />
                )}
              </div>
            ))}
            {(contract.installments ?? []).length === 0 && (
              <p className="rcd__empty-tab">Nenhuma parcela registrada.</p>
            )}
          </div>
        </section>
      )}

      {/* Tab: Amortizacoes */}
      {activeTab === 'amortizacoes' && (
        <section aria-label="Amortizacoes extraordinarias">
          {contract.status === 'ATIVO' && (
            <div className="rcd__tab-actions">
              <button
                type="button"
                className="rcd__btn-primary"
                onClick={() => setShowAmortizationModal(true)}
              >
                Amortizacao extraordinaria
              </button>
            </div>
          )}
          <p className="rcd__empty-tab">Nenhuma amortizacao extraordinaria registrada.</p>
        </section>
      )}

      {/* Tab: Historico */}
      {activeTab === 'historico' && (
        <section aria-label="Historico do contrato">
          <div className="rcd__timeline">
            <div className="rcd__timeline-item">
              <div className="rcd__timeline-icon rcd__timeline-icon--created" aria-hidden="true" />
              <div className="rcd__timeline-content">
                <p className="rcd__timeline-date">{formatDate(contract.createdAt)}</p>
                <p className="rcd__timeline-desc">Contrato criado</p>
              </div>
            </div>
            {contract.cancelledAt && (
              <div className="rcd__timeline-item">
                <div
                  className="rcd__timeline-icon rcd__timeline-icon--cancelled"
                  aria-hidden="true"
                />
                <div className="rcd__timeline-content">
                  <p className="rcd__timeline-date">{formatDate(contract.cancelledAt)}</p>
                  <p className="rcd__timeline-desc">Contrato cancelado</p>
                </div>
              </div>
            )}
            {(contract.installments ?? [])
              .filter((inst) => inst.payableStatus === 'PAID' && inst.paidAt)
              .map((inst) => (
                <div key={inst.id} className="rcd__timeline-item">
                  <div className="rcd__timeline-icon rcd__timeline-icon--paid" aria-hidden="true" />
                  <div className="rcd__timeline-content">
                    <p className="rcd__timeline-date">
                      {inst.paidAt ? formatDate(inst.paidAt) : '—'}
                    </p>
                    <p className="rcd__timeline-desc">
                      Parcela #{inst.installmentNumber} baixada — {formatBRL(inst.totalAmount)}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Edit modal */}
      {showEditModal && (
        <Suspense fallback={null}>
          <RuralCreditModal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            onSuccess={handleEditSuccess}
            contractId={contract.id}
          />
        </Suspense>
      )}

      {/* Amortization modal */}
      {showAmortizationModal && (
        <Suspense fallback={null}>
          <ExtraordinaryAmortizationModal
            isOpen={showAmortizationModal}
            onClose={() => setShowAmortizationModal(false)}
            onSuccess={handleAmortizationSuccess}
            contractId={contract.id}
            outstandingBalance={contract.outstandingBalance}
          />
        </Suspense>
      )}
    </main>
  );
}
