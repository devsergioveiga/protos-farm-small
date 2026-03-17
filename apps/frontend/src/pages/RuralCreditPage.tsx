import { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, AlertCircle, Landmark } from 'lucide-react';
import { useRuralCredit } from '@/hooks/useRuralCredit';
import { useFarms } from '@/hooks/useFarms';
import type { RuralCreditStatus, RuralCreditLine } from '@/types/rural-credit';
import { CREDIT_LINE_LABELS, AMORTIZATION_LABELS, STATUS_LABELS } from '@/types/rural-credit';
import './RuralCreditPage.css';

const RuralCreditModal = lazy(() => import('@/components/rural-credit/RuralCreditModal'));

// ─── Helpers ──────────────────────────────────────────────────────

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

// ─── Status badge ─────────────────────────────────────────────────

function StatusBadge({ status }: { status: RuralCreditStatus }) {
  return (
    <span className={`rc-page__status-badge rc-page__status-badge--${status.toLowerCase()}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rc-page__card rc-page__card--skeleton" aria-hidden="true">
      <div className="rc-page__skeleton rc-page__skeleton--badge" />
      <div className="rc-page__skeleton rc-page__skeleton--title" />
      <div className="rc-page__skeleton rc-page__skeleton--line" />
      <div className="rc-page__skeleton rc-page__skeleton--line rc-page__skeleton--short" />
      <div className="rc-page__skeleton rc-page__skeleton--line" />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export default function RuralCreditPage() {
  const navigate = useNavigate();

  // Filters
  const [creditLineFilter, setCreditLineFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [farmFilter, setFarmFilter] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const { farms } = useFarms();
  const { contracts, loading, error, refetch } = useRuralCredit({
    farmId: farmFilter || undefined,
    status: statusFilter || undefined,
    creditLine: creditLineFilter || undefined,
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }

  function handleCreateSuccess() {
    setShowModal(false);
    void refetch();
    showToast('Contrato de credito rural cadastrado com sucesso');
  }

  return (
    <main className="rc-page" id="main-content">
      {toast && (
        <div className="rc-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="rc-page__breadcrumb" aria-label="Navegacao">
        <a href="/financial-dashboard" className="rc-page__breadcrumb-link">
          Dashboard
        </a>
        <span className="rc-page__breadcrumb-sep" aria-hidden="true">
          /
        </span>
        <span className="rc-page__breadcrumb-current" aria-current="page">
          Credito Rural
        </span>
      </nav>

      {/* Header */}
      <header className="rc-page__header">
        <div>
          <h1 className="rc-page__title">Credito Rural</h1>
          <p className="rc-page__subtitle">
            Gerencie contratos, parcelas e amortizacoes extraordinarias
          </p>
        </div>
        <button type="button" className="rc-page__btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={20} aria-hidden="true" />
          Novo contrato
        </button>
      </header>

      {/* Filters */}
      <div className="rc-page__filters">
        <div className="rc-page__filter-group">
          <label htmlFor="rc-credit-line" className="rc-page__filter-label">
            Linha
          </label>
          <select
            id="rc-credit-line"
            className="rc-page__filter-select"
            value={creditLineFilter}
            onChange={(e) => setCreditLineFilter(e.target.value)}
          >
            <option value="">Todas</option>
            {(Object.keys(CREDIT_LINE_LABELS) as RuralCreditLine[]).map((line) => (
              <option key={line} value={line}>
                {CREDIT_LINE_LABELS[line]}
              </option>
            ))}
          </select>
        </div>

        <div className="rc-page__filter-group">
          <label htmlFor="rc-status" className="rc-page__filter-label">
            Status
          </label>
          <select
            id="rc-status"
            className="rc-page__filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="ATIVO">Ativo</option>
            <option value="QUITADO">Quitado</option>
            <option value="INADIMPLENTE">Inadimplente</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </div>

        {farms.length > 1 && (
          <div className="rc-page__filter-group">
            <label htmlFor="rc-farm" className="rc-page__filter-label">
              Fazenda
            </label>
            <select
              id="rc-farm"
              className="rc-page__filter-select"
              value={farmFilter}
              onChange={(e) => setFarmFilter(e.target.value)}
            >
              <option value="">Todas</option>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rc-page__error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="rc-page__grid" aria-busy="true" aria-label="Carregando contratos">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && contracts.length === 0 && (
        <div className="rc-page__empty">
          <Landmark size={64} className="rc-page__empty-icon" aria-hidden="true" />
          <h2 className="rc-page__empty-title">Nenhum contrato de credito rural</h2>
          <p className="rc-page__empty-desc">
            Cadastre o primeiro contrato para acompanhar parcelas e saldo devedor.
          </p>
          <button type="button" className="rc-page__btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={20} aria-hidden="true" />
            Novo contrato
          </button>
        </div>
      )}

      {/* Contract cards grid */}
      {!loading && contracts.length > 0 && (
        <div className="rc-page__grid">
          {contracts.map((contract) => (
            <article
              key={contract.id}
              className="rc-page__card"
              onClick={() => navigate(`/rural-credit/${contract.id}`)}
              role="button"
              tabIndex={0}
              aria-label={`Contrato ${contract.contractNumber ?? contract.creditLine} — ${STATUS_LABELS[contract.status]}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  navigate(`/rural-credit/${contract.id}`);
                }
              }}
            >
              {/* Top: badges */}
              <div className="rc-page__card-badges">
                <span className="rc-page__credit-line-badge">
                  {CREDIT_LINE_LABELS[contract.creditLine]}
                </span>
                <StatusBadge status={contract.status} />
              </div>

              {/* Contract number */}
              {contract.contractNumber && (
                <p className="rc-page__card-contract-num">{contract.contractNumber}</p>
              )}

              {/* Bank + farm */}
              <p className="rc-page__card-meta">
                {contract.bankName && <span>{contract.bankName}</span>}
                {contract.bankName && contract.farmName && (
                  <span className="rc-page__card-sep" aria-hidden="true">
                    {' '}
                    ·{' '}
                  </span>
                )}
                {contract.farmName && <span>{contract.farmName}</span>}
              </p>

              {/* Principal */}
              <div className="rc-page__card-row">
                <span className="rc-page__card-label">Principal</span>
                <span className="rc-page__card-value rc-page__card-value--mono">
                  {formatBRL(contract.principalAmount)}
                </span>
              </div>

              {/* Saldo devedor */}
              <div className="rc-page__card-row">
                <span className="rc-page__card-label">Saldo devedor</span>
                <span
                  className={`rc-page__card-value rc-page__card-value--mono${contract.outstandingBalance > 0 ? ' rc-page__card-value--bold' : ''}`}
                >
                  {formatBRL(contract.outstandingBalance)}
                </span>
              </div>

              {/* Proxima parcela */}
              <div className="rc-page__card-row">
                <span className="rc-page__card-label">Proxima parcela</span>
                <span className="rc-page__card-value rc-page__card-value--mono">
                  {contract.nextPaymentDate && contract.nextPaymentAmount != null
                    ? `${formatDate(contract.nextPaymentDate)} — ${formatBRL(contract.nextPaymentAmount)}`
                    : 'Sem parcelas pendentes'}
                </span>
              </div>

              {/* System */}
              <div className="rc-page__card-footer">
                <span className="rc-page__card-system">
                  {AMORTIZATION_LABELS[contract.amortizationSystem]}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Suspense fallback={null}>
          <RuralCreditModal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            onSuccess={handleCreateSuccess}
          />
        </Suspense>
      )}
    </main>
  );
}
