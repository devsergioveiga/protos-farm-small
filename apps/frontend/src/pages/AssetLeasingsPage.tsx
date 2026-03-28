import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  FileText,
  AlertCircle,
  CheckCircle,
  ShoppingCart,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useAssetLeasings } from '@/hooks/useAssetLeasings';
import AssetLeasingModal from '@/components/assets/AssetLeasingModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { LeasingOutput, LeasingStatus, CreateLeasingInput } from '@/types/asset';
import { LEASING_STATUS_LABELS, LEASING_STATUS_VARIANTS } from '@/types/asset';
import './AssetLeasingsPage.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

function formatCurrency(value: number): string {
  return currencyFmt.format(value);
}

function formatDate(dateStr: string): string {
  return dateFmt.format(new Date(dateStr + 'T12:00:00'));
}

// ─── Status badges ────────────────────────────────────────────────────────────

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todos os status' },
  ...Object.entries(LEASING_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

function StatusBadge({ status }: { status: LeasingStatus }) {
  const variant = LEASING_STATUS_VARIANTS[status] ?? 'info';
  const label = LEASING_STATUS_LABELS[status] ?? status;
  return (
    <span className={`leasing-page__badge leasing-page__badge--${variant}`}>
      {label}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div role="status" aria-label="Carregando contratos de leasing">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="leasing-page__skeleton-row">
          <div className="leasing-page__skeleton-cell leasing-page__skeleton-cell--md" />
          <div className="leasing-page__skeleton-cell leasing-page__skeleton-cell--lg" />
          <div className="leasing-page__skeleton-cell leasing-page__skeleton-cell--lg" />
          <div className="leasing-page__skeleton-cell leasing-page__skeleton-cell--md" />
          <div className="leasing-page__skeleton-cell leasing-page__skeleton-cell--xl" />
          <div className="leasing-page__skeleton-cell leasing-page__skeleton-cell--sm" />
          <div className="leasing-page__skeleton-cell leasing-page__skeleton-cell--md" />
          <div className="leasing-page__skeleton-cell leasing-page__skeleton-cell--sm" />
        </div>
      ))}
    </div>
  );
}

// ─── Confirm action types ─────────────────────────────────────────────────────

interface ConfirmAction {
  type: 'exercise' | 'return' | 'cancel';
  leasing: LeasingOutput;
}

const CONFIRM_CONFIG: Record<
  ConfirmAction['type'],
  { title: string; messageFn: (l: LeasingOutput) => string; label: string; variant: 'danger' | 'warning' }
