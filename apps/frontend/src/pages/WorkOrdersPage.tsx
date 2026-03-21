import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList,
  Plus,
  Pencil,
  Circle,
  Loader2,
  PackageX,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import type { WorkOrder, WorkOrderStatus, WorkOrderType } from '@/types/maintenance';
import WorkOrderModal from '@/components/maintenance/WorkOrderModal';
import './WorkOrdersPage.css';

// ─── Status badge ──────────────────────────────────────────────────────

const STATUS_ICONS: Record<WorkOrderStatus, React.ElementType> = {
  ABERTA: Circle,
  EM_ANDAMENTO: Loader2,
  AGUARDANDO_PECA: PackageX,
  ENCERRADA: CheckCircle2,
  CANCELADA: XCircle,
};

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  ABERTA: 'Aberta',
  EM_ANDAMENTO: 'Em andamento',
  AGUARDANDO_PECA: 'Aguardando peca',
  ENCERRADA: 'Encerrada',
  CANCELADA: 'Cancelada',
};

const TYPE_LABELS: Record<WorkOrderType, string> = {
  PREVENTIVA: 'Preventiva',
  CORRETIVA: 'Corretiva',
  SOLICITACAO: 'Solicitacao',
};

interface StatusBadgeProps {
  status: WorkOrderStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const Icon = STATUS_ICONS[status];
  return (
    <span className={`work-orders-page__badge work-orders-page__badge--${status}`} role="status">
      <Icon size={14} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

// ─── Skeleton ─────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <tr key={i}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
            <td key={j}>
              <div className="work-orders-page__skeleton-cell" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Main component ────────────────────────────────────────────────────

type TabId = 'lista' | 'kanban';

export default function WorkOrdersPage() {
  const { workOrders, loading, error, fetchWorkOrders } = useWorkOrders();

  const [tab, setTab] = useState<TabId>('lista');
  const [showModal, setShowModal] = useState(false);
  const [editingWorkOrder, setEditingWorkOrder] = useState<WorkOrder | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  const load = useCallback(() => {
    const query: Record<string, string> = {};
    if (filterStatus) query.status = filterStatus;
    if (filterType) query.type = filterType;
    void fetchWorkOrders(query);
  }, [fetchWorkOrders, filterStatus, filterType]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSuccess() {
    setShowModal(false);
    setEditingWorkOrder(undefined);
    load();
  }

  function handleEdit(wo: WorkOrder) {
    setEditingWorkOrder(wo);
    setShowModal(true);
  }

  return (
    <main className="work-orders-page">
      {/* Breadcrumb */}
      <nav className="work-orders-page__breadcrumb" aria-label="Navegacao estrutural">
        <span>Patrimonio</span>
        <span className="work-orders-page__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="work-orders-page__breadcrumb-item--current">Ordens de Servico</span>
      </nav>

      {/* Header */}
      <header className="work-orders-page__header">
        <h1 className="work-orders-page__title">Ordens de Servico</h1>
        <button
          type="button"
          className="work-orders-page__btn-primary"
          onClick={() => { setEditingWorkOrder(undefined); setShowModal(true); }}
        >
          <Plus size={20} aria-hidden="true" />
          Abrir OS
        </button>
      </header>

      {/* Tabs */}
      <div
        className="work-orders-page__tabs"
        role="tablist"
        aria-label="Visualizacao"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'lista'}
          className={`work-orders-page__tab${tab === 'lista' ? ' work-orders-page__tab--active' : ''}`}
          onClick={() => setTab('lista')}
        >
          Lista
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'kanban'}
          className={`work-orders-page__tab${tab === 'kanban' ? ' work-orders-page__tab--active' : ''}`}
          onClick={() => setTab('kanban')}
        >
          Kanban
        </button>
      </div>

      {/* Filters */}
      <div className="work-orders-page__filters" role="search" aria-label="Filtros">
        <label htmlFor="wo-filter-status" className="sr-only">Status</label>
        <select
          id="wo-filter-status"
          className="work-orders-page__filter-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          <option value="ABERTA">Aberta</option>
          <option value="EM_ANDAMENTO">Em andamento</option>
          <option value="AGUARDANDO_PECA">Aguardando peca</option>
          <option value="ENCERRADA">Encerrada</option>
          <option value="CANCELADA">Cancelada</option>
        </select>

        <label htmlFor="wo-filter-type" className="sr-only">Tipo</label>
        <select
          id="wo-filter-type"
          className="work-orders-page__filter-select"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">Todos os tipos</option>
          <option value="PREVENTIVA">Preventiva</option>
          <option value="CORRETIVA">Corretiva</option>
          <option value="SOLICITACAO">Solicitacao</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="work-orders-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Tab content */}
      {tab === 'lista' && (
        <>
          {/* Table (desktop) */}
          <div className="work-orders-page__table-wrap">
            <table className="work-orders-page__table">
              <caption>Ordens de servico registradas</caption>
              <thead>
                <tr>
                  <th scope="col">OS #</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Ativo</th>
                  <th scope="col">Status</th>
                  <th scope="col">Responsavel</th>
                  <th scope="col">Custo total</th>
                  <th scope="col">Abertura</th>
                  <th scope="col"><span className="sr-only">Acoes</span></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows />
                ) : workOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="work-orders-page__empty">
                        <ClipboardList size={48} aria-hidden="true" color="var(--color-neutral-400)" />
                        <h2 className="work-orders-page__empty-title">Nenhuma OS aberta</h2>
                        <p className="work-orders-page__empty-desc">
                          Registre a primeira ordem de servico para comecar a rastrear manutencoes.
                        </p>
                        <button
                          type="button"
                          className="work-orders-page__btn-primary"
                          onClick={() => { setEditingWorkOrder(undefined); setShowModal(true); }}
                        >
                          <Plus size={20} aria-hidden="true" />
                          Abrir OS
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  workOrders.map((wo) => (
                    <tr key={wo.id}>
                      <td>
                        <span className="work-orders-page__seq-num">
                          #{String(wo.sequentialNumber).padStart(4, '0')}
                        </span>
                      </td>
                      <td>{TYPE_LABELS[wo.type]}</td>
                      <td>{wo.asset?.name ?? '—'}</td>
                      <td>
                        <StatusBadge status={wo.status} />
                      </td>
                      <td>{wo.assignedTo ?? '—'}</td>
                      <td>{formatBRL(wo.totalCost)}</td>
                      <td>{formatDate(wo.openedAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="work-orders-page__action-btn"
                          onClick={() => handleEdit(wo)}
                          aria-label={`Editar OS #${wo.sequentialNumber}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="work-orders-page__cards" aria-label="Ordens de servico">
            {!loading && workOrders.map((wo) => (
              <article key={wo.id} className="work-orders-page__card">
                <span className="work-orders-page__card-number">
                  #{String(wo.sequentialNumber).padStart(4, '0')}
                </span>
                <span className="work-orders-page__card-meta">
                  {wo.asset?.name ?? '—'}
                </span>
                <StatusBadge status={wo.status} />
                <span className="work-orders-page__card-meta">
                  {formatBRL(wo.totalCost)} &middot; {formatDate(wo.openedAt)}
                </span>
              </article>
            ))}
          </div>
        </>
      )}

      {tab === 'kanban' && (
        <p className="work-orders-page__kanban-placeholder">
          Kanban disponivel no painel de manutencao.
        </p>
      )}

      {/* Modal */}
      <WorkOrderModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingWorkOrder(undefined); }}
        onSuccess={handleSuccess}
        workOrder={editingWorkOrder}
      />
    </main>
  );
}
