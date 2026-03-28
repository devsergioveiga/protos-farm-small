import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  ClipboardList,
  Circle,
  Loader2,
  PackageX,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { useFarms } from '@/hooks/useFarms';
import WorkOrderModal from '@/components/maintenance/WorkOrderModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type {
  WorkOrder,
  ListWorkOrdersQuery,
  WorkOrderStatus,
  WorkOrderType,
} from '@/types/maintenance';
import { WORK_ORDER_TYPE_LABELS, WORK_ORDER_STATUS_LABELS } from '@/types/maintenance';
import './WorkOrdersPage.css';

// ─── Helpers ────────────────────────────────────────────────────────────

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('pt-BR');
}

function formatBRL(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Status Badge ────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<WorkOrderStatus, { icon: React.ElementType; className: string }> = {
  ABERTA: { icon: Circle, className: 'wo-page__badge--aberta' },
  EM_ANDAMENTO: { icon: Loader2, className: 'wo-page__badge--em-andamento' },
  AGUARDANDO_PECA: { icon: PackageX, className: 'wo-page__badge--aguardando' },
  ENCERRADA: { icon: CheckCircle2, className: 'wo-page__badge--encerrada' },
  CANCELADA: { icon: XCircle, className: 'wo-page__badge--cancelada' },
};

function StatusBadge({ status }: { status: WorkOrderStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span className={`wo-page__badge ${config.className}`} role="status">
      <Icon size={14} aria-hidden="true" />
      {WORK_ORDER_STATUS_LABELS[status]}
    </span>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="wo-page__skeleton" aria-label="Carregando ordens de servico" role="status">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="wo-page__skeleton-row" />
      ))}
    </div>
  );
}

// ─── Mobile Card ────────────────────────────────────────────────────────

interface WorkOrderCardProps {
  wo: WorkOrder;
  onEdit: (wo: WorkOrder) => void;
}

