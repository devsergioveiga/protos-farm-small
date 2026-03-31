import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Search,
  AlertCircle,
  Pencil,
  Trash2,
  Copy,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Syringe,
  ListOrdered,
  Download,
  ArrowLeft,
  History,
  DollarSign,
} from 'lucide-react';
import { useIatfProtocols } from '@/hooks/useIatfProtocols';
import type {
  IatfProtocolItem,
  IatfProtocolDetail,
  VersionHistoryItem,
  CostBreakdown,
} from '@/types/iatf-protocol';
import { IATF_PROTOCOL_STATUSES, TARGET_CATEGORIES } from '@/types/iatf-protocol';
import IatfProtocolModal from '@/components/iatf-protocols/IatfProtocolModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { api } from '@/services/api';
import './IatfProtocolsPage.css';

function formatCurrency(cents: number | null | undefined): string {
  if (cents == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function IatfProtocolsPage() {
  // ─── State ──────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [editProtocol, setEditProtocol] = useState<IatfProtocolDetail | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<IatfProtocolDetail | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IatfProtocolItem | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [versions, setVersions] = useState<VersionHistoryItem[]>([]);
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ─── Debounced search ───────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ─── Data ───────────────────────────────────────────────
  const { protocols, meta, isLoading, error, refetch } = useIatfProtocols({
    page,
    status: statusFilter || undefined,
    targetCategory: categoryFilter || undefined,
    search: search || undefined,
  });

  // ─── Callbacks ──────────────────────────────────────────
  const handleSuccess = useCallback(() => {
    setShowModal(false);
    setEditProtocol(null);
    setSuccessMsg(
      editProtocol ? 'Protocolo atualizado com sucesso' : 'Protocolo cadastrado com sucesso',
    );
    void refetch();
    setTimeout(() => setSuccessMsg(null), 5000);
  }, [refetch, editProtocol]);

  const handleViewDetail = useCallback(async (p: IatfProtocolItem) => {
    setLoadingDetail(true);
    setDeleteError(null);
    try {
      const [detail, versionData, costData] = await Promise.all([
        api.get<IatfProtocolDetail>(`/org/iatf-protocols/${p.id}`),
        api
          .get<VersionHistoryItem[]>(`/org/iatf-protocols/${p.id}/versions`)
          .catch(() => [] as VersionHistoryItem[]),
        api.get<CostBreakdown>(`/org/iatf-protocols/${p.id}/cost`).catch(() => null),
      ]);
      setSelectedDetail(detail);
      setVersions(Array.isArray(versionData) ? versionData : []);
      setCostBreakdown(costData);
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error ? err.message : 'Erro ao carregar detalhes do protocolo.',
      );
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const handleEdit = useCallback(async (p: IatfProtocolItem) => {
    try {
      const detail = await api.get<IatfProtocolDetail>(`/org/iatf-protocols/${p.id}`);
      setEditProtocol(detail);
      setShowModal(true);
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error ? err.message : 'Erro ao carregar protocolo para edição.',
      );
    }
  }, []);

  const handleDeleteClick = useCallback((p: IatfProtocolItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(p);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await api.delete(`/org/iatf-protocols/${deleteTarget.id}`);
      setSuccessMsg('Protocolo excluído com sucesso');
      if (selectedDetail?.id === deleteTarget.id) {
        setSelectedDetail(null);
      }
      setDeleteTarget(null);
      void refetch();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir protocolo.');
      setDeleteTarget(null);
    }
  }, [deleteTarget, refetch, selectedDetail]);

  const handleDuplicate = useCallback(
    async (p: IatfProtocolItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(null);
      try {
        await api.post(`/org/iatf-protocols/${p.id}/duplicate`, { name: `${p.name} (copia)` });
        setSuccessMsg('Protocolo duplicado com sucesso');
        void refetch();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao duplicar protocolo.');
      }
    },
    [refetch],
  );

  const handleExport = useCallback(async (protocolId: string) => {
    try {
      const blob = await api.getBlob(`/org/iatf-protocols/${protocolId}/export`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'protocolo-iatf.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Erro ao exportar protocolo.');
    }
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedDetail(null);
    setVersions([]);
    setCostBreakdown(null);
  }, []);

  // ─── Detail View ────────────────────────────────────────
  if (selectedDetail) {
    const detail = selectedDetail;
    return (
      <section className="iatf-protocols-page iatf-protocols-page__detail">
        <button type="button" className="iatf-protocols-page__back-btn" onClick={handleBackToList}>
          <ArrowLeft size={16} aria-hidden="true" />
          Voltar para a lista
        </button>

        {/* Success / Error */}
        {successMsg && (
          <div className="iatf-protocols-page__success" role="status">
            <CheckCircle size={16} aria-hidden="true" />
            {successMsg}
          </div>
        )}
        {deleteError && (
          <div className="iatf-protocols-page__error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            {deleteError}
          </div>
        )}

        {/* Protocol info */}
        <div className="iatf-protocols-page__detail-info">
          <div className="iatf-protocols-page__detail-header">
            <div>
              <h1 className="iatf-protocols-page__detail-title">{detail.name}</h1>
              {detail.description && (
                <p className="iatf-protocols-page__detail-description">{detail.description}</p>
              )}
              <div className="iatf-protocols-page__card-tags">
                <span
                  className={`iatf-protocols-page__tag iatf-protocols-page__tag--status-${detail.status}`}
                >
                  {detail.statusLabel}
                </span>
                <span
                  className={`iatf-protocols-page__tag iatf-protocols-page__tag--target-${detail.targetCategory}`}
                >
                  {detail.targetCategoryLabel}
                </span>
                {detail.version > 1 && (
                  <span className="iatf-protocols-page__tag iatf-protocols-page__tag--version">
                    v{detail.version}
                  </span>
                )}
              </div>
            </div>
            <div className="iatf-protocols-page__detail-actions">
              <button
                type="button"
                className="iatf-protocols-page__detail-btn"
                onClick={() => {
                  setEditProtocol(detail);
                  setShowModal(true);
                }}
                aria-label="Editar protocolo"
              >
                <Pencil size={16} aria-hidden="true" />
                Editar
              </button>
              <button
                type="button"
                className="iatf-protocols-page__detail-btn"
                onClick={() => void handleExport(detail.id)}
                aria-label="Exportar CSV"
              >
                <Download size={16} aria-hidden="true" />
                CSV
              </button>
              <button
                type="button"
                className="iatf-protocols-page__detail-btn iatf-protocols-page__detail-btn--delete"
                onClick={(e) => handleDeleteClick(detail, e)}
                aria-label="Excluir protocolo"
              >
                <Trash2 size={16} aria-hidden="true" />
                Excluir
              </button>
            </div>
          </div>

          <div className="iatf-protocols-page__detail-meta">
            {detail.veterinaryAuthor && (
              <div className="iatf-protocols-page__detail-meta-item">
                <span className="iatf-protocols-page__detail-meta-label">VETERINARIO</span>
                <span className="iatf-protocols-page__detail-meta-value">
                  {detail.veterinaryAuthor}
                </span>
              </div>
            )}
            <div className="iatf-protocols-page__detail-meta-item">
              <span className="iatf-protocols-page__detail-meta-label">ETAPAS</span>
              <span className="iatf-protocols-page__detail-meta-value">{detail.stepCount}</span>
            </div>
            <div className="iatf-protocols-page__detail-meta-item">
              <span className="iatf-protocols-page__detail-meta-label">DIAS DE IA</span>
              <span className="iatf-protocols-page__detail-meta-value">{detail.aiDayCount}</span>
            </div>
            <div className="iatf-protocols-page__detail-meta-item">
              <span className="iatf-protocols-page__detail-meta-label">CUSTO ESTIMADO</span>
              <span className="iatf-protocols-page__detail-meta-value iatf-protocols-page__detail-meta-value--mono">
                {formatCurrency(detail.estimatedCostCents)}
              </span>
            </div>
            <div className="iatf-protocols-page__detail-meta-item">
              <span className="iatf-protocols-page__detail-meta-label">CRIADO EM</span>
              <span className="iatf-protocols-page__detail-meta-value">
                {formatDate(detail.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Steps timeline */}
        <h3 className="iatf-protocols-page__timeline-section-title">
          <ListOrdered
            size={20}
            aria-hidden="true"
            style={{ verticalAlign: 'text-bottom', marginRight: 8 }}
          />
          Cronograma do protocolo
        </h3>
        <div className="iatf-protocols-page__timeline">
          {detail.steps
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((step) => (
              <div key={step.id} className="iatf-protocols-page__timeline-step">
                <div
                  className={`iatf-protocols-page__timeline-marker${step.isAiDay ? ' iatf-protocols-page__timeline-marker--ai' : ''}`}
                  aria-hidden="true"
                />
                <div
                  className={`iatf-protocols-page__timeline-content${step.isAiDay ? ' iatf-protocols-page__timeline-content--ai' : ''}`}
                >
                  <div className="iatf-protocols-page__timeline-day-label">
                    <span
                      className={`iatf-protocols-page__day-badge${step.isAiDay ? ' iatf-protocols-page__day-badge--ai' : ''}`}
                    >
                      D{step.dayNumber}
                    </span>
                    {step.isAiDay && (
                      <span className="iatf-protocols-page__ai-label">
                        <Syringe size={14} aria-hidden="true" />
                        Dia da IA
                      </span>
                    )}
                  </div>
                  <p className="iatf-protocols-page__timeline-desc">{step.description}</p>

                  {step.products.length > 0 && (
                    <table className="iatf-protocols-page__products-table">
                      <caption>Produtos desta etapa</caption>
                      <thead>
                        <tr>
                          <th scope="col">Produto</th>
                          <th scope="col">Dose</th>
                          <th scope="col">Via</th>
                        </tr>
                      </thead>
                      <tbody>
                        {step.products.map((prod) => (
                          <tr key={prod.id}>
                            <td>{prod.productName}</td>
                            <td>
                              {prod.dose} {prod.doseUnit}
                            </td>
                            <td>{prod.administrationRoute ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ))}
        </div>

        {/* Cost breakdown */}
        {costBreakdown && (
          <div className="iatf-protocols-page__cost">
            <h3>
              <DollarSign
                size={18}
                aria-hidden="true"
                style={{ verticalAlign: 'text-bottom', marginRight: 4 }}
              />
              Custo estimado
            </h3>
            <span className="iatf-protocols-page__cost-total">
              {formatCurrency(costBreakdown.totalCostCents)}
            </span>
            <span className="iatf-protocols-page__cost-label">por animal</span>
          </div>
        )}

        {/* Version history */}
        {versions.length > 0 && (
          <div className="iatf-protocols-page__versions">
            <h3>
              <History
                size={18}
                aria-hidden="true"
                style={{ verticalAlign: 'text-bottom', marginRight: 4 }}
              />
              Historico de versoes
            </h3>
            <ul className="iatf-protocols-page__version-list">
              {versions.map((v) => (
                <li key={v.id} className="iatf-protocols-page__version-item">
                  <span className="iatf-protocols-page__version-badge">v{v.version}</span>
                  <div className="iatf-protocols-page__version-info">
                    <span className="iatf-protocols-page__version-name">{v.name}</span>
                    <span className="iatf-protocols-page__version-date">
                      {' '}
                      - {formatDate(v.createdAt)}
                    </span>
                  </div>
                  <span
                    className={`iatf-protocols-page__tag iatf-protocols-page__tag--status-${v.status}`}
                  >
                    {v.statusLabel}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {detail.notes && (
          <div className="iatf-protocols-page__detail-info">
            <h3
              style={{
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontSize: '1rem',
                fontWeight: 700,
                margin: '0 0 8px',
              }}
            >
              Observacoes
            </h3>
            <p className="iatf-protocols-page__detail-description" style={{ margin: 0 }}>
              {detail.notes}
            </p>
          </div>
        )}

        {/* Modal */}
        <IatfProtocolModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setEditProtocol(null);
          }}
          protocol={editProtocol}
          onSuccess={() => {
            handleSuccess();
            // Re-fetch detail after edit
            void handleViewDetail(detail);
          }}
        />
      </section>
    );
  }

  // ─── List View ──────────────────────────────────────────
  return (
    <section className="iatf-protocols-page">
      {/* Header */}
      <header className="iatf-protocols-page__header">
        <div>
          <h1>Protocolos IATF</h1>
          <p>Gerencie protocolos de inseminacao artificial em tempo fixo</p>
        </div>
        <button
          type="button"
          className="iatf-protocols-page__btn-primary"
          onClick={() => {
            setEditProtocol(null);
            setShowModal(true);
          }}
        >
          <Plus size={20} aria-hidden="true" />
          Novo protocolo
        </button>
      </header>

      {/* Success */}
      {successMsg && (
        <div className="iatf-protocols-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}

      {/* Errors */}
      {(error || deleteError) && (
        <div className="iatf-protocols-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error || deleteError}
        </div>
      )}

      {/* Toolbar */}
      <div className="iatf-protocols-page__toolbar">
        <div className="iatf-protocols-page__search">
          <Search size={16} aria-hidden="true" className="iatf-protocols-page__search-icon" />
          <input
            id="iatf-search"
            type="text"
            placeholder="Buscar por nome ou veterinario..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar protocolos IATF"
          />
        </div>
        <div className="iatf-protocols-page__filter">
          <select
            id="iatf-status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por status"
          >
            <option value="">Todos os status</option>
            {IATF_PROTOCOL_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="iatf-protocols-page__filter">
          <select
            id="iatf-category-filter"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por categoria"
          >
            <option value="">Todas as categorias</option>
            {TARGET_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading */}
      {(isLoading || loadingDetail) && (
        <div className="iatf-protocols-page__loading">Carregando protocolos...</div>
      )}

      {/* Empty */}
      {!isLoading && !loadingDetail && protocols.length === 0 && (
        <div className="iatf-protocols-page__empty">
          <CalendarClock size={48} aria-hidden="true" />
          <h2>Nenhum protocolo IATF cadastrado</h2>
          <p>
            Cadastre seu primeiro protocolo de inseminacao artificial em tempo fixo para organizar o
            manejo reprodutivo do rebanho.
          </p>
        </div>
      )}

      {/* Grid */}
      {!isLoading && !loadingDetail && protocols.length > 0 && (
        <div className="iatf-protocols-page__grid">
          {protocols.map((p) => (
            <div
              key={p.id}
              className="iatf-protocols-page__card"
              onClick={() => void handleViewDetail(p)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void handleViewDetail(p);
                }
              }}
            >
              <div className="iatf-protocols-page__card-header">
                <div>
                  <h3 className="iatf-protocols-page__card-title">{p.name}</h3>
                  {p.veterinaryAuthor && (
                    <p className="iatf-protocols-page__card-vet">por {p.veterinaryAuthor}</p>
                  )}
                </div>
                <div className="iatf-protocols-page__card-actions">
                  <button
                    type="button"
                    className="iatf-protocols-page__card-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDuplicate(p, e);
                    }}
                    aria-label={`Duplicar ${p.name}`}
                  >
                    <Copy size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="iatf-protocols-page__card-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleEdit(p);
                    }}
                    aria-label={`Editar ${p.name}`}
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="iatf-protocols-page__card-btn iatf-protocols-page__card-btn--delete"
                    onClick={(e) => handleDeleteClick(p, e)}
                    aria-label={`Excluir ${p.name}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="iatf-protocols-page__card-tags">
                <span
                  className={`iatf-protocols-page__tag iatf-protocols-page__tag--status-${p.status}`}
                >
                  {p.statusLabel}
                </span>
                <span
                  className={`iatf-protocols-page__tag iatf-protocols-page__tag--target-${p.targetCategory}`}
                >
                  {p.targetCategoryLabel}
                </span>
                {p.version > 1 && (
                  <span className="iatf-protocols-page__tag iatf-protocols-page__tag--version">
                    v{p.version}
                  </span>
                )}
              </div>

              <div className="iatf-protocols-page__card-meta">
                <span className="iatf-protocols-page__card-meta-item">
                  <ListOrdered size={14} aria-hidden="true" />
                  {p.stepCount} etapa{p.stepCount !== 1 ? 's' : ''}
                </span>
                <span className="iatf-protocols-page__card-meta-item">
                  <Syringe size={14} aria-hidden="true" />
                  {p.aiDayCount} dia{p.aiDayCount !== 1 ? 's' : ''} de IA
                </span>
                <span className="iatf-protocols-page__card-meta-item iatf-protocols-page__card-cost">
                  <DollarSign size={14} aria-hidden="true" />
                  {formatCurrency(p.estimatedCostCents)}
                </span>
              </div>

              {p.description && (
                <p className="iatf-protocols-page__card-description">{p.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <nav className="iatf-protocols-page__pagination" aria-label="Paginacao">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
            aria-label="Pagina anterior"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            Anterior
          </button>
          <span>
            {page} de {meta.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={page >= meta.totalPages}
            aria-label="Proxima pagina"
          >
            Proxima
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </nav>
      )}

      {/* Modal */}
      <IatfProtocolModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditProtocol(null);
        }}
        protocol={editProtocol}
        onSuccess={handleSuccess}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Excluir protocolo"
        message={`Deseja excluir o protocolo "${deleteTarget?.name ?? ''}"? Esta ação não pode ser desfeita.`}
        variant="danger"
        confirmLabel="Excluir"
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}