> = {
  exercise: {
    title: 'Exercer opcao de compra',
    messageFn: (l) =>
      `Tem certeza que deseja exercer a opcao de compra do ativo "${l.rouAssetName}"? O ativo sera incorporado ao patrimonio da fazenda.`,
    label: 'Sim, exercer opcao',
    variant: 'warning',
  },
  return: {
    title: 'Devolver ativo arrendado',
    messageFn: (l) =>
      `Tem certeza que deseja registrar a devolucao do ativo "${l.rouAssetName}" ao arrendador "${l.lessorName}"?`,
    label: 'Sim, devolver',
    variant: 'warning',
  },
  cancel: {
    title: 'Cancelar contrato de leasing',
    messageFn: (l) =>
      `Tem certeza que deseja cancelar o contrato do ativo "${l.rouAssetName}"? Esta acao nao pode ser desfeita.`,
    label: 'Sim, cancelar contrato',
    variant: 'danger',
  },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AssetLeasingsPage() {
  const { farms, selectedFarmId } = useFarmContext();
  const {
    leasings,
    loading,
    error,
    fetchLeasings,
    createLeasing,
    exercisePurchase,
    returnAsset,
    cancelLeasing,
  } = useAssetLeasings();

  const [farmFilter, setFarmFilter] = useState(selectedFarmId ?? '');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch on mount + filter changes
  useEffect(() => {
    void fetchLeasings(farmFilter || undefined, statusFilter || undefined);
  }, [fetchLeasings, farmFilter, statusFilter]);

  // Sync farm filter with context
  useEffect(() => {
    if (selectedFarmId) setFarmFilter(selectedFarmId);
  }, [selectedFarmId]);

  // Auto-dismiss success message
  useEffect(() => {
    if (!successMsg) return;
    const timer = setTimeout(() => setSuccessMsg(null), 5000);
    return () => clearTimeout(timer);
  }, [successMsg]);

  const handleCreate = useCallback(
    async (input: CreateLeasingInput) => {
      await createLeasing(input);
      setSuccessMsg('Contrato de leasing criado com sucesso.');
    },
    [createLeasing],
  );

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const { type, leasing } = confirmAction;
      if (type === 'exercise') {
        await exercisePurchase(leasing.id);
        setSuccessMsg('Opcao de compra exercida com sucesso.');
      } else if (type === 'return') {
        await returnAsset(leasing.id);
        setSuccessMsg('Ativo devolvido ao arrendador com sucesso.');
      } else if (type === 'cancel') {
        await cancelLeasing(leasing.id);
        setSuccessMsg('Contrato cancelado com sucesso.');
      }
      setConfirmAction(null);
    } catch (_err) {
      setConfirmAction(null);
      // Error is already set inside the hook
    } finally {
      setActionLoading(false);
    }
  }, [confirmAction, exercisePurchase, returnAsset, cancelLeasing]);

  const isEmpty = !loading && leasings.length === 0 && !error;

  // ─── Action buttons per leasing ────────────────────────────────────
  function renderActions(leasing: LeasingOutput) {
    if (leasing.status !== 'ACTIVE') return null;

    return (
      <div className="leasing-page__actions">
        {leasing.hasPurchaseOption && (
          <button
            type="button"
            className="leasing-page__action-btn leasing-page__action-btn--primary"
            onClick={() => setConfirmAction({ type: 'exercise', leasing })}
            aria-label={`Exercer opcao de compra de ${leasing.rouAssetName}`}
          >
            <ShoppingCart size={14} aria-hidden="true" />
            Exercer
          </button>
        )}
        <button
          type="button"
          className="leasing-page__action-btn"
          onClick={() => setConfirmAction({ type: 'return', leasing })}
          aria-label={`Devolver ativo ${leasing.rouAssetName}`}
        >
          <RotateCcw size={14} aria-hidden="true" />
          Devolver
        </button>
        <button
          type="button"
          className="leasing-page__action-btn leasing-page__action-btn--danger"
          onClick={() => setConfirmAction({ type: 'cancel', leasing })}
          aria-label={`Cancelar contrato de ${leasing.rouAssetName}`}
        >
          <XCircle size={14} aria-hidden="true" />
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <main className="leasing-page" id="main-content">
      {/* Breadcrumb */}
      <nav className="leasing-page__breadcrumb" aria-label="Caminho de navegacao">
        <span>Patrimonio</span>
        <span aria-hidden="true">&gt;</span>
        <span aria-current="page">Contratos de Leasing</span>
      </nav>

      {/* Header */}
      <header className="leasing-page__header">
        <div className="leasing-page__header-left">
          <FileText size={28} aria-hidden="true" className="leasing-page__header-icon" />
          <h1 className="leasing-page__title">Contratos de Leasing</h1>
        </div>
        <button
          type="button"
          className="leasing-page__btn-new"
          onClick={() => setShowModal(true)}
        >
          <Plus size={20} aria-hidden="true" />
          Novo Contrato
        </button>
      </header>

      {/* Filters */}
      <div className="leasing-page__filters">
        <div className="leasing-page__filter-field">
          <label htmlFor="leasing-farm-filter" className="leasing-page__filter-label">
            Fazenda
          </label>
          <select
            id="leasing-farm-filter"
            className="leasing-page__select"
            value={farmFilter}
            onChange={(e) => setFarmFilter(e.target.value)}
          >
            <option value="">Todas as fazendas</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <div className="leasing-page__filter-field">
          <label htmlFor="leasing-status-filter" className="leasing-page__filter-label">
            Status
          </label>
          <select
            id="leasing-status-filter"
            className="leasing-page__select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="leasing-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="leasing-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && leasings.length === 0 && (
        <div className="leasing-page__table-wrapper">
          <TableSkeleton />
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="leasing-page__empty">
          <FileText size={48} aria-hidden="true" className="leasing-page__empty-icon" />
          <h2 className="leasing-page__empty-title">Nenhum contrato de leasing</h2>
          <p className="leasing-page__empty-desc">
            Cadastre contratos de arrendamento para controlar ativos de direito de uso (CPC 06).
          </p>
          <button
            type="button"
            className="leasing-page__empty-btn"
            onClick={() => setShowModal(true)}
          >
            <Plus size={20} aria-hidden="true" />
            Novo Contrato
          </button>
        </div>
      )}

      {/* Table (desktop) */}
      {!isEmpty && !loading && (
        <div className="leasing-page__table-wrapper">
          <table className="leasing-page__table">
            <caption>Lista de contratos de leasing</caption>
            <thead>
              <tr>
                <th scope="col">Contrato</th>
                <th scope="col">Arrendador</th>
                <th scope="col">Ativo ROU</th>
                <th scope="col">Fazenda</th>
                <th scope="col">Valor Total</th>
                <th scope="col">Parcelas</th>
                <th scope="col">Inicio - Fim</th>
                <th scope="col">Status</th>
                <th scope="col">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {leasings.map((l) => (
                <tr key={l.id}>
                  <td className="leasing-page__cell-contract">
                    {l.contractNumber || '—'}
                  </td>
                  <td>{l.lessorName}</td>
                  <td>{l.rouAssetName}</td>
                  <td>{l.farmName}</td>
                  <td className="leasing-page__cell-currency">
                    {formatCurrency(l.totalContractValue)}
                  </td>
                  <td>{l.installmentCount}x {formatCurrency(l.monthlyInstallment)}</td>
                  <td className="leasing-page__cell-dates">
                    {formatDate(l.startDate)} - {formatDate(l.endDate)}
                  </td>
                  <td>
                    <StatusBadge status={l.status} />
                  </td>
                  <td>{renderActions(l)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cards (mobile) */}
      {!isEmpty && !loading && (
        <div className="leasing-page__cards">
          {leasings.map((l) => (
            <article key={l.id} className="leasing-page__card">
              <div className="leasing-page__card-header">
                <div>
                  <h3 className="leasing-page__card-title">
                    {l.contractNumber || l.rouAssetName}
                  </h3>
                  <p className="leasing-page__card-subtitle">
                    {l.lessorName} — {l.farmName}
                  </p>
                </div>
                <StatusBadge status={l.status} />
              </div>
              <div className="leasing-page__card-body">
                <div className="leasing-page__card-field">
                  <span className="leasing-page__card-label">ATIVO ROU</span>
                  <span className="leasing-page__card-value">{l.rouAssetName}</span>
                </div>
                <div className="leasing-page__card-field">
                  <span className="leasing-page__card-label">VALOR TOTAL</span>
                  <span className="leasing-page__card-value leasing-page__card-value--mono">
                    {formatCurrency(l.totalContractValue)}
                  </span>
                </div>
                <div className="leasing-page__card-field">
                  <span className="leasing-page__card-label">PARCELAS</span>
                  <span className="leasing-page__card-value leasing-page__card-value--mono">
                    {l.installmentCount}x {formatCurrency(l.monthlyInstallment)}
                  </span>
                </div>
                <div className="leasing-page__card-field">
                  <span className="leasing-page__card-label">VIGENCIA</span>
                  <span className="leasing-page__card-value">
                    {formatDate(l.startDate)} - {formatDate(l.endDate)}
                  </span>
                </div>
              </div>
              {l.status === 'ACTIVE' && (
                <div className="leasing-page__card-actions">
                  {renderActions(l)}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Creation modal */}
      <AssetLeasingModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleCreate}
      />

      {/* Confirm modal */}
      {confirmAction && (
        <ConfirmModal
          isOpen={true}
          title={CONFIRM_CONFIG[confirmAction.type].title}
          message={CONFIRM_CONFIG[confirmAction.type].messageFn(confirmAction.leasing)}
          confirmLabel={CONFIRM_CONFIG[confirmAction.type].label}
          cancelLabel="Cancelar"
          variant={CONFIRM_CONFIG[confirmAction.type].variant}
          isLoading={actionLoading}
          onConfirm={() => void handleConfirmAction()}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </main>
  );
}