function WorkOrderCard({ wo, onEdit }: WorkOrderCardProps) {
  return (
    <article className="wo-page__card" onClick={() => onEdit(wo)} style={{ cursor: 'pointer' }}>
      <div className="wo-page__card-header">
        <span className="wo-page__card-number">
          OS#{wo.sequentialNumber.toString().padStart(4, '0')}
        </span>
        <StatusBadge status={wo.status as WorkOrderStatus} />
      </div>
      <div className="wo-page__card-title">{wo.title}</div>
      <div className="wo-page__card-meta">
        <span>{wo.asset?.name ?? '—'}</span>
        <span>{WORK_ORDER_TYPE_LABELS[wo.type as WorkOrderType]}</span>
      </div>
      <div className="wo-page__card-footer">
        <span className="wo-page__card-cost">{formatBRL(wo.totalCost)}</span>
        <span className="wo-page__card-date">{formatDate(wo.openedAt)}</span>
      </div>
    </article>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────

type TabType = 'lista' | 'kanban';

export default function WorkOrdersPage() {
  const { workOrders, loading, error, total, totalPages, fetchWorkOrders, cancelWorkOrder } =
    useWorkOrders();
  const { farms } = useFarms();

  // Tab
  const [activeTab, setActiveTab] = useState<TabType>('lista');

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [farmFilter, setFarmFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);

  // Cancel confirm
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [woCancelTarget, setWoCancelTarget] = useState<WorkOrder | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const currentQuery: ListWorkOrdersQuery = {
    page: currentPage,
    limit: 20,
    status: statusFilter || undefined,
    type: typeFilter || undefined,
    farmId: farmFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const loadData = useCallback(() => {
    void fetchWorkOrders(currentQuery);
  }, [fetchWorkOrders, currentPage, statusFilter, typeFilter, farmFilter, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  function handleNewWO() {
    setSelectedWO(null);
    setShowModal(true);
  }

  function handleEditWO(wo: WorkOrder) {
    setSelectedWO(wo);
    setShowModal(true);
  }

  function handleCancelRequest(wo: WorkOrder) {
    setWoCancelTarget(wo);
    setShowCancelConfirm(true);
  }

  async function handleCancelConfirm() {
    if (!woCancelTarget) return;
    setIsCancelling(true);
    try {
      await cancelWorkOrder(woCancelTarget.id);
      setToast(`OS #${woCancelTarget.sequentialNumber.toString().padStart(4, '0')} cancelada.`);
      void fetchWorkOrders(currentQuery);
    } catch {
      setToast('Nao foi possivel cancelar a OS. Verifique sua conexao e tente novamente.');
    } finally {
      setIsCancelling(false);
      setShowCancelConfirm(false);
      setWoCancelTarget(null);
    }
  }

  function handleModalSuccess(message?: string) {
    setShowModal(false);
    setSelectedWO(null);
    void fetchWorkOrders(currentQuery);
    setToast(message ?? (selectedWO ? 'OS atualizada.' : 'OS aberta com sucesso.'));
  }

  const hasFilters = Boolean(statusFilter || typeFilter || farmFilter || dateFrom || dateTo);
  const isEmpty = !loading && !error && workOrders.length === 0;

  return (
    <main className="wo-page" id="main-content">
      {/* Breadcrumb */}
      <nav className="wo-page__breadcrumb" aria-label="Caminho de navegacao">
        <span className="wo-page__breadcrumb-item">Patrimonio</span>
        <span className="wo-page__breadcrumb-sep" aria-hidden="true">
          &gt;
        </span>
        <span
          className="wo-page__breadcrumb-item wo-page__breadcrumb-item--current"
          aria-current="page"
        >
          Ordens de Servico
        </span>
      </nav>

      {/* Header */}
      <header className="wo-page__header">
        <h1 className="wo-page__title">Ordens de Servico</h1>
        <button type="button" className="wo-page__btn wo-page__btn--primary" onClick={handleNewWO}>
          <Plus size={20} aria-hidden="true" />
          Abrir OS
        </button>
      </header>

      {/* Tabs */}
      <div className="wo-page__tabs" role="tablist" aria-label="Visualizacoes">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'lista'}
          className={`wo-page__tab ${activeTab === 'lista' ? 'wo-page__tab--active' : ''}`}
          onClick={() => setActiveTab('lista')}
        >
          Lista
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'kanban'}
          className={`wo-page__tab ${activeTab === 'kanban' ? 'wo-page__tab--active' : ''}`}
          onClick={() => setActiveTab('kanban')}
        >
          Kanban
        </button>
      </div>

      {/* Kanban tab placeholder */}
      {activeTab === 'kanban' && (
        <section className="wo-page__kanban-placeholder" aria-label="Kanban">
          <ClipboardList size={48} aria-hidden="true" className="wo-page__placeholder-icon" />
          <p className="wo-page__placeholder-text">Kanban disponivel no plano 05</p>
        </section>
      )}

      {/* Lista tab */}
      {activeTab === 'lista' && (
        <>
          {/* Filter bar */}
          <section className="wo-page__filters" aria-label="Filtros">
            <div className="wo-page__filter-row">
              {/* Status */}
              <div className="wo-page__filter-field">
                <label htmlFor="filter-status" className="wo-page__filter-label">
                  Status
                </label>
                <select
                  id="filter-status"
                  className="wo-page__select"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="">Todos</option>
                  <option value="ABERTA">Aberta</option>
                  <option value="EM_ANDAMENTO">Em andamento</option>
                  <option value="AGUARDANDO_PECA">Aguardando peca</option>
                  <option value="ENCERRADA">Encerrada</option>
                  <option value="CANCELADA">Cancelada</option>
                </select>
              </div>

              {/* Tipo */}
              <div className="wo-page__filter-field">
                <label htmlFor="filter-type" className="wo-page__filter-label">
                  Tipo
                </label>
                <select
                  id="filter-type"
                  className="wo-page__select"
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="">Todos</option>
                  <option value="PREVENTIVA">Preventiva</option>
                  <option value="CORRETIVA">Corretiva</option>
                  <option value="SOLICITACAO">Solicitacao</option>
                </select>
              </div>

              {/* Fazenda */}
              <div className="wo-page__filter-field">
                <label htmlFor="filter-farm" className="wo-page__filter-label">
                  Fazenda
                </label>
                <select
                  id="filter-farm"
                  className="wo-page__select"
                  value={farmFilter}
                  onChange={(e) => {
                    setFarmFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="">Todas as fazendas</option>
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Periodo */}
              <div className="wo-page__filter-field">
                <label htmlFor="filter-date-from" className="wo-page__filter-label">
                  Abertura de
                </label>
                <input
                  type="date"
                  id="filter-date-from"
                  className="wo-page__input"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <div className="wo-page__filter-field">
                <label htmlFor="filter-date-to" className="wo-page__filter-label">
                  Ate
                </label>
                <input
                  type="date"
                  id="filter-date-to"
                  className="wo-page__input"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>
          </section>

          {/* Content */}
          <section className="wo-page__content" aria-label="Lista de ordens de servico">
            {loading && <TableSkeleton />}

            {error && !loading && (
              <div className="wo-page__error" role="alert">
                <p>{error}</p>
                <button
                  type="button"
                  className="wo-page__btn wo-page__btn--secondary"
                  onClick={loadData}
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {isEmpty && hasFilters && !error && (
              <div className="wo-page__empty">
                <ClipboardList size={48} aria-hidden="true" className="wo-page__empty-icon" />
                <p className="wo-page__empty-text">Nenhuma OS encontrada com esses filtros.</p>
              </div>
            )}

            {isEmpty && !hasFilters && !error && (
              <div className="wo-page__empty">
                <ClipboardList size={48} aria-hidden="true" className="wo-page__empty-icon" />
                <h2 className="wo-page__empty-title">Nenhuma OS aberta</h2>
                <p className="wo-page__empty-desc">
                  Registre a primeira ordem de servico para comecar a rastrear manutencoes.
                </p>
                <button
                  type="button"
                  className="wo-page__btn wo-page__btn--primary"
                  onClick={handleNewWO}
                >
                  <Plus size={20} aria-hidden="true" />
                  Abrir OS
                </button>
              </div>
            )}

            {!loading && !error && workOrders.length > 0 && (
              <>
                {/* Mobile: card stack */}
                <div className="wo-page__cards">
                  {workOrders.map((wo) => (
                    <WorkOrderCard key={wo.id} wo={wo} onEdit={handleEditWO} />
                  ))}
                </div>

                {/* Desktop: table */}
                <div className="wo-page__table-wrapper">
                  <table className="wo-page__table">
                    <caption className="sr-only">Lista de ordens de servico</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="wo-page__th">
                          OS #
                        </th>
                        <th scope="col" className="wo-page__th">
                          Tipo
                        </th>
                        <th scope="col" className="wo-page__th">
                          Ativo
                        </th>
                        <th scope="col" className="wo-page__th">
                          Status
                        </th>
                        <th scope="col" className="wo-page__th">
                          Responsavel
                        </th>
                        <th scope="col" className="wo-page__th wo-page__th--right">
                          Custo total
                        </th>
                        <th scope="col" className="wo-page__th">
                          Abertura
                        </th>
                        <th scope="col" className="wo-page__th wo-page__th--right">
                          Acoes
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {workOrders.map((wo) => (
                        <tr
                          key={wo.id}
                          className="wo-page__tr wo-page__tr--clickable"
                          onClick={() => handleEditWO(wo)}
                          aria-label={`Ver OS ${wo.sequentialNumber}`}
                        >
                          <td className="wo-page__td">
                            <span className="wo-page__os-number">
                              OS#{wo.sequentialNumber.toString().padStart(4, '0')}
                            </span>
                          </td>
                          <td className="wo-page__td">
                            {WORK_ORDER_TYPE_LABELS[wo.type as WorkOrderType]}
                          </td>
                          <td className="wo-page__td">{wo.asset?.name ?? '—'}</td>
                          <td className="wo-page__td">
                            <StatusBadge status={wo.status as WorkOrderStatus} />
                          </td>
                          <td className="wo-page__td">{wo.assignedTo ?? '—'}</td>
                          <td className="wo-page__td wo-page__td--right wo-page__td--mono">
                            {formatBRL(wo.totalCost)}
                          </td>
                          <td className="wo-page__td">{formatDate(wo.openedAt)}</td>
                          <td className="wo-page__td wo-page__td--right">
                            <div className="wo-page__row-actions">
                              {(wo.status === 'ABERTA' || wo.status === 'EM_ANDAMENTO') && (
                                <button
                                  type="button"
                                  className="wo-page__action-btn wo-page__action-btn--danger"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelRequest(wo);
                                  }}
                                  aria-label={`Cancelar OS #${wo.sequentialNumber.toString().padStart(4, '0')}`}
                                >
                                  <XCircle size={16} aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <nav className="wo-page__pagination" aria-label="Paginacao">
                    <button
                      type="button"
                      className="wo-page__pagination-btn"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      aria-label="Pagina anterior"
                    >
                      <ChevronLeft size={20} aria-hidden="true" />
                    </button>
                    <span className="wo-page__pagination-info">
                      Pagina {currentPage} de {totalPages} ({total} OS)
                    </span>
                    <button
                      type="button"
                      className="wo-page__pagination-btn"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      aria-label="Proxima pagina"
                    >
                      <ChevronRight size={20} aria-hidden="true" />
                    </button>
                  </nav>
                )}
              </>
            )}
          </section>
        </>
      )}

      {/* Work Order Modal (create/edit) */}
      {showModal && (
        <WorkOrderModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setSelectedWO(null);
          }}
          onSuccess={handleModalSuccess}
          workOrder={selectedWO ?? undefined}
        />
      )}

      {/* Cancel confirmation */}
      <ConfirmModal
        isOpen={showCancelConfirm}
        title={`Cancelar OS #${woCancelTarget?.sequentialNumber?.toString().padStart(4, '0') ?? ''}?`}
        message="Esta acao nao pode ser desfeita. O ativo voltara ao status Ativo."
        confirmLabel="Cancelar OS"
        cancelLabel="Nao cancelar"
        variant="danger"
        isLoading={isCancelling}
        onConfirm={() => void handleCancelConfirm()}
        onCancel={() => {
          setShowCancelConfirm(false);
          setWoCancelTarget(null);
        }}
      />

      {/* Toast */}
      {toast && (
        <div className="wo-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </main>
  );
}
