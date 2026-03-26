import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Package,
  Plus,
  Search,
  FileText,
  UserRound,
  Trash2,
} from 'lucide-react';
import { useEpiDeliveries } from '@/hooks/useEpiDeliveries';
import { useEmployees } from '@/hooks/useEmployees';
import ConfirmModal from '@/components/ui/ConfirmModal';
import EpiDeliveryModal from '@/components/epi-deliveries/EpiDeliveryModal';
import { DELIVERY_REASON_LABELS, EPI_TYPES, EPI_TYPE_LABELS } from '@/types/epi';
import './EpiDeliveriesPage.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="epi-deliveries-page__skeleton-row">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}>
          <div className="epi-deliveries-page__skeleton" />
        </td>
      ))}
    </tr>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

type TabKey = 'deliveries' | 'ficha';

const LIMIT = 20;

export default function EpiDeliveriesPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('deliveries');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [epiTypeFilter, setEpiTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ficha tab
  const [fichaEmployeeId, setFichaEmployeeId] = useState('');
  const [fichaSearch, setFichaSearch] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const {
    deliveries,
    employeeDeliveries,
    loading,
    error,
    successMessage,
    setSuccessMessage,
    fetchEpiDeliveries,
    fetchEmployeeDeliveries,
    deleteEpiDelivery,
    downloadEpiFichaPdf,
  } = useEpiDeliveries();

  const { employees } = useEmployees({ search: fichaSearch || undefined, limit: 200 });

  // ─── Debounced search ──────────────────────────────────────────────────────

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // ─── Fetch data ────────────────────────────────────────────────────────────

  const loadDeliveries = useCallback(() => {
    void fetchEpiDeliveries({
      search: search || undefined,
      epiType: epiTypeFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
      limit: LIMIT,
    });
  }, [fetchEpiDeliveries, search, epiTypeFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    if (activeTab === 'deliveries') {
      loadDeliveries();
    }
  }, [activeTab, loadDeliveries]);

  useEffect(() => {
    if (activeTab === 'ficha' && fichaEmployeeId) {
      void fetchEmployeeDeliveries(fichaEmployeeId);
    }
  }, [activeTab, fichaEmployeeId, fetchEmployeeDeliveries]);

  // ─── Toast ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (successMessage) {
      setToast(successMessage);
      setSuccessMessage(null);
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, setSuccessMessage]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  // ─── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteEpiDelivery(id);
      setConfirmDeleteId(null);
      showToast('Entrega removida. Saldo de estoque restaurado.');
      loadDeliveries();
    } catch (err) {
      showToast('Não foi possível remover a entrega.');
    } finally {
      setDeletingId(null);
    }
  }

  // ─── PDF Download ──────────────────────────────────────────────────────────

  async function handleDownloadPdf() {
    if (!fichaEmployeeId) return;
    setDownloadingPdf(true);
    const selectedEmployee = employees.find((e) => e.id === fichaEmployeeId);
    try {
      await downloadEpiFichaPdf(fichaEmployeeId, selectedEmployee?.name);
    } catch {
      showToast('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setDownloadingPdf(false);
    }
  }

  // ─── Pagination ────────────────────────────────────────────────────────────

  const totalPages = deliveries ? Math.ceil(deliveries.total / LIMIT) : 0;
  const selectedEmployee = employees.find((e) => e.id === fichaEmployeeId);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="epi-deliveries-page" id="main-content">
      {/* Toast */}
      {toast && (
        <div className="epi-deliveries-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="epi-deliveries-page__header">
        <h1 className="epi-deliveries-page__title">
          <Package size={24} aria-hidden="true" />
          Entregas de EPI
        </h1>
        <button
          type="button"
          className="epi-deliveries-page__btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={20} aria-hidden="true" />
          Registrar Entrega
        </button>
      </div>

      {/* Filter Bar */}
      <div className="epi-deliveries-page__filter-bar">
        <div className="epi-deliveries-page__search-wrapper">
          <Search size={16} aria-hidden="true" className="epi-deliveries-page__search-icon" />
          <input
            type="search"
            className="epi-deliveries-page__search"
            placeholder="Buscar colaborador ou EPI..."
            aria-label="Buscar entrega"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <select
          className="epi-deliveries-page__filter"
          aria-label="Filtrar por tipo de EPI"
          value={epiTypeFilter}
          onChange={(e) => { setEpiTypeFilter(e.target.value); setPage(1); }}
        >
          <option value="">Todos os tipos</option>
          {EPI_TYPES.map((t) => (
            <option key={t} value={t}>{EPI_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <input
          type="date"
          className="epi-deliveries-page__filter"
          aria-label="Data de início"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
        />
        <input
          type="date"
          className="epi-deliveries-page__filter"
          aria-label="Data de fim"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
        />
      </div>

      {/* Tabs */}
      <div className="epi-deliveries-page__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'deliveries'}
          className={`epi-deliveries-page__tab${activeTab === 'deliveries' ? ' epi-deliveries-page__tab--active' : ''}`}
          onClick={() => setActiveTab('deliveries')}
        >
          Entregas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'ficha'}
          className={`epi-deliveries-page__tab${activeTab === 'ficha' ? ' epi-deliveries-page__tab--active' : ''}`}
          onClick={() => setActiveTab('ficha')}
        >
          Ficha por Colaborador
        </button>
      </div>

      {/* Tab: Entregas */}
      {activeTab === 'deliveries' && (
        <section aria-label="Lista de entregas de EPI">
          {error && (
            <p className="epi-deliveries-page__error" role="alert">
              {error}
            </p>
          )}

          <div className="epi-deliveries-page__table-wrapper">
            <table className="epi-deliveries-page__table">
              <thead>
                <tr>
                  <th scope="col">DATA</th>
                  <th scope="col">COLABORADOR</th>
                  <th scope="col">FUNÇÃO</th>
                  <th scope="col">EPI ENTREGUE</th>
                  <th scope="col">Nº CA</th>
                  <th scope="col">MOTIVO</th>
                  <th scope="col">QTDE</th>
                  <th scope="col">ASSINATURA</th>
                  <th scope="col">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <>
                    <SkeletonRow cols={9} />
                    <SkeletonRow cols={9} />
                    <SkeletonRow cols={9} />
                    <SkeletonRow cols={9} />
                  </>
                )}
                {!loading && deliveries?.data.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      <div className="epi-deliveries-page__empty">
                        <Package size={48} aria-hidden="true" className="epi-deliveries-page__empty-icon" />
                        <p className="epi-deliveries-page__empty-title">Nenhuma entrega registrada</p>
                        <p className="epi-deliveries-page__empty-body">
                          Registre a primeira entrega de EPI para um colaborador.
                        </p>
                        <button
                          type="button"
                          className="epi-deliveries-page__btn-primary"
                          onClick={() => setShowCreateModal(true)}
                        >
                          <Plus size={20} aria-hidden="true" />
                          Registrar Entrega
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading &&
                  deliveries?.data.map((delivery) => (
                    <tr key={delivery.id} className="epi-deliveries-page__row">
                      <td>{formatDate(delivery.date)}</td>
                      <td>{delivery.employeeName}</td>
                      <td>{delivery.employeePosition ?? '—'}</td>
                      <td>{delivery.epiProductName}</td>
                      <td>
                        <span className="epi-deliveries-page__mono">{delivery.caNumber}</span>
                      </td>
                      <td>{DELIVERY_REASON_LABELS[delivery.reason] ?? delivery.reason}</td>
                      <td>{delivery.quantity}</td>
                      <td>
                        {delivery.signatureUrl ? (
                          <FileText
                            size={16}
                            aria-label="Assinatura disponível"
                            className="epi-deliveries-page__sig-icon"
                          />
                        ) : (
                          <span aria-label="Sem assinatura">—</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="epi-deliveries-page__btn-icon"
                          aria-label={`Excluir entrega de ${delivery.epiProductName}`}
                          onClick={() => setConfirmDeleteId(delivery.id)}
                          disabled={deletingId === delivery.id}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="epi-deliveries-page__pagination" aria-label="Paginação">
              <button
                type="button"
                className="epi-deliveries-page__page-btn"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Página anterior"
              >
                &lsaquo;
              </button>
              <span className="epi-deliveries-page__page-info">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                className="epi-deliveries-page__page-btn"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Próxima página"
              >
                &rsaquo;
              </button>
            </div>
          )}
        </section>
      )}

      {/* Tab: Ficha por Colaborador */}
      {activeTab === 'ficha' && (
        <section aria-label="Ficha de EPI por colaborador">
          <div className="epi-deliveries-page__ficha-toolbar">
            <div className="epi-deliveries-page__search-wrapper">
              <Search size={16} aria-hidden="true" className="epi-deliveries-page__search-icon" />
              <input
                type="search"
                className="epi-deliveries-page__search"
                placeholder="Buscar colaborador..."
                aria-label="Buscar colaborador para ficha"
                value={fichaSearch}
                onChange={(e) => setFichaSearch(e.target.value)}
              />
            </div>
            <select
              className="epi-deliveries-page__filter"
              aria-label="Selecionar colaborador"
              value={fichaEmployeeId}
              onChange={(e) => setFichaEmployeeId(e.target.value)}
            >
              <option value="">Selecione um colaborador...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>

          {!fichaEmployeeId ? (
            <div className="epi-deliveries-page__empty">
              <UserRound size={48} aria-hidden="true" className="epi-deliveries-page__empty-icon" />
              <p className="epi-deliveries-page__empty-title">
                Selecione um colaborador para visualizar a ficha de EPI.
              </p>
            </div>
          ) : (
            <>
              {/* Employee card */}
              {selectedEmployee && (
                <div className="epi-deliveries-page__employee-card">
                  <div>
                    <p className="epi-deliveries-page__employee-name">{selectedEmployee.name}</p>
                  </div>
                  <button
                    type="button"
                    className="epi-deliveries-page__btn-secondary"
                    onClick={() => void handleDownloadPdf()}
                    disabled={downloadingPdf}
                    aria-label={`Imprimir ficha EPI de ${selectedEmployee.name}`}
                    aria-busy={downloadingPdf}
                  >
                    <FileText size={16} aria-hidden="true" />
                    {downloadingPdf ? 'Gerando PDF...' : 'Imprimir Ficha EPI'}
                  </button>
                </div>
              )}

              {/* Deliveries table for selected employee */}
              {loading ? (
                <div className="epi-deliveries-page__skeleton-card" />
              ) : employeeDeliveries.length === 0 ? (
                <div className="epi-deliveries-page__empty">
                  <p className="epi-deliveries-page__empty-body">
                    Nenhuma entrega registrada para este colaborador.
                  </p>
                </div>
              ) : (
                <div className="epi-deliveries-page__table-wrapper">
                  <table className="epi-deliveries-page__table">
                    <thead>
                      <tr>
                        <th scope="col">DATA</th>
                        <th scope="col">EPI</th>
                        <th scope="col">Nº CA</th>
                        <th scope="col">MOTIVO</th>
                        <th scope="col">QTDE</th>
                        <th scope="col">ASSINATURA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employeeDeliveries.map((d) => (
                        <tr key={d.id} className="epi-deliveries-page__row">
                          <td>{formatDate(d.date)}</td>
                          <td>{d.epiProductName}</td>
                          <td>
                            <span className="epi-deliveries-page__mono">{d.caNumber}</span>
                          </td>
                          <td>{DELIVERY_REASON_LABELS[d.reason] ?? d.reason}</td>
                          <td>{d.quantity}</td>
                          <td>
                            {d.signatureUrl ? (
                              <FileText size={16} aria-label="Assinatura disponível" className="epi-deliveries-page__sig-icon" />
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Modal: Create Delivery */}
      {showCreateModal && (
        <EpiDeliveryModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(msg) => {
            setShowCreateModal(false);
            showToast(msg);
            loadDeliveries();
          }}
        />
      )}

      {/* Confirm Delete */}
      {confirmDeleteId && (
        <ConfirmModal
          isOpen={true}
          title="Excluir entrega"
          message="Excluir entrega: Esta ação irá restaurar o saldo de estoque do EPI. Confirmar exclusão?"
          confirmLabel="Excluir"
          variant="warning"
          isLoading={deletingId === confirmDeleteId}
          onConfirm={() => void handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </main>
  );
}
